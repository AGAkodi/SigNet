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
| ERC7984CreditToken | 0x7B8902Ab7B59214b66876124710c39d0119a1bB6 | https://sepolia.arbiscan.io/address/0x7B8902Ab7B59214b66876124710c39d0119a1bB6 |
| IncomeStream | 0x94658D76467d322B5D5d77001126bE339DaF1AA9 | https://sepolia.arbiscan.io/address/0x94658D76467d322B5D5d77001126bE339DaF1AA9 |
| ConfidentialCredit | 0x15A9cFA9CD1dF724063511171f5bE34C39654928 | https://sepolia.arbiscan.io/address/0x15A9cFA9CD1dF724063511171f5bE34C39654928 |

## License
MIT

