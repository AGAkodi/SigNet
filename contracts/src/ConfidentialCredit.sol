// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import "./IncomeStream.sol";
import "./ERC7984CreditToken.sol";

/**
 * @title ConfidentialCredit
 * @notice Confidential Lending Pool Contract using Nox TEE handles & ACL-scoped disclosures.
 * Underwrites confidential borrowing against private salary streams (`IncomeStream.sol`).
 * Neither salary rate nor borrow position size is ever exposed on-chain.
 *
 * =========================================================================================
 * IMPLEMENTATION & DEVIATION NOTICE:
 * 1. Real Nox TEE Operations: Encrypted handles (`euint256` and `ebool`) are computed inside
 *    Nox TEE enclaves. All comparisons (underwriting check, health factor evaluation) are executed
 *    using real Nox primitives (`Nox.ge`, `Nox.mul`, `Nox.add`, `Nox.select`, `Nox.publicDecrypt`).
 * 2. Gated Borrowing: `requestBorrow()` gates token minting on encrypted TEE comparison
 *    results via `Nox.select`. If the requested borrow exceeds income capacity, 0 tokens are minted.
 * 3. Derived Liquidation Status: Liquidation eligibility is evaluated on-chain via `evaluateLiquidation()`
 *    comparing total capacity against borrow principal. Admin flags are NOT permitted to override.
 * =========================================================================================
 */
contract ConfidentialCredit {
    // Contract References
    IncomeStream public immutable incomeStream;
    ERC7984CreditToken public immutable creditToken;

    address public owner;

    // Credit Parameters
    // CREDIT_MULTIPLIER = 6 represents underwriting a 6-month forward salary ceiling for short-to-medium credit positions.
    uint256 public immutable creditMultiplier;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8000; // 80% LTV equivalent

    // Encrypted Position Handles
    mapping(address => euint256) private _encryptedCollateral;
    mapping(address => euint256) private _encryptedBorrowBalance;
    mapping(address => ebool) private _encryptedLiquidationSignal;

    // Events
    event CollateralDeposited(address indexed borrower, euint256 encryptedCollateralHandle);
    event BorrowRequested(address indexed borrower, euint256 encryptedBorrowHandle);
    event RepaymentMade(address indexed borrower, euint256 encryptedRepayHandle);
    event LiquidationEvaluated(address indexed borrower, ebool liquidationSignalHandle);
    event LoanLiquidated(address indexed borrower, address indexed liquidator);

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialCredit: caller is not owner");
        _;
    }

    constructor(address _incomeStream, address _creditToken, uint256 _multiplier) {
        require(_incomeStream != address(0), "ConfidentialCredit: invalid IncomeStream address");
        require(_creditToken != address(0), "ConfidentialCredit: invalid CreditToken address");
        incomeStream = IncomeStream(_incomeStream);
        creditToken = ERC7984CreditToken(_creditToken);
        creditMultiplier = _multiplier > 0 ? _multiplier : 6;
        owner = msg.sender;
    }

    /**
     * @notice Deposit encrypted collateral using input proof validation
     * @param externalAmount External encrypted handle input
     * @param proof Cryptographic TEE input proof
     */
    function depositCollateral(externalEuint256 externalAmount, bytes calldata proof) external returns (euint256) {
        euint256 amount = Nox.fromExternal(externalAmount, proof);
        return _depositCollateralInternal(amount);
    }

    /**
     * @notice Deposit encrypted collateral using an existing euint256 handle
     * @param amount Encrypted collateral handle (euint256)
     */
    function depositCollateral(euint256 amount) external returns (euint256) {
        require(Nox.isInitialized(amount), "ConfidentialCredit: uninitialized collateral handle");
        return _depositCollateralInternal(amount);
    }

    function _depositCollateralInternal(euint256 amount) internal returns (euint256) {
        euint256 updatedCollateral = Nox.add(_encryptedCollateral[msg.sender], amount);
        _encryptedCollateral[msg.sender] = updatedCollateral;

        Nox.allow(updatedCollateral, msg.sender);
        Nox.allowThis(updatedCollateral);

        emit CollateralDeposited(msg.sender, updatedCollateral);
        return updatedCollateral;
    }

    /**
     * @notice Request confidential borrow position underwritten by salary stream
     * Performs real Nox TEE comparison: borrow capacity = incomeRate * multiplier >= requestedBorrow
     * @param externalRequestedAmount External encrypted handle input
     * @param proof Cryptographic TEE input proof
     */
    function requestBorrow(
        externalEuint256 externalRequestedAmount,
        bytes calldata proof
    ) external returns (euint256) {
        euint256 requestedAmount = Nox.fromExternal(externalRequestedAmount, proof);
        return _requestBorrowInternal(requestedAmount);
    }

    /**
     * @notice Request confidential borrow position using an existing euint256 handle
     * @param requestedAmount Encrypted requested amount handle (euint256)
     */
    function requestBorrow(euint256 requestedAmount) external returns (euint256) {
        require(Nox.isInitialized(requestedAmount), "ConfidentialCredit: uninitialized borrow handle");
        return _requestBorrowInternal(requestedAmount);
    }

    function _requestBorrowInternal(euint256 requestedAmount) internal returns (euint256) {
        // Query active income stream handle
        euint256 incomeRate = incomeStream.getIncomeRateHandle(msg.sender);
        require(Nox.isInitialized(incomeRate), "ConfidentialCredit: no active income stream");

        // Calculate maximum borrow ceiling = monthlyRate * creditMultiplier
        euint256 maxBorrow = Nox.mul(incomeRate, Nox.toEuint256(creditMultiplier));

        // Evaluate eligibility confidentially: maxBorrow >= requestedAmount
        ebool isEligible = Nox.ge(maxBorrow, requestedAmount);

        // Gate minting: if eligible -> requestedAmount, else -> 0
        euint256 actualBorrow = Nox.select(isEligible, requestedAmount, Nox.toEuint256(0));

        // Update borrow balance
        euint256 updatedBorrow = Nox.add(_encryptedBorrowBalance[msg.sender], actualBorrow);
        _encryptedBorrowBalance[msg.sender] = updatedBorrow;

        // Mint credit tokens
        creditToken.mintEncrypted(msg.sender, actualBorrow);

        // Grant access permissions
        Nox.allow(updatedBorrow, msg.sender);
        Nox.allowThis(updatedBorrow);

        emit BorrowRequested(msg.sender, actualBorrow);
        return actualBorrow;
    }

    /**
     * @notice Repay loan principal using encrypted Nox handles
     * @param externalRepayAmount External encrypted handle input
     * @param proof Cryptographic TEE input proof
     */
    function repay(externalEuint256 externalRepayAmount, bytes calldata proof) external returns (euint256) {
        euint256 repayAmount = Nox.fromExternal(externalRepayAmount, proof);
        return _repayInternal(repayAmount);
    }

    /**
     * @notice Repay loan principal using an existing euint256 handle
     * @param repayAmount Encrypted repayment handle (euint256)
     */
    function repay(euint256 repayAmount) external returns (euint256) {
        require(Nox.isInitialized(repayAmount), "ConfidentialCredit: uninitialized repay handle");
        return _repayInternal(repayAmount);
    }

    function _repayInternal(euint256 repayAmount) internal returns (euint256) {
        euint256 currentBorrow = _encryptedBorrowBalance[msg.sender];
        require(Nox.isInitialized(currentBorrow), "ConfidentialCredit: no active borrow balance");

        (ebool success, euint256 newBalance) = Nox.safeSub(currentBorrow, repayAmount);
        _encryptedBorrowBalance[msg.sender] = Nox.select(success, newBalance, currentBorrow);

        euint256 actualRepaid = Nox.select(success, repayAmount, Nox.toEuint256(0));
        creditToken.burnEncrypted(msg.sender, actualRepaid);

        Nox.allow(_encryptedBorrowBalance[msg.sender], msg.sender);
        Nox.allowThis(_encryptedBorrowBalance[msg.sender]);

        emit RepaymentMade(msg.sender, actualRepaid);
        return actualRepaid;
    }

    /**
     * @notice Evaluates liquidation eligibility on-chain by comparing borrow principal against collateral + income capacity
     * @param borrower Address of target borrower
     */
    function evaluateLiquidation(address borrower) external returns (ebool) {
        euint256 collateral = _encryptedCollateral[borrower];
        euint256 borrow = _encryptedBorrowBalance[borrower];
        euint256 incomeRate = incomeStream.getIncomeRateHandle(borrower);

        euint256 incomeSupport = Nox.mul(incomeRate, Nox.toEuint256(creditMultiplier));
        euint256 totalCapacity = Nox.add(collateral, incomeSupport);

        // Position is liquidatable if borrow balance exceeds total capacity
        ebool isLiquidatable = Nox.gt(borrow, totalCapacity);

        _encryptedLiquidationSignal[borrower] = isLiquidatable;
        Nox.allowPublicDecryption(isLiquidatable);

        emit LiquidationEvaluated(borrower, isLiquidatable);
        return isLiquidatable;
    }

    /**
     * @notice Liquidates an underwater position based strictly on TEE public decryption proof
     * @param borrower Address of borrower to liquidate
     * @param decryptionProof Cryptographic TEE decryption proof verifying `liquidatable == true`
     */
    function liquidate(address borrower, bytes calldata decryptionProof) external {
        ebool signal = _encryptedLiquidationSignal[borrower];
        require(Nox.isInitialized(signal), "ConfidentialCredit: liquidation not evaluated");

        bool isLiquidatable = Nox.publicDecrypt(signal, decryptionProof);
        require(isLiquidatable, "ConfidentialCredit: position is healthy and not liquidatable");

        // Clear borrow position and collateral handles
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
