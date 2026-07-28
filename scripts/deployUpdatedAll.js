const { ethers } = require("hardhat");

const INCOME_STREAM = "0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf";
const AAVE_POOL = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
const AAVE_ORACLE = "0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00";

async function main() {
  console.log("=== Deploying Updated ERC7984CreditToken & ConfidentialCredit Vault ===");
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // 1. Deploy ERC7984CreditToken
  const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
  const creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "https://signet.finance/token");
  await creditToken.waitForDeployment();
  const tokenAddress = await creditToken.getAddress();
  console.log(`✓ ERC7984CreditToken deployed to: ${tokenAddress}`);

  // 2. Deploy ConfidentialCredit
  const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
  const vault = await ConfidentialCredit.deploy(
    INCOME_STREAM,
    tokenAddress,
    6,
    AAVE_POOL,
    AAVE_ORACLE
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✓ ConfidentialCredit Vault deployed to: ${vaultAddress}`);

  // 3. Set vault permission
  console.log("Setting creditVault on ERC7984CreditToken...");
  const tx = await creditToken.setCreditVault(vaultAddress);
  console.log(`setCreditVault tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✓ Vault permission set in block ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
