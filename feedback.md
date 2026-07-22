# Nox Private Credit — Hackathon Feedback & Friction Points

This document tracks friction points, developer experience observations, and suggestions hit during the implementation of Nox Private Credit on Arbitrum Sepolia and local chain 31337.

---

## 1. Tooling & Setup
- **Type Import Mismatches**: `externalEuint256` defined in `encrypted-types/EncryptedTypes.sol` and re-exported by `Nox.sol` requires explicit user-defined type conversions when interfacing between `IERC7984` and `Nox.sol` SDK helper functions.
- **Local Dev Chain Coprocessor Mocking**: On local development chains (Chain ID 31337), calling `Nox.sol` primitives without pre-deploying code to `0x39847AeBa923Cc7367d4684194091D022B3F8548` causes raw EVM reverts (`function returned an unexpected amount of data`). We created `MockNoxCompute.sol` and used `vm.etch`/`hardhat_setCode` to support offline testing.

## 2. Smart Contracts & Confidentiality Protocols
- **ERC7984 Upgradeability & Storage Layout**: Inheriting from `ERC7984Base` uses OpenZeppelin ERC-7201 namespaced storage slots (`_getERC7984Storage()`). Developers must call `__ERC7984Base_init` properly in custom token wrappers.
- **On-Chain Accrual Operations**: Implementing `claimEarnedSalary` required chaining `Nox.mul(monthlyRate, elapsedSeconds)` and `Nox.add` to guarantee that stream accruals are calculated deterministically on-chain rather than accepting arbitrary user-supplied handles.
- **Gated Borrow Minting**: Using `Nox.select(isEligible, requestedAmount, Nox.toEuint256(0))` ensures that minting operations strictly respect TEE comparison outcomes without exposing position magnitudes.

## 3. Nox SDK Integration
- **Off-Chain ECIES Gateway SDK**: Client-side handle preparation requires an off-chain gateway SDK for KMS ECIES encryption. In offline environments without a live KMS gateway, frontend handle generation stubs must be clearly documented to differentiate client preparation from on-chain TEE processing.
- **ACL Permission Synchronization**: Functions like `allowThis(handle)` and `allow(handle, borrower)` must be invoked after every arithmetic handle update (`Nox.add`, `Nox.select`), otherwise downstream contract functions revert with `NotAllowed`.

## 4. Frontend & UX
- **Syntax Compatibility**: Standardized SDK imports to ESM syntax (`import { ethers } from "ethers"`).
- **Wax Seal Decryption UX**: Masking encrypted balance handles as interactive wax-seal badges provides intuitive trust feedback while signaling that numbers are sealed via Nox TEE access control.
