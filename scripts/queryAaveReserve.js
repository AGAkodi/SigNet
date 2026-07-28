const { ethers } = require("hardhat");

const AAVE_V3_POOL_ARBITRUM_SEPOLIA = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
const USDC_ARBITRUM_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  console.log("=== Querying Aave V3 Reserve Data on Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();

  const poolAbi = [
    "function getReserveData(address asset) external view returns ((uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
  ];

  const pool = new ethers.Contract(AAVE_V3_POOL_ARBITRUM_SEPOLIA, poolAbi, deployer);

  const wethData = await pool.getReserveData(WETH_ARBITRUM_SEPOLIA);
  console.log("WETH Aave Reserve Data:");
  console.log(`  aToken:            ${wethData.aTokenAddress}`);
  console.log(`  variableDebtToken: ${wethData.variableDebtTokenAddress}`);

  const usdcData = await pool.getReserveData(USDC_ARBITRUM_SEPOLIA);
  console.log("USDC Aave Reserve Data:");
  console.log(`  aToken:            ${usdcData.aTokenAddress}`);
  console.log(`  variableDebtToken: ${usdcData.variableDebtTokenAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
