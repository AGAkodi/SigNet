const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=================================================================");
  console.log("  NOX PRIVATE CREDIT — ARBITRUM SEPOLIA DEPLOYMENT SCRIPT        ");
  console.log("=================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account ETH Balance: ${ethers.formatEther(balance)} ETH\n`);

  // 1. Deploy ERC7984 Credit Token
  console.log("Deploying ERC7984CreditToken...");
  const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
  const creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "");
  await creditToken.waitForDeployment();
  const tokenAddress = await creditToken.getAddress();
  console.log(`✓ ERC7984CreditToken deployed to: ${tokenAddress}`);

  // 2. Deploy IncomeStream
  console.log("Deploying IncomeStream...");
  const IncomeStream = await ethers.getContractFactory("IncomeStream");
  const incomeStream = await IncomeStream.deploy();
  await incomeStream.waitForDeployment();
  const streamAddress = await incomeStream.getAddress();
  console.log(`✓ IncomeStream deployed to: ${streamAddress}`);

  // 3. Deploy ConfidentialCredit Vault
  console.log("Deploying ConfidentialCredit...");
  const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
  const creditVault = await ConfidentialCredit.deploy(streamAddress, tokenAddress, 6);
  await creditVault.waitForDeployment();
  const vaultAddress = await creditVault.getAddress();
  console.log(`✓ ConfidentialCredit deployed to: ${vaultAddress}`);

  // Set vault authority on credit token
  console.log("Granting vault permission on ERC7984CreditToken...");
  const tx = await creditToken.setCreditVault(vaultAddress);
  await tx.wait();
  console.log("✓ Vault permission set successfully.");

  // Update docs/deployments.md
  const deploymentsDocPath = path.join(__dirname, "../docs/deployments.md");
  const deploymentRecord = `# Deployments — Arbitrum Sepolia

| Contract | Address | Network | Explorer Link | Notes |
| --- | --- | --- | --- | --- |
| \`ERC7984CreditToken\` | \`${tokenAddress}\` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/${tokenAddress}) | Base confidential credit token |
| \`IncomeStream\` | \`${streamAddress}\` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/${streamAddress}) | Salary stream contract emitting encrypted handles |
| \`ConfidentialCredit\` | \`${vaultAddress}\` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/${vaultAddress}) | Confidential credit pool & TEE liquidation vault |

## Deployment Metadata
- **Deployer Address:** \`${deployer.address}\`
- **Chain ID:** 421614
- **RPC Endpoint:** \`https://sepolia-rollup.arbitrum.io/rpc\`
- **Deployment Timestamp:** \`${new Date().toISOString()}\`
`;

  fs.writeFileSync(deploymentsDocPath, deploymentRecord);
  console.log(`\nUpdated deployment records in ${deploymentsDocPath}`);

  console.log("\n=================================================================");
  console.log("  ARBITRUM SEPOLIA DEPLOYMENT COMPLETE 100%");
  console.log("=================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
