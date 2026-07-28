const { ethers } = require("hardhat");

const AAVE_POOL = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  const [deployer] = await ethers.getSigners();
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
  ];
  const poolAbi = [
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  ];

  const weth = new ethers.Contract(WETH_ARBITRUM_SEPOLIA, erc20Abi, deployer);
  const pool = new ethers.Contract(AAVE_POOL, poolAbi, deployer);

  console.log("Approving Aave Pool to spend WETH...");
  const appTx = await weth.approve(AAVE_POOL, ethers.parseEther("0.001"));
  await appTx.wait();
  console.log("✓ Approval confirmed.");

  try {
    await pool.supply.staticCall(WETH_ARBITRUM_SEPOLIA, ethers.parseEther("0.001"), deployer.address, 0);
    console.log("★ Aave Pool supply staticCall SUCCEEDED WITH APPROVAL!");
  } catch (e) {
    console.log("Aave Pool supply err:", e.message);
  }
}

main().catch(console.error);
