# SIGNET — Integration Feedback & Friction Points

This document tracks developer experience observations, architectural design decisions, and feedback hit during the implementation of **SigNet** on Arbitrum Sepolia.

---

## 1. Real Aave V3 Integration & Public/Private Boundary
- **Architectural Boundary**: Collateral custody, interest accrual, and liquidity routing are handled directly by Aave V3's official Pool (`0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff`). SigNet adds a private TEE layer on top for salary-based underwriting and encrypted entitlement claims (`ERC7984CreditToken.sol`).
- **Buffered Liquidation Design (`SIGNET_LIQUIDATION_THRESHOLD_BPS`)**: Because Aave liquidates at the vault pool level (8000 BPS / 80% LTV), SigNet enforces an internal per-user liquidation check at 7500 BPS (75% LTV; 1.067 Health Factor buffer). This resolves individual default risks internally before Aave's pool-wide liquidation threshold can ever be reached.

---

## 2. Tooling & Environment Setup
- **Reentrancy Protection**: Integrated OpenZeppelin `ReentrancyGuard` across all fund-moving and liquidation entry points (`depositCollateral`, `requestBorrow`, `repay`, `checkAndLiquidate`).
- **Local Dev Chain Coprocessor Mocking**: On local dev chain 31337, calling `Nox.sol` primitives requires pre-deploying bytecode to `0x39847AeBa923Cc7367d4684194091D022B3F8548`. Created `MockNoxCompute.sol` and `MockAavePool.sol` to support 100% offline testing with Hardhat and Foundry.

---

## 3. Smart Contracts & Confidentiality Protocols
- **ERC7984 Wrapper Token**: `ERC7984CreditToken.sol` mints and burns `euint256` encrypted handles representing user proportional entitlement claims on the vault's pooled Aave position.
- **On-Chain Accrual & Gated Borrow Minting**: Using `Nox.select(isEligible, requestedAmount, Nox.toEuint256(0))` ensures minting operations strictly respect TEE comparison outcomes without exposing loan magnitudes on-chain.

---

## 4. Nox SDK & Calldata Obfuscation
- **Calldata Obfuscation**: Client-side handle generation in `noxSdk.ts` uses Keccak-256 salted handle commitments over salary value, 256-bit entropy, user address, and domain separator. Calldata submitted to `createStream()` on Arbiscan is a 32-byte cryptographic hash rather than zero-padded plaintext hex (`0x1f40`).
- **Wax Seal Decryption UX**: Masking encrypted balance handles as interactive wax-seal badges provides intuitive trust feedback while signaling that numbers are sealed via Nox TEE access control.

---

## 5. Architectural Lesson: Asynchronous TEE Proof Lifecycle vs. Synchronous Smart Contracts

A fundamental insight from building SigNet is the **architectural boundary between on-chain TEE computation and off-chain decryption proof generation**:

- **The Myth (Synchronous Pattern)**: Developers familiar with traditional EVM or zero-knowledge SNARK verifiers might expect a single-transaction flow:
  ```solidity
  // IMPOSSIBLE ANTI-PATTERN IN TEE COPROCESSORS:
  function requestBorrowSingleTx(address asset, uint256 amount, bytes calldata proof) external {
      ebool isEligible = Nox.ge(maxBorrow, Nox.toEuint256(amount));
      // FAILS: Decryption proof for `isEligible` handle CANNOT exist off-chain
      // before `isEligible` is created and emitted on-chain in this transaction!
      bool ok = Nox.publicDecrypt(isEligible, proof);
      require(ok, "Ineligible");
      aavePool.borrow(asset, amount, 2, 0, msg.sender);
  }
  ```
- **The Reality (Async 2-Transaction Pattern)**: Because Nox TEE coprocessor handles are generated dynamically on-chain during EVM execution, an off-chain gateway/worker cannot generate a valid EIP-712 decryption proof for a handle until **after** that handle has been stored on-chain in a prior transaction.
- **The Correct 2-Transaction Design**:
  ```solidity
  // TRANSACTION 1: Evaluate & Store Handle
  function evaluateBorrowEligibility(address borrowAsset, uint256 requestedAmount, ...) external returns (ebool) {
      ebool isEligible = Nox.ge(maxBorrow, requestedHandle);
      _encryptedBorrowEligibility[msg.sender] = isEligible;
      _borrowEligibilityEvaluated[msg.sender] = true;
      Nox.allowPublicDecryption(isEligible);
      return isEligible;
  }

  // TRANSACTION 2: Verify Off-Chain TEE Proof & Execute
  function requestBorrow(address borrowAsset, uint256 requestedAmount, bytes calldata eligibilityProof) external {
      require(_borrowEligibilityEvaluated[msg.sender], "Not evaluated");
      ebool signal = _encryptedBorrowEligibility[msg.sender];
      bool isEligible = Nox.publicDecrypt(signal, eligibilityProof);
      require(isEligible, "Ineligible");
      _borrowEligibilityEvaluated[msg.sender] = false;
      aavePool.borrow(borrowAsset, requestedAmount, 2, 0, address(this));
  }
  ```
- **Takeaway for Future Builders**: Any protocol requiring public decryption of TEE computation results MUST structure its smart contract flow as a 2-transaction state-machine (Tx 1: Evaluate & Emit ACL; Tx 2: Decrypt Proof & Execute Action).

---

## 6. Aave V3 Address Discovery & Network Registry Friction

- **Network Configuration Trap**: Address discovery for Aave V3 across testnets (Arbitrum Sepolia vs. Base Sepolia vs. Ethereum Sepolia) can be error-prone when relying on forum posts or outdated blog tutorials, which often reference Arbitrum One mainnet contracts (e.g. Pool `0x794a61358D6845594F94dc1DB02A252b5b4814aD`) instead of Arbitrum Sepolia (`0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff`).
- **Best Practice**: Always use the official `@aave/aave-address-book` npm package or official Aave V3 documentation deployed contract address tables as the single source of truth for pool, oracle, and asset address resolution.

---

## 7. Nox Tooling, SDK & Hardhat Environment Friction

- **Hardhat/Foundry Mocking**: Standard local test environments (e.g., Hardhat Network chain 31337 or Forge `anvil`) lack native TEE KMS coprocessors. Testing contract logic requires intercepting low-level Nox Compute library calls by deploying a contract mock to `0x39847AeBa923Cc7367d4684194091D022B3F8548` via `hardhat_setCode` or `vm.etch`.
- **Client-Side Handle Commitments**: `noxSdk.ts` implements client-side cryptographic handle commitments (Keccak256 over raw value, random 256-bit salt, user address, and domain tag) to shield sensitive salary numbers from being leaked as hex strings in Arbiscan calldata.
- **Documentation Gaps**: The Nox SDK documentation would benefit from adding explicit sequence diagrams illustrating the 2-transaction public decryption workflow to help protocol developers avoid the single-transaction anti-pattern.

---

## 8. Lesson 1 — Transient vs. Persistent ACL Access Across Multi-Transaction Flows

In Nox's asynchronous TEE proof model, workflows requiring public decryption of intermediate results (such as salary eligibility evaluation) are split across two separate transactions (Transaction 1: `evaluateBorrowEligibility`, Transaction 2: `requestBorrow`). 

During live integration on Arbitrum Sepolia, we discovered a subtle ACL boundary condition:
- **The Issue**: In Transaction 1 (`evaluateBorrowEligibility`), `requestedHandle` was created via `Nox.fromExternal(externalRequestedAmount, inputProof)` and evaluated against `maxBorrow`. `validateInputProof` granted `ConfidentialCredit` transient ACL access to `requestedHandle` for the duration of Transaction 1. However, when Transaction 1 finalized, this transient access expired. In Transaction 2 (`requestBorrow`), when the vault attempted to update `_encryptedBorrowBalance[msg.sender]` using `requestedHandle`, the `NoxCompute` coprocessor threw `UnauthorizedSender(address)` (`0x3fcc3f17`) because the contract no longer possessed persistent access to `requestedHandle`.
- **The Fix**: In `evaluateBorrowEligibility`, we added an explicit persistent permission grant: `Nox.allowThis(requestedHandle);`. This persisted the vault's access right into state storage across transaction boundaries.
- **Protocol Documentation Recommendation**: Nox's documentation and SDK guides should explicitly highlight that handles created or received in Transaction 1 require persistent grants (`Nox.allowThis(handle)`) if they are to be consumed or stored in state by the contract during Transaction 2.

---

## 9. Lesson 2 — Handle Initialization Ordering & Cross-Contract ACL Delegation

During contract implementation and testing of `ERC7984CreditToken.sol` and `ConfidentialCredit.sol`, two related handle management bugs surfaced:

1. **Uninitialized Supply Handles & `NonArithmeticType` Reverts**:
   - **Bug**: Initializing a total-supply handle in constructor logic via `$._totalSupply = Nox.toEuint256(0);` created a public handle. When the first collateral deposit occurred, calling `Nox.add(_totalSupply, amountHandle)` caused the `NoxCompute` coprocessor to revert with `NonArithmeticType()` (`0xf645eedf`) because arithmetic type validation failed on the pre-initialized zero handle.
   - **Fix**: Left `_totalSupply` uninitialized (`bytes32(0)`). The initial mint directly assigns `_totalSupply = amountHandle`, avoiding zero-handle addition.

2. **Cross-Contract Handle Delegation & `NotAllowed` Reverts**:
   - **Bug**: In `repay()`, `ConfidentialCredit` executed `creditToken.burnEncrypted(msg.sender, actualRepaidHandle)`. Inside `burnEncrypted`, the token contract called `Nox.burn(balanceFrom, amount, totalSupply)`. The transaction reverted with `NotAllowed(handle, creditToken)` (`0xb87a12a9`) because `ConfidentialCredit` had called `Nox.allowThis(actualRepaidHandle)` (granting access to the vault) but failed to grant transient access to the token contract.
   - **Fix**: Added `Nox.allowTransient(actualRepaidHandle, address(creditToken));` prior to invoking `creditToken.burnEncrypted(...)`.
- **Protocol Documentation Recommendation**: The Nox SDK docs would benefit immensely from a cheat-sheet matrix detailing which ACL primitive (`Nox.allow`, `Nox.allowThis`, `Nox.allowTransient`, `Nox.allowPublicDecryption`) is required for each specific pattern:
  - **Same-Contract Operations**: `Nox.allowThis(handle)`
  - **Cross-Contract Delegation (Vault → Token)**: `Nox.allowTransient(handle, targetContract)`
  - **Multi-Transaction Persistence (Tx 1 → Tx 2)**: `Nox.allowThis(handle)` prior to storage
  - **Public Signal Emission**: `Nox.allowPublicDecryption(handle)`

