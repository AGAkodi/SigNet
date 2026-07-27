# SigNet — System Architecture & Design Specification

## 1. Overview & Core Mission
**SIGNET** is an institutional-grade, privacy-preserving credit layer built on Arbitrum Sepolia. It integrates directly with **Aave V3** liquidity pools while placing a **Nox TEE (Trusted Execution Environment)** private underwriting and credit-risk layer on top.

Neither the user's monthly salary rate nor their private loan entitlement position is exposed on-chain. All salary underwriting evaluations and internal credit health checks are computed confidentially via **Nox TEE** handles and ACL-scoped disclosures.

---

## 2. System Architecture & Aave V3 Integration

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (Next.js + Wagmi + Nox SDK)"]
        User["Borrower Wallet"]
        SDK["Nox JS SDK\n(Salted Handle Commitment)"]
    end

    subgraph SigNet ["SigNet On-Chain Contracts (Arbitrum Sepolia)"]
        IS["IncomeStream.sol\n(Confidential Payroll Stream)"]
        CC["ConfidentialCredit.sol\n(Vault + ReentrancyGuard)"]
        TOKEN["ERC7984CreditToken.sol\n(Encrypted Entitlement Claim)"]
    end

    subgraph AaveV3 ["Aave V3 Protocol (Arbitrum Sepolia)"]
        POOL["Aave Pool Proxy\n(0xBfC91D59...)"]
        ORACLE["Aave Price Oracle\n(0xEf95A6B9...)"]
    end

    subgraph NoxTEE ["Nox TEE Coprocessor"]
        TEE["TEE Execution Enclave\n(Nox Primitives: Nox.ge, Nox.gt)"]
    end

    User -->|1. Submit salary & deposit collateral| SDK
    SDK -->|2. Create stream & deposit| CC
    CC -->|3. Real Aave Pool.supply()| POOL
    CC -->|4. Mint encrypted claim token| TOKEN
    CC <-->|5. Private underwriting check: maxBorrowUSD >= requestedUSD| TEE
    POOL <-->|6. Fetch 8-decimal asset pricing| ORACLE
    CC -->|7. Real Aave Pool.borrow()| POOL
    POOL -->|8. Transfer borrowed asset| User
```

---

## 3. Honest Public vs. Private Boundary

| Feature / Metric | Public On-Chain Layer (Aave V3) | Private TEE Layer (SigNet Nox Engine) |
| :--- | :--- | :--- |
| **Collateral Custody** | Real ERC20 supply to Aave Pool (`0xBfC91D59...`) | User's encrypted proportional claim handle (`_encryptedCollateral`) |
| **Borrow Execution** | Real Aave Pool `borrow()` (Variable Rate Mode) | Nox TEE salary underwriting check (`maxBorrowUSD >= requestedAmountUSD`) |
| **Token Entitlement** | Public aToken balance held by SigNet Vault | Encrypted `ERC7984CreditToken` mint representing user claim |
| **Liquidation Engine** | Aave Pool-wide Liquidation (8000 BPS / 80% LTV) | SigNet Per-User Buffered Liquidation (7500 BPS / 75% LTV; 1.067 HF buffer) |

---

## 4. Underwriting & Buffered Liquidation Mathematics

### 4.1 Confidential Salary Underwriting
$$\text{Max Borrow Capacity USD} = \text{Monthly Salary USD} \times \text{Credit Multiplier (e.g., 6)}$$

In Nox TEE:
```solidity
euint256 maxBorrowUSD = Nox.mul(incomeRateHandle, Nox.toEuint256(creditMultiplier));
ebool isEligible = Nox.ge(maxBorrowUSD, requestedBorrowUSD);
```

### 4.2 Buffered Per-User Liquidation (`SIGNET_LIQUIDATION_THRESHOLD_BPS`)
* **Aave V3 Threshold:** 8000 BPS (80.00% LTV; HF = 1.000).
* **SigNet Trigger Point:** 7500 BPS (75.00% LTV; HF = 1.067 safety margin relative to Aave).
* **Derivation & Safety Margin:**
  SigNet's internal permissionless `checkAndLiquidate(address user)` fires at 75% LTV, liquidating individual underwater users 500 BPS ahead of Aave's 80% pool-wide threshold. This guarantees that individual defaults are resolved internally before Aave's aggregate pool liquidation can ever be triggered.

---

## 5. Security & Reentrancy Protections

`ConfidentialCredit.sol` inherits OpenZeppelin's `ReentrancyGuard`. The `nonReentrant` modifier is strictly applied across all state-modifying and fund-moving entry points:
- `depositCollateral(...)`
- `requestBorrow(...)`
- `repay(...)`
- `checkAndLiquidate(address user)`

---

## 6. Official Verified Contract Addresses (Arbitrum Sepolia)

* **Aave V3 Pool (Proxy):** `0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff`
* **Aave Pool Addresses Provider:** `0xB25a5D144626a0D488e52AE717A051a2E9997076`
* **Aave Pool Data Provider:** `0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01`
* **Aave Price Oracle:** `0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00`
* **USDC Testnet Token:** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
* **WETH Wrapped Ether:** `0x1dF462e2712496373A347f8ad10802a5E95f053D`
