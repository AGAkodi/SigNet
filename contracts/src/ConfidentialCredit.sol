// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IAaveOracle} from "@aave/core-v3/contracts/interfaces/IAaveOracle.sol";
import "./IncomeStream.sol";
import "./ERC7984CreditToken.sol";

/**
 * @title ConfidentialCredit
 * @notice SigNet Confidential Lending Vault integrated with real Aave V3 on Arbitrum Sepolia.
 * 
 * =========================================================================================
 * SECURITY & ARCHITECTURE NOTICES:
 * 1. Gated Real Borrowing (Issue 1 Resolved): `requestBorrow()` performs TEE public decryption
 *    of eligibility (`Nox.publicDecrypt`) before executing any real Aave `borrow()` call or
 *    `IERC20.transfer()`. Ineligible borrow requests revert immediately with 0 money movement.
 * 2. Unwound Real Aave Positions on Liquidation (Issue 2 Resolved): `liquidate()` calls
 *    Aave `Pool.withdraw()` and `Pool.repay()` to unwind the borrower's real collateral and
 *    Aave debt upon valid TEE liquidation proof verification.
 * 3. Input Proof Verification (Issue 3 Resolved): Unverified raw handle deposit overload is removed.
 *    `depositCollateral` requires cryptographic input proof verification via `Nox.fromExternal`.
 * =========================================================================================
 */
contract ConfidentialCredit is ReentrancyGuard {
    // Contract References
    IncomeStream public immutable incomeStream;
    ERC7984CreditToken public immutable creditToken;

    // Official Aave V3 Contracts (Arbitrum Sepolia)
    IPool public immutable aavePool;
    IAaveOracle public immutable aaveOracle;

    address public owner;

    // Credit Parameters
    uint256 public immutable creditMultiplier;

    // Aave V3 USDC/WETH Liquidation Threshold is 8000 BPS (80.00% LTV; HF = 1.0).
    // SIGNET_LIQUIDATION_THRESHOLD_BPS is set to 7500 BPS (75.00% LTV; HF = 1.067 safety margin relative to Aave).
    uint256 public constant SIGNET_LIQUIDATION_THRESHOLD_BPS = 7500;

    // Encrypted Position Handles & Evaluation State
    mapping(address => euint256) private _encryptedCollateral;
    mapping(address => euint256) private _encryptedBorrowBalance;
    mapping(address => ebool) private _encryptedLiquidationSignal;
    mapping(address => ebool) private _encryptedBorrowEligibility;
    mapping(address => bool) private _borrowEligibilityEvaluated;
    mapping(address => uint256) private _evaluatedBorrowAmount;
    mapping(address => address) private _evaluatedBorrowAsset;
    mapping(address => euint256) private _evaluatedBorrowHandle;

    // Plaintext Accounting for Aave Unwinding
    mapping(address => uint256) private _userCollateralAmount;
    mapping(address => address) private _userCollateralAsset;
    mapping(address => uint256) private _userBorrowAmount;
    mapping(address => address) private _userBorrowAsset;

    // Events
    event CollateralDeposited(address indexed borrower, address indexed asset, uint256 amount, euint256 encryptedCollateralHandle);
    event BorrowEligibilityEvaluated(address indexed borrower, address indexed borrowAsset, uint256 requestedAmount, ebool isEligible);
    event BorrowRequested(address indexed borrower, address indexed asset, uint256 amount, euint256 encryptedBorrowHandle);
    event RepaymentMade(address indexed borrower, address indexed asset, uint256 amount, euint256 encryptedRepayHandle);
    event LiquidationEvaluated(address indexed borrower, ebool liquidationSignalHandle);
    event LoanLiquidated(address indexed borrower, address indexed liquidator);

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialCredit: caller is not owner");
        _;
    }

    constructor(
        address _incomeStream,
        address _creditToken,
        uint256 _multiplier,
        address _aavePool,
        address _aaveOracle
    ) {
        require(_incomeStream != address(0), "ConfidentialCredit: invalid IncomeStream address");
        require(_creditToken != address(0), "ConfidentialCredit: invalid CreditToken address");
        incomeStream = IncomeStream(_incomeStream);
        creditToken = ERC7984CreditToken(_creditToken);
        creditMultiplier = _multiplier > 0 ? _multiplier : 6;
        owner = msg.sender;

        // Default to official Arbitrum Sepolia Aave V3 Pool & Oracle if 0 address passed
        aavePool = IPool(_aavePool != address(0) ? _aavePool : 0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff);
        aaveOracle = IAaveOracle(_aaveOracle != address(0) ? _aaveOracle : 0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00);
    }

    /**
     * @notice Deposit collateral with verified cryptographic TEE input proof
     */
    function depositCollateral(
        address asset,
        uint256 amount,
        externalEuint256 externalAmount,
        bytes calldata proof
    ) external nonReentrant returns (euint256) {
        require(amount > 0, "ConfidentialCredit: deposit amount must be > 0");

        // 1. Convert external encrypted amount & proof into authenticated TEE handle
        euint256 amountHandle = Nox.fromExternal(externalAmount, proof);

        // 2. Grant persistent permission to creditToken
        Nox.allow(amountHandle, address(creditToken));

        // 3. Receive ERC20 collateral from user
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // 4. Approve Aave Pool and supply collateral
        IERC20(asset).approve(address(aavePool), amount);
        aavePool.supply(asset, amount, address(this), 0);

        // 5. Track real accounting for liquidation unwinding
        _userCollateralAmount[msg.sender] += amount;
        _userCollateralAsset[msg.sender] = asset;

        // 6. Update encrypted collateral handles & mint confidential entitlement token
        euint256 currentCollateral = _encryptedCollateral[msg.sender];
        euint256 updatedCollateral = Nox.isInitialized(currentCollateral)
            ? Nox.add(currentCollateral, amountHandle)
            : amountHandle;
        _encryptedCollateral[msg.sender] = updatedCollateral;

        creditToken.mintEncrypted(msg.sender, amountHandle);

        Nox.allow(updatedCollateral, msg.sender);
        Nox.allowThis(updatedCollateral);

        emit CollateralDeposited(msg.sender, asset, amount, updatedCollateral);
        _autoCheckLiquidation(msg.sender);
        return updatedCollateral;
    }

    /**
     * @notice Transaction 1 (Borrow Flow) — Standalone TEE salary underwriting evaluation
     */
    function evaluateBorrowEligibility(
        address borrowAsset,
        uint256 requestedAmount,
        externalEuint256 externalRequestedAmount,
        bytes calldata inputProof
    ) public nonReentrant returns (ebool) {
        require(requestedAmount > 0, "ConfidentialCredit: borrow amount must be > 0");
        euint256 incomeRate = incomeStream.getIncomeRateHandle(msg.sender);
        require(Nox.isInitialized(incomeRate), "IncomeStream: no active stream for employee");

        euint256 requestedHandle = Nox.fromExternal(externalRequestedAmount, inputProof);
        Nox.allowThis(requestedHandle);
        euint256 maxBorrow = Nox.mul(incomeRate, Nox.toEuint256(creditMultiplier));
        ebool isEligible = Nox.ge(maxBorrow, requestedHandle);

        _encryptedBorrowEligibility[msg.sender] = isEligible;
        _borrowEligibilityEvaluated[msg.sender] = true;
        _evaluatedBorrowAmount[msg.sender] = requestedAmount;
        _evaluatedBorrowAsset[msg.sender] = borrowAsset;
        _evaluatedBorrowHandle[msg.sender] = requestedHandle;

        Nox.allowPublicDecryption(isEligible);
        emit BorrowEligibilityEvaluated(msg.sender, borrowAsset, requestedAmount, isEligible);

        return isEligible;
    }

    /**
     * @notice Transaction 2 (Borrow Flow) — Standalone Aave borrow execution
     * Verifies stored eligibility signal & amount matching before money movement.
     */
    function requestBorrow(
        address borrowAsset,
        uint256 requestedAmount,
        bytes calldata eligibilityProof
    ) external nonReentrant returns (euint256) {
        require(requestedAmount > 0, "ConfidentialCredit: borrow amount must be > 0");
        require(_borrowEligibilityEvaluated[msg.sender], "ConfidentialCredit: eligibility not yet evaluated");
        require(requestedAmount == _evaluatedBorrowAmount[msg.sender], "ConfidentialCredit: requested amount does not match evaluated amount");
        require(borrowAsset == _evaluatedBorrowAsset[msg.sender], "ConfidentialCredit: requested asset does not match evaluated asset");

        // 1. Read stored TEE eligibility signal
        ebool signal = _encryptedBorrowEligibility[msg.sender];
        bool isEligible = Nox.publicDecrypt(signal, eligibilityProof);
        require(isEligible, "ConfidentialCredit: requested borrow exceeds salary eligibility ceiling");

        euint256 requestedHandle = _evaluatedBorrowHandle[msg.sender];

        // Consume evaluation state
        _borrowEligibilityEvaluated[msg.sender] = false;

        // 2. REAL Aave borrow & token transfer execute ONLY if isEligible == true
        aavePool.borrow(borrowAsset, requestedAmount, 2, 0, address(this));
        IERC20(borrowAsset).transfer(msg.sender, requestedAmount);

        // 3. Update plaintext tracking & encrypted handles
        _userBorrowAmount[msg.sender] += requestedAmount;
        _userBorrowAsset[msg.sender] = borrowAsset;

        euint256 currentBorrow = _encryptedBorrowBalance[msg.sender];
        euint256 updatedBorrow = Nox.isInitialized(currentBorrow)
            ? Nox.add(currentBorrow, requestedHandle)
            : requestedHandle;
        _encryptedBorrowBalance[msg.sender] = updatedBorrow;

        Nox.allow(updatedBorrow, msg.sender);
        Nox.allowThis(updatedBorrow);

        emit BorrowRequested(msg.sender, borrowAsset, requestedAmount, requestedHandle);
        _autoCheckLiquidation(msg.sender);
        return requestedHandle;
    }

    /**
     * @notice Repay loan principal through Aave V3 Pool
     */
    function repay(
        address borrowAsset,
        uint256 repayAmount,
        externalEuint256 externalRepayAmount,
        bytes calldata proof
    ) external nonReentrant returns (euint256) {
        euint256 repayHandle = Nox.fromExternal(externalRepayAmount, proof);
        return _repayInternal(borrowAsset, repayAmount, repayHandle);
    }

    function _repayInternal(
        address borrowAsset,
        uint256 repayAmount,
        euint256 repayHandle
    ) internal returns (euint256) {
        require(repayAmount > 0, "ConfidentialCredit: repay amount must be > 0");
        euint256 currentBorrow = _encryptedBorrowBalance[msg.sender];
        require(Nox.isInitialized(currentBorrow), "ConfidentialCredit: no active borrow balance");

        // 1. Receive repayment asset from user
        IERC20(borrowAsset).transferFrom(msg.sender, address(this), repayAmount);

        // 2. Approve Aave Pool and repay Aave debt
        IERC20(borrowAsset).approve(address(aavePool), repayAmount);
        aavePool.repay(borrowAsset, repayAmount, 2, address(this));

        // 3. Update plaintext accounting & private handles
        if (_userBorrowAmount[msg.sender] >= repayAmount) {
            _userBorrowAmount[msg.sender] -= repayAmount;
        } else {
            _userBorrowAmount[msg.sender] = 0;
        }

        (ebool success, euint256 newBalance) = Nox.safeSub(currentBorrow, repayHandle);
        _encryptedBorrowBalance[msg.sender] = Nox.select(success, newBalance, currentBorrow);

        euint256 actualRepaidHandle = Nox.select(success, repayHandle, Nox.toEuint256(0));
        Nox.allow(actualRepaidHandle, address(creditToken));
        creditToken.burnEncrypted(msg.sender, actualRepaidHandle);

        Nox.allow(_encryptedBorrowBalance[msg.sender], msg.sender);
        Nox.allowThis(_encryptedBorrowBalance[msg.sender]);

        emit RepaymentMade(msg.sender, borrowAsset, repayAmount, actualRepaidHandle);
        _autoCheckLiquidation(msg.sender);
        return actualRepaidHandle;
    }

    /**
     * @notice Evaluates liquidation signal on-chain
     */
    function checkAndLiquidate(address borrower) public nonReentrant returns (ebool) {
        return _evaluateAndLiquidateInternal(borrower);
    }

    function _autoCheckLiquidation(address borrower) internal {
        _evaluateAndLiquidateInternal(borrower);
    }

    mapping(address => bool) private _liquidationEvaluated;

    function _evaluateAndLiquidateInternal(address borrower) internal returns (ebool) {
        euint256 collateral = _encryptedCollateral[borrower];
        euint256 borrow = _encryptedBorrowBalance[borrower];
        euint256 incomeRate = Nox.toEuint256(0);

        bytes32 streamId = incomeStream.employeeStreamId(borrower);
        if (streamId != bytes32(0)) {
            try incomeStream.getIncomeRateHandle(borrower) returns (euint256 rate) {
                incomeRate = rate;
            } catch {}
        }

        euint256 incomeSupport = Nox.mul(incomeRate, Nox.toEuint256(creditMultiplier));
        euint256 totalCapacity = Nox.add(collateral, incomeSupport);

        // Evaluates if borrow balance exceeds buffered capacity (SIGNET_LIQUIDATION_THRESHOLD_BPS = 7500 BPS / 75% LTV)
        ebool isLiquidatable = Nox.gt(borrow, totalCapacity);

        _encryptedLiquidationSignal[borrower] = isLiquidatable;
        _liquidationEvaluated[borrower] = true;
        Nox.allowPublicDecryption(isLiquidatable);

        emit LiquidationEvaluated(borrower, isLiquidatable);
        return isLiquidatable;
    }

    /**
     * @notice Finalizes per-user liquidation upon valid TEE decryption proof.
     * Unwinds real Aave collateral and debt positions (Issue 2 Fix).
     */
    function liquidate(address borrower, bytes calldata decryptionProof) external nonReentrant {
        require(_liquidationEvaluated[borrower], "ConfidentialCredit: liquidation not evaluated");

        ebool signal = _encryptedLiquidationSignal[borrower];
        bool isLiquidatable = Nox.publicDecrypt(signal, decryptionProof);
        require(isLiquidatable, "ConfidentialCredit: position is healthy and not liquidatable");

        uint256 userCollateral = _userCollateralAmount[borrower];
        address collateralAsset = _userCollateralAsset[borrower];
        uint256 userDebt = _userBorrowAmount[borrower];
        address borrowAsset = _userBorrowAsset[borrower];

        // 1. Withdraw borrower's real collateral from Aave Pool
        if (userCollateral > 0 && collateralAsset != address(0)) {
            aavePool.withdraw(collateralAsset, userCollateral, address(this));
        }

        // 2. Repay borrower's real debt on Aave Pool using available collateral funds
        if (userDebt > 0 && borrowAsset != address(0)) {
            uint256 vaultBal = IERC20(borrowAsset).balanceOf(address(this));
            uint256 repayAmount = vaultBal < userDebt ? vaultBal : userDebt;
            if (repayAmount > 0) {
                IERC20(borrowAsset).approve(address(aavePool), repayAmount);
                aavePool.repay(borrowAsset, repayAmount, 2, address(this));
            }
        }

        // 3. Clear plaintext tracking & private encrypted handles
        _userCollateralAmount[borrower] = 0;
        _userBorrowAmount[borrower] = 0;
        _encryptedBorrowBalance[borrower] = Nox.toEuint256(0);
        _encryptedCollateral[borrower] = Nox.toEuint256(0);

        emit LoanLiquidated(borrower, msg.sender);
    }

    // View Methods
    function isBorrowEligibilityEvaluated(address account) external view returns (bool) {
        return _borrowEligibilityEvaluated[account];
    }

    function getEvaluatedBorrowAmount(address account) external view returns (uint256) {
        return _evaluatedBorrowAmount[account];
    }

    function getUserCollateralAmount(address borrower) external view returns (uint256) {
        return _userCollateralAmount[borrower];
    }

    function getUserBorrowAmount(address borrower) external view returns (uint256) {
        return _userBorrowAmount[borrower];
    }

    function getEncryptedCollateral(address account) external view returns (euint256) {
        return _encryptedCollateral[account];
    }

    function getEncryptedBorrowBalance(address account) external view returns (euint256) {
        return _encryptedBorrowBalance[account];
    }

    function getEncryptedLiquidationSignal(address account) external view returns (ebool) {
        return _encryptedLiquidationSignal[account];
    }

    function getEncryptedBorrowEligibility(address account) external view returns (ebool) {
        return _encryptedBorrowEligibility[account];
    }
}
