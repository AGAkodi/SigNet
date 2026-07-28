const { ethers } = require("hardhat");

const CREDIT_TOKEN = "0x6f5e52c71A88Ba8973061d3dCE5619EbA65B8Fb4";
const TARGET_VAULT = "0x5ad0DD36848a37BDe2492D822d31A19186Ff7914";

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
