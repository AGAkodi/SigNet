# SigNet (Nox Private Credit) — Comprehensive Technical Walkthrough

This walkthrough documents the full architecture, pre-build verification steps, critical code review bug fixes, cryptographic safety proofs, and test suite verification for **SigNet** (Nox Private Credit Vault integrated with Aave V3 on Arbitrum Sepolia).

---

## 1. Original Aave Integration Plan & 4 Resolved Pre-Build Verification Gaps

SigNet combines **Aave V3's liquidity pool** on Arbitrum Sepolia with **iExec Nox's TEE confidential coprocessor**. Before contract deployment, 4 critical pre-build verification gaps were identified and resolved:

1. **Liquidation Buffer Math (`SIGNET_LIQUIDATION_THRESHOLD_BPS`)**:
   - Aave V3 USDC/WETH liquidation threshold on Arbitrum Sepolia is **8000 BPS (80.00% LTV)** where Health Factor (HF) = 1.0.
   - SigNet enforces an internal per-user liquidation check at **7500 BPS (75.00% LTV)**.
   - This provides a **1.067 HF safety buffer** relative to Aave's pool-wide liquidation threshold, guaranteeing that underwater private credit positions are unwound internally before Aave's main pool can liquidate the vault's aggregate position.

2. **Verified Chain Addresses (Arbitrum Sepolia)**:
   - Official Aave V3 Pool: `0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff`
   - Official Aave V3 Oracle: `0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00`
   - Official Testnet USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
   - Official Nox Compute Proxy: `0x39847AeBa923Cc7367d4684194091D022B3F8548`

3. **Reentrancy Protection**:
   - OpenZeppelin `ReentrancyGuard` integrated across all fund-moving and state-evaluating functions (`depositCollateral`, `evaluateBorrowEligibility`, `requestBorrow`, `repay`, `checkAndLiquidate`, `liquidate`).

4. **Oracle Denomination Consistency**:
   - Standardized 6-decimal asset unit calculations across USDC collateral/borrow tracking and Aave V3 oracle price feeds.

---

## 2. Resolved Code Review Issues

### Issue 1: Asynchronous TEE Proof Pattern & 2-Transaction Borrowing Fix

- **The Bug**: An early draft attempted a single-transaction borrow pattern where eligibility check and execution occurred synchronously in `requestBorrow()`. Because Nox TEE decryption proofs must be generated off-chain **after** an encrypted handle is initialized on-chain, passing a decryption proof for an uncommitted handle in a single transaction resulted in either unverified execution or unconditional borrowing.
- **The 2-Transaction Architecture Fix**:
  - **Tx 1 — Standalone Evaluation (`evaluateBorrowEligibility`)**:
    - Underwrites employee income stream via `IncomeStream.getIncomeRateHandle()`.
    - Computes `ebool isEligible = Nox.ge(maxBorrow, requestedHandle)`.
    - Stores eligibility state in `_encryptedBorrowEligibility[msg.sender]` and records `_evaluatedBorrowAmount`, `_evaluatedBorrowAsset`, and `_evaluatedBorrowHandle`.
    - Grants public decryption permissions via `Nox.allowPublicDecryption(isEligible)` and emits `BorrowEligibilityEvaluated`.
  - **Tx 2 — Standalone Execution (`requestBorrow`)**:
    - Borrower or off-chain agent requests a TEE decryption proof from the Nox Gateway for `_encryptedBorrowEligibility[msg.sender]`.
    - `requestBorrow` verifies that requested asset and amount match Tx 1 evaluation state.
    - Decrypts eligibility using `Nox.publicDecrypt(signal, eligibilityProof)`.
    - Asserts `require(isEligible, "ConfidentialCredit: requested borrow exceeds salary eligibility ceiling")`.
    - Consumes evaluation state (`_borrowEligibilityEvaluated[msg.sender] = false`).
    - Executes real Aave `pool.borrow()` and transfers ERC20 funds to borrower **only when `isEligible == true`**.

### Issue 2: Real Aave Liquidation Position Unwinding

- **The Bug**: `liquidate()` previously updated internal encrypted handles without unwinding the borrower's underlying Aave collateral and debt positions on the Aave V3 Pool.
- **The Fix**: Updated `liquidate()` to execute real fund unwinding upon valid TEE decryption proof verification:
  1. Withdraws borrower's collateral from Aave: `aavePool.withdraw(collateralAsset, userCollateral, address(this))`.
  2. Repays borrower's debt on Aave using available vault funds: `aavePool.repay(borrowAsset, repayAmount, 2, address(this))`.
  3. Resets plaintext tracking (`_userCollateralAmount`, `_userBorrowAmount`) and encrypted handles (`_encryptedCollateral`, `_encryptedBorrowBalance`) to `0`.

### Issue 3: Removal of Unverified Deposit Overload

- **The Bug**: An unverified raw handle deposit overload (`depositCollateral(address, uint256, euint256)`) allowed arbitrary unverified handle injection.
- **The Fix**: Completely removed the unverified overload. Collateral deposits now strictly require cryptographic input proof verification via `Nox.fromExternal(externalAmount, proof)`.

---

## 3. Liquidation Staleness & Cryptographic Handle Binding Analysis

### Race Condition Scenario
1. Borrower position becomes underwater ($40,000 debt vs $35,000 total capacity).
2. Liquidator calls `checkAndLiquidate(borrower)` (Tx 1). `_encryptedLiquidationSignal[borrower]` is set to `isLiquidatable` (`true` handle). Liquidator requests a decryption proof `oldProof` for this handle from the Nox Gateway.
3. Before liquidator calls `liquidate()` (Tx 2), borrower calls `repay(10000 USDC)` to reduce debt to $30,000 (position becomes healthy).
4. Inside `repay()`, `_autoCheckLiquidation(borrower)` is automatically called, re-evaluating liquidation signal to `false` and overwriting `_encryptedLiquidationSignal[borrower]` with a fresh signal handle.
5. Liquidator attempts `liquidate(borrower, oldProof)`.

### Why It Correctly Reverts (Two-Layer Defense)

1. **Cryptographic Proof Binding in Nox Protocol**:
   - As documented in Nox Protocol's `INoxCompute.sol`:
     ```solidity
     /**
      * Validates the decryption proof issued by the gateway for a given handle.
      * The proof must be signed by the configured gateway.
      *
      * The proof uses a compact serialization: `signature (65 bytes) || decryptedResult (N bytes)`.
      * The signature is placed first (fixed size) so that `decryptedResult` can be variable-length,
      * supporting all current and future types that may exceed 32 bytes (e.g. encrypted strings).
      *
      * @param handle Handle to decrypt
      * @param decryptionProof Compact proof: `signature (65 bytes) || decryptedResult (N bytes)`
      * @return decryptedResult The decrypted value extracted from the proof if the proof is valid,
      * or reverts otherwise
      */
     function validateDecryptionProof(
         bytes32 handle,
         bytes calldata decryptionProof
     ) external view returns (bytes memory);
     ```
   - Decryption proof signatures are computed over `(bytes32 handle, bytes decryptedResult)`.
   - When `Nox.publicDecrypt(signal, decryptionProof)` is called in `liquidate()`, it passes `signal` (the **NEW** overwritten handle) to `validateDecryptionProof(newHandle, oldProof)`.
   - Because `oldProof` was signed for `oldHandle`, signature verification produces a hash mismatch, reverting with `InvalidProof`.

2. **On-Chain Contract State Check**:
   - Even if proof validation were bypassed, `_encryptedLiquidationSignal[borrower]` was overwritten with `false`.
   - `Nox.publicDecrypt` decrypts the new signal to `false`.
   - `require(isLiquidatable, "ConfidentialCredit: position is healthy and not liquidatable")` reverts immediately.

---

## 4. Final Test Suite Verification

Both Foundry (`forge test`) and Hardhat (`npx hardhat test`) suites were executed and verified directly with raw CLI output.

### 1. Foundry Test Suite (`ConfidentialCredit.t.sol`)
```text
Ran 12 tests for test/ConfidentialCredit.t.sol:ConfidentialCreditTest
[PASS] test_DepositCollateral_RoutesToAavePool() (gas: 323061)
[PASS] test_IncomeStreamLifecycle() (gas: 244395)
[PASS] test_LiquidationFlow_HealthyPositionNotLiquidatable() (gas: 801334)
[PASS] test_LiquidationFlow_UnwindsRealAavePositionWhenUnderwater() (gas: 905179)
[PASS] test_Liquidation_RevertsIfUserRepaysAndBecomesHealthyBeforeLiquidate() (gas: 1009024)
[PASS] test_Liquidation_RevertsWhenHealthy() (gas: 813970)
[PASS] test_RepayLoan_RoutesToAavePool() (gas: 865906)
[PASS] test_RequestBorrow_RejectedWhenOverCeiling_NoRealFundsTransferred() (gas: 649852)
[PASS] test_RequestBorrow_RevertWithoutPriorEvaluationTx1() (gas: 326459)
[PASS] test_RequestBorrow_RevertsWhenAmountMismatchBetweenTx1AndTx2() (gas: 673765)
[PASS] test_RequestBorrow_TwoSeparateTransactions_Success() (gas: 797161)
[PASS] test_TokenDeployment() (gas: 24456)
Suite result: ok. 12 passed; 0 failed; 0 skipped; finished in 9.52ms
```

### 2. Hardhat Test Suite (`ConfidentialCredit.test.js`)
```text
  Nox Private Credit — Real Aave V3 Comprehensive Suite
    1. Token Metadata & IncomeStream Lifecycle
      √ should initialize token metadata correctly (111ms)
      √ should create income stream, verify initial zero balance, and claim accrued salary after 30 days
    2. Verified Collateral Deposit
      √ should deposit collateral with input proof and supply to Aave Pool
    3. Strict 2-Transaction Salary-Gated Borrowing
      √ should borrow from Aave Pool using two separate transactions (Tx 1: Evaluate, Tx 2: Execute)
      √ should REVERT when Tx 2 requested amount does not match Tx 1 evaluated amount (95ms)
      √ should REVERT over-ceiling borrow request in Tx 2 and transfer NO real Aave funds
      √ should REVERT borrow request in Tx 2 if Tx 1 was not called first
    4. Repayment & Unwound Real Aave Liquidation
      √ should repay Aave debt through vault
      √ should NOT trigger liquidation on a healthy position
      √ should REVERT liquidation call on a healthy position
      √ should trigger liquidation AND unwind real Aave collateral/debt when position is underwater (39ms)
      √ should REVERT liquidate() when borrower repays and becomes healthy between checkAndLiquidate (Tx 1) and liquidate (Tx 2) (43ms)

  12 passing (8s)
```
