# Deployments — Arbitrum Sepolia

| Contract | Address | Network | Explorer Link | Notes |
| --- | --- | --- | --- | --- |
| `ERC7984CreditToken` | `0x30a23FE8957cD4f1C1a5f6D8A6F011030eB4420A` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/0x30a23FE8957cD4f1C1a5f6D8A6F011030eB4420A) | Confidential credit token standard |
| `IncomeStream` | `0x71C941A58D8eB8dE4663c0B77443E868772aE5c9` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/0x71C941A58D8eB8dE4663c0B77443E868772aE5c9) | Encrypted salary stream handle issuer |
| `ConfidentialCredit` | `0x94B8aE1355a165EcC34D8a19C9b4a457a4eF77e4` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/0x94B8aE1355a165EcC34D8a19C9b4a457a4eF77e4`) | Confidential credit vault & TEE coprocessor engine |

## Network & TEE Coprocessor Information
- **Target Network:** Arbitrum Sepolia Testnet
- **Chain ID:** `421614`
- **RPC Endpoint:** `https://sepolia-rollup.arbitrum.io/rpc`
- **Block Explorer:** `https://sepolia.arbiscan.io/`
- **Nox TEE Coprocessor Address:** `0x1ExEC000000000000000000000000000000000FF`

## Deployment & Verification Commands
```bash
# Deploy contracts to Arbitrum Sepolia using Hardhat
PRIVATE_KEY=<YOUR_PRIVATE_KEY> npx hardhat run scripts/deployArbitrumSepolia.js --network arbitrumSepolia

# Or deploy via Forge
forge script script/Deploy.s.sol:DeployScript --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
```
