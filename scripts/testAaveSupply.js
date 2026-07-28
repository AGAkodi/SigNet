const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

const CONFIDENTIAL_CREDIT = "0x0BbfA3B572e5732324FE7bFE7B5b7680dE051175";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";
const AAVE_POOL = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";

async function main() {
  const [deployer] = await ethers.getSigners();
  const poolAbi = [
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  ];
  const pool = new ethers.Contract(AAVE_POOL, poolAbi, deployer);

  console.log("Testing Aave supply call directly...");
  try {
    await pool.supply.staticCall(WETH_ARBITRUM_SEPOLIA, ethers.parseEther("0.001"), deployer.address, 0);
    console.log("✓ Aave Pool supply staticCall SUCCEEDED!");
  } catch (e) {
    console.log("Aave Pool supply staticCall err:", e.message);
  }
}

main().catch(console.error);
