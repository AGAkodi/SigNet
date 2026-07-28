const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const CREDIT_TOKEN = "0x8f9e846c7d13B11A2CA85ac71546b48D807E2971";
  const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";

  const tokenAbi = [
    "function owner() view returns (address)",
    "function creditVault() view returns (address)",
  ];
  const vaultAbi = [
    "function owner() view returns (address)",
    "function creditToken() view returns (address)",
  ];

  const token = new ethers.Contract(CREDIT_TOKEN, tokenAbi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  console.log(`CreditToken owner:       ${await token.owner()}`);
  console.log(`CreditToken creditVault: ${await token.creditVault()}`);
  console.log(`Vault owner:             ${await vault.owner()}`);
  console.log(`Vault creditToken:       ${await vault.creditToken()}`);
}

main().catch(console.error);
