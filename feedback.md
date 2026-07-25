# SigNet (Nox Private Credit) — Integration Feedback & Friction Points

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
