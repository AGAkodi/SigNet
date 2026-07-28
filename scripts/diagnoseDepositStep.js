const { ethers } = require("hardhat");

const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
const CREDIT_TOKEN = "0x8f9e846c7d13B11A2CA85ac71546b48D807E2971";
const WETH_ADDRESS = "0x1dF462e2712496373A347f8ad10802a5E95f053D";
const AAVE_POOL = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Diagnosing deposit sub-steps with wallet ${deployer.address}...`);

  const erc20Abi = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
  ];
  const poolAbi = [
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external"
  ];
  const creditTokenAbi = [
    "function creditVault() view returns (address)",
    "function mintEncrypted(address to, bytes32 amount) external returns (bytes32)"
  ];

  const weth = new ethers.Contract(WETH_ADDRESS, erc20Abi, deployer);
  const pool = new ethers.Contract(AAVE_POOL, poolAbi, deployer);
  const creditToken = new ethers.Contract(CREDIT_TOKEN, creditTokenAbi, deployer);

  const bal = await weth.balanceOf(deployer.address);
  const allow = await weth.allowance(deployer.address, CONFIDENTIAL_CREDIT);
  console.log(`Deployer WETH Balance: ${ethers.formatEther(bal)}`);
  console.log(`Allowance for Vault:  ${ethers.formatEther(allow)}`);

  // Test 1: Direct call to Aave Pool supply
  console.log("\nTesting direct staticCall to Aave Pool supply(WETH, 0.001)...");
  try {
    await weth.approve(AAVE_POOL, ethers.parseEther("0.001"));
    await pool.supply.staticCall(WETH_ADDRESS, ethers.parseEther("0.001"), deployer.address, 0);
    console.log("✓ Aave Pool supply staticCall SUCCEEDED!");
  } catch (err) {
    console.log("❌ Aave Pool supply staticCall FAILED:", err.message);
  }

  // Test 2: mintEncrypted call on creditToken
  console.log("\nTesting staticCall to creditToken.mintEncrypted...");
  try {
    const dummyHandle = "0x0000066eee230100000000000000000000000000000000000000000000000001";
    await creditToken.mintEncrypted.staticCall(deployer.address, dummyHandle);
    console.log("✓ mintEncrypted staticCall SUCCEEDED!");
  } catch (err) {
    console.log("❌ mintEncrypted staticCall FAILED:", err.message);
    if (err.data) console.log("Error data:", err.data);
  }
}

main().catch(console.error);
