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
| ERC7984CreditToken | 0x8f9e846c7d13B11A2CA85ac71546b48D807E2971 | https://sepolia.arbiscan.io/address/0x8f9e846c7d13B11A2CA85ac71546b48D807E2971 |
| IncomeStream | 0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf | https://sepolia.arbiscan.io/address/0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf |
| ConfidentialCredit | 0xECA515C29Eb3FD70cCdA5c8E2602a9094C137A65 | https://sepolia.arbiscan.io/address/0xECA515C29Eb3FD70cCdA5c8E2602a9094C137A65 |

## License
MIT

