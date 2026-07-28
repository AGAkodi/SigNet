const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Confirmed Official Arbitrum Sepolia Aave V3 Contracts & Tokens
const AAVE_V3_POOL_ARBITRUM_SEPOLIA = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
const AAVE_V3_ORACLE_ARBITRUM_SEPOLIA = "0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00";
const USDC_ARBITRUM_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

// Existing deployed contract addresses on Arbitrum Sepolia (Unchanged contracts)
const EXISTING_INCOME_STREAM = "0x94658D76467d322B5D5d77001126bE339DaF1AA9";
const EXISTING_CREDIT_TOKEN = "0x7B8902Ab7B59214b66876124710c39d0119a1bB6";

async function main() {
  console.log("=================================================================");
  console.log("  SIGNET — ARBITRUM SEPOLIA DEPLOYMENT     ");
  console.log("=================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.formatEther(balance)} ETH\n`);

  const shouldRedeployAll = process.env.REDEPLOY_ALL === "true";
  let tokenAddress = EXISTING_CREDIT_TOKEN;
  let streamAddress = EXISTING_INCOME_STREAM;

  // 1. ERC7984 Credit Token (Reuse existing or redeploy if requested)
  if (shouldRedeployAll || !EXISTING_CREDIT_TOKEN) {
    console.log("Deploying new ERC7984CreditToken...");
    const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
    const creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "https://signet.finance/token");
    await creditToken.waitForDeployment();
    tokenAddress = await creditToken.getAddress();
    console.log(`✓ ERC7984CreditToken deployed to: ${tokenAddress}`);
  } else {
    console.log(`✓ Reusing existing ERC7984CreditToken at: ${tokenAddress}`);
  }

  // 2. IncomeStream (Reuse existing or redeploy if requested)
  if (shouldRedeployAll || !EXISTING_INCOME_STREAM) {
    console.log("Deploying new IncomeStream...");
    const IncomeStream = await ethers.getContractFactory("IncomeStream");
    const incomeStream = await IncomeStream.deploy();
    await incomeStream.waitForDeployment();
    streamAddress = await incomeStream.getAddress();
    console.log(`✓ IncomeStream deployed to: ${streamAddress}`);
  } else {
    console.log(`✓ Reusing existing IncomeStream at: ${streamAddress}`);
  }

  // 3. Deploy Aave-Integrated ConfidentialCredit Vault
  // Exact Constructor Signature:
  // constructor(address _incomeStream, address _creditToken, uint256 _multiplier, address _aavePool, address _aaveOracle)
  console.log("\nDeploying Aave-Integrated ConfidentialCredit Vault...");
  console.log(`  - IncomeStream: ${streamAddress}`);
  console.log(`  - CreditToken:  ${tokenAddress}`);
  console.log(`  - Multiplier:   6x`);
  console.log(`  - Aave V3 Pool: ${AAVE_V3_POOL_ARBITRUM_SEPOLIA}`);
  console.log(`  - Aave Oracle:  ${AAVE_V3_ORACLE_ARBITRUM_SEPOLIA}`);

  const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
  const creditVault = await ConfidentialCredit.deploy(
    streamAddress,
    tokenAddress,
    6,
    AAVE_V3_POOL_ARBITRUM_SEPOLIA,
    AAVE_V3_ORACLE_ARBITRUM_SEPOLIA
  );
  await creditVault.waitForDeployment();
  const vaultAddress = await creditVault.getAddress();
  console.log(`\n✓ ConfidentialCredit Vault deployed to: ${vaultAddress}`);

  // 4. Update Vault Permission on ERC7984CreditToken
  console.log("\nUpdating Vault Permission on ERC7984CreditToken...");
  const creditTokenContract = await ethers.getContractAt("ERC7984CreditToken", tokenAddress);
  const tx = await creditTokenContract.setCreditVault(vaultAddress);
  await tx.wait();
  console.log(`✓ Set vault authority on ERC7984CreditToken to: ${vaultAddress}`);

  // 5. Update docs/deployments.md
  const deploymentsDocPath = path.join(__dirname, "../docs/deployments.md");
  const deploymentRecord = `# Deployments — Arbitrum Sepolia

| Contract | Address | Network | Explorer Link | Notes |
| --- | --- | --- | --- | --- |
| \`ERC7984CreditToken\` | \`${tokenAddress}\` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/${tokenAddress}) | Base confidential credit token |
| \`IncomeStream\` | \`${streamAddress}\` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/${streamAddress}) | Salary stream contract emitting encrypted handles |
| \`ConfidentialCredit\` | \`${vaultAddress}\` | Arbitrum Sepolia | [Arbiscan](https://sepolia.arbiscan.io/address/${vaultAddress}) | Aave V3 Integrated Confidential Vault |

## Verified Infrastructure References
- **Aave V3 Pool:** \`${AAVE_V3_POOL_ARBITRUM_SEPOLIA}\`
- **Aave V3 Oracle:** \`${AAVE_V3_ORACLE_ARBITRUM_SEPOLIA}\`
- **USDC Testnet Token:** \`${USDC_ARBITRUM_SEPOLIA}\`
- **WETH Testnet Token:** \`${WETH_ARBITRUM_SEPOLIA}\`

## Deployment Metadata
- **Deployer Address:** \`${deployer.address}\`
- **Chain ID:** 421614 (Arbitrum Sepolia)
- **RPC Endpoint:** \`https://sepolia-rollup.arbitrum.io/rpc\`
- **Deployment Timestamp:** \`${new Date().toISOString()}\`
`;

  fs.writeFileSync(deploymentsDocPath, deploymentRecord);
  console.log(`\nUpdated deployment records in ${deploymentsDocPath}`);

  console.log("\n=================================================================");
  console.log("  ARBITRUM SEPOLIA DEPLOYMENT READY 100%");
  console.log("=================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
