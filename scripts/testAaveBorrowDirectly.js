const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const vaultAddress = "0x563d5fc58CC6CEBd049728753ba97cb374B25E37";
  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  const aavePoolAddress = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";

  const iface = new ethers.Interface([
    "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  ]);
  const calldata = iface.encodeFunctionData("borrow", [USDC_ADDRESS, 100000n, 2, 0, vaultAddress]);

  try {
    console.log("Testing eth_call to aavePool.borrow from Vault...");
    const res = await provider.call({
      from: vaultAddress,
      to: aavePoolAddress,
      data: calldata,
    });
    console.log("✓ eth_call to aavePool.borrow SUCCEEDED! Result:", res);
  } catch (err) {
    console.log("❌ eth_call to aavePool.borrow failed:", err.message);
    if (err.data) console.log("err.data:", err.data);
  }
}

main().catch(console.error);
