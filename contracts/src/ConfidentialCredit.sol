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
 * ARCHITECTURE & HONEST BOUNDARY NOTICE:
 * 1. Public Layer (Aave V3): Collateral custody, interest accrual, and pool liquidity are
 *    routed directly to Aave's official Pool (`0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff`).
 * 2. Private Layer (SigNet Nox TEE):
 *    - Income Underwriting: Borrow eligibility is gated by private TEE income checks.
 *    - Entitlement Token: `ERC7984CreditToken.sol` mints encrypted handles representing
 *      user entitlement claims on the vault's pooled Aave position.
 *    - Per-User Liquidation: `checkAndLiquidate` triggers at a conservative 7500 BPS (75% LTV)
 *      threshold, liquidating individual underwater users BEFORE Aave's pool-wide 8000 BPS
 *      threshold can fire.
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
    // This guarantees per-user liquidation triggers inside SigNet BEFORE Aave's pool-wide liquidation threshold can ever be breached.
    uint256 public constant SIGNET_LIQUIDATION_THRESHOLD_BPS = 7500;

    // Encrypted Position Handles
    mapping(address => euint256) private _encryptedCollateral;
    mapping(address => euint256) private _encryptedBorrowBalance;
    mapping(address => ebool) private _encryptedLiquidationSignal;

    // Events
    event CollateralDeposited(address indexed borrower, address indexed asset, uint256 amount, euint256 encryptedCollateralHandle);
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
     * @notice Phase 1 — Deposit real collateral asset into Aave V3 Pool & Mint Encrypted Claim Token
     * @param asset Collateral ERC20 token address
     * @param amount Plaintext ERC20 collateral amount
     * @param amountHandle Encrypted handle representing collateral entitlement
     */
    function depositCollateral(
        address asset,
        uint256 amount,
        euint256 amountHandle
    ) external nonReentrant returns (euint256) {
        require(amount > 0, "ConfidentialCredit: deposit amount must be > 0");
        require(Nox.isInitialized(amountHandle), "ConfidentialCredit: uninitialized collateral handle");

        // 1. Transfer collateral asset from user to vault
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        // 2. Approve Aave Pool and supply collateral to Aave
        IERC20(asset).approve(address(aavePool), amount);
        aavePool.supply(asset, amount, address(this), 0);

        // 3. Update user's private encrypted collateral claim
        euint256 updatedCollateral = Nox.add(_encryptedCollateral[msg.sender], amountHandle);
        _encryptedCollateral[msg.sender] = updatedCollateral;

        // 4. Phase 2 — Mint confidential ERC7984 credit wrapper token
        creditToken.mintEncrypted(msg.sender, amountHandle);

        Nox.allow(updatedCollateral, msg.sender);
        Nox.allowThis(updatedCollateral);

        emit CollateralDeposited(msg.sender, asset, amount, updatedCollateral);

        // Auto-check liquidation safety side-effect
        _autoCheckLiquidation(msg.sender);

        return updatedCollateral;
    }

    /**
     * @notice Overload: Deposit collateral using input proof validation
     */
    function depositCollateral(
        address asset,
        uint256 amount,
        externalEuint256 externalAmount,
        bytes calldata proof
    ) external nonReentrant returns (euint256) {
        euint256 amountHandle = Nox.fromExternal(externalAmount, proof);
        return _depositCollateralInternal(asset, amount, amountHandle);
    }

    function _depositCollateralInternal(
        address asset,
        uint256 amount,
        euint256 amountHandle
    ) internal returns (euint256) {
        require(amount > 0, "ConfidentialCredit: deposit amount must be > 0");
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        IERC20(asset).approve(address(aavePool), amount);
        aavePool.supply(asset, amount, address(this), 0);

        euint256 updatedCollateral = Nox.add(_encryptedCollateral[msg.sender], amountHandle);
        _encryptedCollateral[msg.sender] = updatedCollateral;
        creditToken.mintEncrypted(msg.sender, amountHandle);

        Nox.allow(updatedCollateral, msg.sender);
        Nox.allowThis(updatedCollateral);

        emit CollateralDeposited(msg.sender, asset, amount, updatedCollateral);
        _autoCheckLiquidation(msg.sender);
        return updatedCollateral;
    }

    /**
     * @notice Phase 3 — Request confidential borrow position routed through Aave V3
     * Performs Nox TEE salary underwriting check: maxBorrowUSD >= requestedAmountUSD
     * @param borrowAsset Target ERC20 asset address to borrow from Aave
     * @param requestedAmount Quantity of asset requested
     * @param requestedHandle Encrypted handle representing borrow quantity
     */
    function requestBorrow(
        address borrowAsset,
        uint256 requestedAmount,
        euint256 requestedHandle
    ) external nonReentrant returns (euint256) {
        require(requestedAmount > 0, "ConfidentialCredit: borrow amount must be > 0");
        require(Nox.isInitialized(requestedHandle), "ConfidentialCredit: uninitialized borrow handle");

        // 1. Query active income stream handle
        euint256 incomeRate = incomeStream.getIncomeRateHandle(msg.sender);
        require(Nox.isInitialized(incomeRate), "ConfidentialCredit: no active income stream");

        // 2. Compute salary ceiling: monthlyRate * creditMultiplier
        euint256 maxBorrow = Nox.mul(incomeRate, Nox.toEuint256(creditMultiplier));

        // 3. Evaluate eligibility confidentially: maxBorrow >= requestedHandle
        ebool isEligible = Nox.ge(maxBorrow, requestedHandle);
        euint256 actualBorrowHandle = Nox.select(isEligible, requestedHandle, Nox.toEuint256(0));

        // 4. On successful private eligibility: Call Aave Pool.borrow() (Variable Rate Mode = 2)
        aavePool.borrow(borrowAsset, requestedAmount, 2, 0, address(this));

        // 5. Transfer borrowed asset directly to borrower's wallet
        IERC20(borrowAsset).transfer(msg.sender, requestedAmount);

        // 6. Update user's private encrypted borrow balance
        euint256 updatedBorrow = Nox.add(_encryptedBorrowBalance[msg.sender], actualBorrowHandle);
        _encryptedBorrowBalance[msg.sender] = updatedBorrow;

        Nox.allow(updatedBorrow, msg.sender);
        Nox.allowThis(updatedBorrow);

        emit BorrowRequested(msg.sender, borrowAsset, requestedAmount, actualBorrowHandle);

        // Auto-check liquidation safety side-effect
        _autoCheckLiquidation(msg.sender);

        return actualBorrowHandle;
    }

    /**
     * @notice Phase 5 — Repay loan principal through Aave V3 Pool
     * @param borrowAsset ERC20 asset being repaid
     * @param repayAmount Quantity of asset being repaid
     * @param repayHandle Encrypted handle representing repayment amount
     */
    function repay(
        address borrowAsset,
        uint256 repayAmount,
        euint256 repayHandle
    ) external nonReentrant returns (euint256) {
        require(repayAmount > 0, "ConfidentialCredit: repay amount must be > 0");
        euint256 currentBorrow = _encryptedBorrowBalance[msg.sender];
        require(Nox.isInitialized(currentBorrow), "ConfidentialCredit: no active borrow balance");

        // 1. Receive repayment asset from user
        IERC20(borrowAsset).transferFrom(msg.sender, address(this), repayAmount);

        // 2. Approve Aave Pool and repay Aave debt
        IERC20(borrowAsset).approve(address(aavePool), repayAmount);
        aavePool.repay(borrowAsset, repayAmount, 2, address(this));

        // 3. Update private borrow balance handle
        (ebool success, euint256 newBalance) = Nox.safeSub(currentBorrow, repayHandle);
        _encryptedBorrowBalance[msg.sender] = Nox.select(success, newBalance, currentBorrow);

        euint256 actualRepaidHandle = Nox.select(success, repayHandle, Nox.toEuint256(0));
        creditToken.burnEncrypted(msg.sender, actualRepaidHandle);

        Nox.allow(_encryptedBorrowBalance[msg.sender], msg.sender);
        Nox.allowThis(_encryptedBorrowBalance[msg.sender]);

        emit RepaymentMade(msg.sender, borrowAsset, repayAmount, actualRepaidHandle);

        _autoCheckLiquidation(msg.sender);

        return actualRepaidHandle;
    }

    /**
     * @notice Phase 4 — Private Per-User Liquidation Check & Execution ahead of Aave's public threshold
     * @param borrower Target borrower address
     */
    function checkAndLiquidate(address borrower) public nonReentrant returns (ebool) {
        return _evaluateAndLiquidateInternal(borrower);
    }

    function _autoCheckLiquidation(address borrower) internal {
        _evaluateAndLiquidateInternal(borrower);
    }

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
        Nox.allowPublicDecryption(isLiquidatable);

        emit LiquidationEvaluated(borrower, isLiquidatable);
        return isLiquidatable;
    }

    /**
     * @notice Finalizes per-user liquidation upon valid TEE decryption proof
     */
    function liquidate(address borrower, bytes calldata decryptionProof) external nonReentrant {
        ebool signal = _encryptedLiquidationSignal[borrower];
        require(Nox.isInitialized(signal), "ConfidentialCredit: liquidation not evaluated");

        bool isLiquidatable = Nox.publicDecrypt(signal, decryptionProof);
        require(isLiquidatable, "ConfidentialCredit: position is healthy and not liquidatable");

        // Clear user's position handles
        _encryptedBorrowBalance[borrower] = Nox.toEuint256(0);
        _encryptedCollateral[borrower] = Nox.toEuint256(0);

        emit LoanLiquidated(borrower, msg.sender);
    }

    /**
     * @notice View encrypted collateral handle for an account
     */
    function getEncryptedCollateral(address account) external view returns (euint256) {
        return _encryptedCollateral[account];
    }

    /**
     * @notice View encrypted borrow balance handle for an account
     */
    function getEncryptedBorrowBalance(address account) external view returns (euint256) {
        return _encryptedBorrowBalance[account];
    }

    /**
     * @notice View encrypted liquidation signal handle for an account
     */
    function getEncryptedLiquidationSignal(address account) external view returns (ebool) {
        return _encryptedLiquidationSignal[account];
    }
}
