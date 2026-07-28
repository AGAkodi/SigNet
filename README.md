# SIGNET

Salary-backed confidential lending — a private, TEE-verified income stream underwrites a confidential borrowing position. Neither salary nor loan magnitude is exposed on-chain.

## Project Structure

```
SigNet/
├── contracts/       # Hardhat / Foundry confidential smart contracts
├── frontend/        # Next.js / Wagmi / Viem Web UI
├── scripts/         # Deployment and utility scripts
├── docs/            # Architecture, deployment logs, and specifications
├── feedback.md      # Friction points and feedback during development
└── todo.md          # Project TODO checklist
```

## Quick Start

### Prerequisites
- Node.js 22+
- pnpm / npm
- Arbitrum Sepolia Testnet ETH

### Setup & Installation
```bash
# Install root & workspace dependencies
pnpm install
```

## Target Network & Deployments

- **Network:** Arbitrum Sepolia (Chain ID 421614)

| Contract | Address | Arbiscan |
|---|---|---|
| ERC7984CreditToken | 0x6f5e52c71A88Ba8973061d3dCE5619EbA65B8Fb4 | https://sepolia.arbiscan.io/address/0x6f5e52c71A88Ba8973061d3dCE5619EbA65B8Fb4 |
| IncomeStream | 0x113aDD5590eBde13cf5CF9e4Ef1036a834e90AF3 | https://sepolia.arbiscan.io/address/0x113aDD5590eBde13cf5CF9e4Ef1036a834e90AF3 |
| ConfidentialCredit | 0x5ad0DD36848a37BDe2492D822d31A19186Ff7914 | https://sepolia.arbiscan.io/address/0x5ad0DD36848a37BDe2492D822d31A19186Ff7914 |

## License
MIT

