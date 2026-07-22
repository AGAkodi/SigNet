// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IncomeStream.sol";
import "./ERC7984CreditToken.sol";

/**
 * @title ConfidentialCredit
 * @notice Confidential Lending Pool Contract using Nox TEE handles & ACL-scoped disclosures.
 * Underwrites confidential Aave-style borrowing against private salary streams (`IncomeStream.sol`).
 * Neither salary rate nor borrow position size is ever exposed on-chain.
 *
 * =========================================================================================
 * DEVIATION NOTICE (Aave V3 Protocol Mocking vs. Live Pools for Hackathon Scope):
 * 1. Single Asset Vault: Aave V3 manages multi-reserve pools (wETH, USDC, wBTC) with dynamic interest
 *    rate curves (ReserveData structs). We simplify to a unified confidential credit pool to keep
 *    FHE & Nox TEE evaluation deterministic and gas-efficient on Arbitrum Sepolia.
 * 2. Interest Index Calculation: Real Aave updates variableBorrowIndex continuously on every block.
 *    We mock interest accrual within TEE computations using fixed multiplier factors (e.g. 6x income).
 * 3. Confidential Health Factor & Liquidation: Aave V3 exposes health factors publicly on-chain
 *    (e.g., HF = 1.05). ConfidentialCredit computes the health factor inside Nox TEE and reveals
 *    ONLY an ACL-scoped boolean `liquidatable` (true/false) to liquidators, hiding exact position sizes.
 * =========================================================================================
 */
contract ConfidentialCredit {
    // Contract References
    IncomeStream public immutable incomeStream;
    ERC7984CreditToken public immutable creditToken;

    address public owner;

    // Credit Parameters
    uint256 public constant CREDIT_MULTIPLIER = 6; // Borrow ceiling = 6x monthly salary
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8000; // 80% LTV threshold

    // Confidential Position State Handles (bytes32 Nox handles representing euint64)
    mapping(address => bytes32) private _encryptedCollateral;
    mapping(address => bytes32) private _encryptedBorrowBalance;
    mapping(address => bytes32) private _encryptedLiquidationSignal; // Encrypted boolean handle (ebool)

    // Unlocked ACL Disclosures (borrower => plaintext bool liquidation status for liquidator role)
    mapping(address => bool) private _publicLiquidationStatus;

    // Events
    event CollateralDeposited(address indexed borrower, bytes32 encryptedCollateralHandle);
    event BorrowRequested(address indexed borrower, bytes32 encryptedBorrowHandle, bytes32 eligibilitySignalHandle);
    event RepaymentMade(address indexed borrower, bytes32 encryptedRepayHandle);
    event LiquidationEvaluated(address indexed borrower, bytes32 liquidationSignalHandle, bool isLiquidatable);
    event LoanLiquidated(address indexed borrower, address indexed liquidator);

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialCredit: caller is not owner");
        _;
    }

    constructor(address _incomeStream, address _creditToken) {
        require(_incomeStream != address(0), "Invalid IncomeStream address");
        require(_creditToken != address(0), "Invalid CreditToken address");
        incomeStream = IncomeStream(_incomeStream);
        creditToken = ERC7984CreditToken(_creditToken);
        owner = msg.sender;
    }

    /**
     * @notice Deposit encrypted collateral handle into the credit vault
     * @param encryptedCollateralHandle Encrypted collateral handle (euint64)
     */
    function depositCollateral(bytes32 encryptedCollateralHandle) external {
        require(encryptedCollateralHandle != bytes32(0), "Invalid collateral handle");
        _encryptedCollateral[msg.sender] = encryptedCollateralHandle;
        emit CollateralDeposited(msg.sender, encryptedCollateralHandle);
    }

    /**
     * @notice Request confidential borrow position underwritten by salary stream
     * @param encryptedRequestedBorrow Encrypted borrow amount requested (euint64)
     * @param encryptedEligibilitySignal TEE-computed eligibility handle (ebool)
     */
    function requestBorrow(
        bytes32 encryptedRequestedBorrow,
        bytes32 encryptedEligibilitySignal
    ) external {
        require(encryptedRequestedBorrow != bytes32(0), "Invalid borrow handle");

        // Verify active income stream exists
        bytes32 incomeRateHandle = incomeStream.getIncomeRateHandle(msg.sender);
        require(incomeRateHandle != bytes32(0), "No active income stream found");

        // Record encrypted borrow position handle
        _encryptedBorrowBalance[msg.sender] = encryptedRequestedBorrow;

        // Mint encrypted credit tokens to borrower
        creditToken.mintEncrypted(msg.sender, encryptedRequestedBorrow);

        emit BorrowRequested(msg.sender, encryptedRequestedBorrow, encryptedEligibilitySignal);
    }

    /**
     * @notice Repay an active confidential borrow position
     * @param encryptedRepayHandle Encrypted repayment amount (euint64)
     * @param updatedBorrowHandle Encrypted updated balance handle after repayment
     */
    function repay(bytes32 encryptedRepayHandle, bytes32 updatedBorrowHandle) external {
        require(encryptedRepayHandle != bytes32(0), "Invalid repay handle");

        // Update encrypted borrow position
        _encryptedBorrowBalance[msg.sender] = updatedBorrowHandle;

        // Burn encrypted credit tokens from borrower
        creditToken.burnEncrypted(msg.sender, encryptedRepayHandle);

        emit RepaymentMade(msg.sender, encryptedRepayHandle);
    }

    /**
     * @notice Evaluates & updates confidential liquidation status via Nox TEE coprocessor
     * @param borrower Target borrower address
     * @param encryptedLiquidationSignal TEE-computed liquidation signal handle (ebool)
     * @param isLiquidatable Disclosed boolean signal (true/false) for liquidator action
     */
    function setLiquidationStatus(
        address borrower,
        bytes32 encryptedLiquidationSignal,
        bool isLiquidatable
    ) external onlyOwner {
        require(borrower != address(0), "Invalid borrower address");

        _encryptedLiquidationSignal[borrower] = encryptedLiquidationSignal;
        _publicLiquidationStatus[borrower] = isLiquidatable;

        emit LiquidationEvaluated(borrower, encryptedLiquidationSignal, isLiquidatable);
    }

    /**
     * @notice Liquidates an underwater position based strictly on the disclosed boolean signal
     * @param borrower Address of borrower to liquidate
     */
    function liquidate(address borrower) external {
        require(_publicLiquidationStatus[borrower], "ConfidentialCredit: position is not liquidatable");

        // Clear borrow position handle and collateral handle upon liquidation
        _encryptedBorrowBalance[borrower] = bytes32(0);
        _encryptedCollateral[borrower] = bytes32(0);
        _publicLiquidationStatus[borrower] = false;

        emit LoanLiquidated(borrower, msg.sender);
    }

    /**
     * @notice View encrypted collateral handle for an account
     */
    function getEncryptedCollateral(address account) external view returns (bytes32) {
        return _encryptedCollateral[account];
    }

    /**
     * @notice View encrypted borrow balance handle for an account
     */
    function getEncryptedBorrowBalance(address account) external view returns (bytes32) {
        return _encryptedBorrowBalance[account];
    }

    /**
     * @notice View disclosed liquidation status boolean (liquidators access this boolean only)
     */
    function getLiquidationStatus(address account) external view returns (bool) {
        return _publicLiquidationStatus[account];
    }
}
