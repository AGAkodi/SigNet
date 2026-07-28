const { ethers } = require("hardhat");

const CREDIT_TOKEN = "0x8f9e846c7d13B11A2CA85ac71546b48D807E2971";
const TARGET_VAULT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";

async function main() {
  const [deployer] = await ethers.getSigners();
  const tokenAbi = [
    "function creditVault() view returns (address)",
    "function setCreditVault(address _creditVault) external",
  ];
  const token = new ethers.Contract(CREDIT_TOKEN, tokenAbi, deployer);

  const currentVault = await token.creditVault();
  console.log(`Current creditVault on ERC7984CreditToken: ${currentVault}`);
  console.log(`Target ConfidentialCredit Vault:          ${TARGET_VAULT}`);

  if (currentVault.toLowerCase() !== TARGET_VAULT.toLowerCase()) {
    console.log("Setting creditVault on ERC7984CreditToken to TARGET_VAULT...");
    const tx = await token.setCreditVault(TARGET_VAULT);
    console.log(`Tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ creditVault updated in block ${receipt.blockNumber}, status: ${receipt.status}`);
  } else {
    console.log("✓ Vault permission is ALREADY correctly set!");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
