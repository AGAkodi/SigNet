# Deployments — Arbitrum Sepolia

| Contract | Address | Network | Explorer Link | Notes |
| --- | --- | --- | --- | --- |
| `ERC7984CreditToken` | Not yet deployed — pending testnet ETH | Arbitrum Sepolia | N/A | Base confidential credit token |
| `IncomeStream` | Not yet deployed — pending testnet ETH | Arbitrum Sepolia | N/A | Salary stream contract emitting encrypted Nox handles |
| `ConfidentialCredit` | Not yet deployed — pending testnet ETH | Arbitrum Sepolia | N/A | Confidential credit pool & TEE coprocessor engine |

## Network & TEE Coprocessor Information
- **Target Network:** Arbitrum Sepolia Testnet
- **Chain ID:** `421614`
- **RPC Endpoint:** `https://sepolia-rollup.arbitrum.io/rpc`
- **Block Explorer:** `https://sepolia.arbiscan.io/`
- **Real Arbitrum Sepolia NoxCompute Address:** `0xd464B198f06756a1d00be223634b85E0a731c229`
- **Local Dev Chain (31337) NoxCompute Address:** `0x39847AeBa923Cc7367d4684194091D022B3F8548`

## Local Simulation & Testing (Chain ID: 31337)
```bash
# Execute local unit tests with Foundry
forge test --root contracts

# Execute local unit tests with Hardhat
npx hardhat test --network localhost

# Execute end-to-end Nox computation roundtrip
npx hardhat run scripts/testNoxRoundtrip.js
```
