# Deployments — Arbitrum Sepolia

| Contract | Address | Network | Explorer Link | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `ERC7984CreditToken` | `0x6f5e52c71A88Ba8973061d3dCE5619EbA65B8Fb4` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/0x6f5e52c71A88Ba8973061d3dCE5619EbA65B8Fb4) | **ACTIVE** | Base confidential credit token |
| `IncomeStream` | `0x2539b12C4A1020c02375B93a3b9E142Ce8D47652` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/0x2539b12C4A1020c02375B93a3b9E142Ce8D47652) | **ACTIVE** | Salary stream contract emitting encrypted handles |
| `ConfidentialCredit` | `0xB9Cc313B85E66F3C2336fFFB789881D7c39F4F38` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/0xB9Cc313B85E66F3C2336fFFB789881D7c39F4F38) | **ACTIVE** | Aave V3 Integrated Confidential Vault — Full end-to-end verified |

## Verified Infrastructure References
- **Nox Compute Coprocessor:** `0xd464B198f06756a1d00be223634b85E0a731c229`
- **Aave V3 Pool:** `0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff`
- **Aave V3 Oracle:** `0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00`
- **USDC Testnet Token:** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- **WETH Testnet Token:** `0x1dF462e2712496373A347f8ad10802a5E95f053D`

## Deployment Metadata
- **Deployer Address:** `0x7530e58314e6519F204536B034296996A911Dd93`
- **Chain ID:** 421614 (Arbitrum Sepolia)
- **RPC Endpoint:** `https://sepolia-rollup.arbitrum.io/rpc`
- **Latest Deployment Timestamp:** `2026-07-30T11:53:00.000Z`

## Verified On-Chain Transaction Hashes (Full Smoke Test)
| Step | Tx Hash | Status |
| --- | --- | --- |
| depositCollateral | [`0x67f6fdae...`](https://sepolia.arbiscan.io/tx/0x67f6fdaeba7c196063b269dd8e682a10948e815b4fd3aeac486f0baaab82d6e4) | SUCCESS (1) |
| evaluateBorrowEligibility | [`0x2464534a...`](https://sepolia.arbiscan.io/tx/0x2464534a23ed1161d67141c2bb18057cc421cbe222df5bda31e261a7557f39c9) | SUCCESS (1) |
| requestBorrow | [`0x5cc551b7...`](https://sepolia.arbiscan.io/tx/0x5cc551b7700cf08570852a852c0d85296f2d21f8ebadc5b7aec1453ab0fc9bec) | SUCCESS (1) |
| repay | [`0xd1483d1c...`](https://sepolia.arbiscan.io/tx/0xd1483d1c8241707e7d534ea7c6be1365bd19bb19277dcf312d264d9fe247dc59) | SUCCESS (1) |

---

## Deprecated Historical Deployments (Do Not Use)
- `ERC7984CreditToken`: `0x8f9e846c7d13B11A2CA85ac71546b48D807E2971`, `0x97bAE9E8bFB64f9289a5f5a042D8A6B80B57843A`, `0xCe65A5A12b1f1127A5E5D15F22F4B8bBb7b20958`, `0xF1879cB84557893a9c7A040f1541fEB9E2F562Bd`, `0x6557e794520d27d7df6FcA7765Acb8410518C4eb`, `0xB8EF7E35959e5cd02D6BA206Eac1695c25d3504A`, `0x7B8902Ab7B59214b66876124710c39d0119a1bB6` (Deprecated)
- `IncomeStream`: `0x113aDD5590eBde13cf5CF9e4Ef1036a834e90AF3`, `0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf`, `0xc42D8d5A6674dCd35abA7c0BF9Fd9A8678BB6F3e`, `0x8fCd6E299D416Be79E68C32608d09625D03fc257`, `0x8F67c0C60a5304Ff5Ac93D3b9AA8113A1134d94B`, `0x783F75c4Ef01f13598fa5b2aa651E99d0449e307`, `0x225081EfffEA8F79bD7121b13bbBF1e7dA341698`, `0x94658D76467d322B5D5d77001126bE339DaF1AA9` (Deprecated)
- `ConfidentialCredit`: `0xB3D77A7e224913e546CDB614815Aadcea23C8BA2`, `0x5ad0DD36848a37BDe2492D822d31A19186Ff7914`, `0x5F602982CC47dd707FA90bd9Af5da66e5587757C`, `0xe1Da2443d6eb5fC7CE79346F191F839A0e6f1F69`, `0x563d5fc58CC6CEBd049728753ba97cb374B25E37`, `0xDE898B3b9990feDF2d64223D21a25ecbdCe49C95`, `0x4183578ade5a5f16Fe6F6a6FBFc86E07eD4725Ed`, `0x88d331E112bF0F20c6CAD0f1d9872C610b5B74A4`, `0x15A9cFA9CD1dF724063511171f5bE34C39654928` (Deprecated)
