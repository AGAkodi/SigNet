const { ethers } = require("hardhat");

const INCOME_STREAM = "0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf";
const CREDIT_TOKEN = "0x8f9e846c7d13B11A2CA85ac71546b48D807E2971";
const AAVE_POOL = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
const AAVE_ORACLE = "0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00";

async function main() {
  console.log("=== Deploying Updated ConfidentialCredit Vault with Fix ===");
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
  const vault = await ConfidentialCredit.deploy(
    INCOME_STREAM,
    CREDIT_TOKEN,
    6,
    AAVE_POOL,
    AAVE_ORACLE
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✓ ConfidentialCredit Vault deployed to: ${vaultAddress}`);

  console.log("Updating Vault permission on ERC7984CreditToken...");
  const tokenAbi = ["function setCreditVault(address) external"];
  const token = new ethers.Contract(CREDIT_TOKEN, tokenAbi, deployer);
  const tx = await token.setCreditVault(vaultAddress);
  console.log(`setCreditVault tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✓ Vault permission set in block ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
