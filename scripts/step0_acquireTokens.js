const { ethers } = require("hardhat");

const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";
const USDC_ARBITRUM_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

async function main() {
  console.log("=== Step 0: Check & Acquire Tokens on Arbitrum Sepolia ===");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer wallet: ${deployer.address}`);

  const ethBal = await ethers.provider.getBalance(deployer.address);
  console.log(`Native ETH Balance: ${ethers.formatEther(ethBal)} ETH`);

  // ABI for WETH (deposit, balanceOf)
  const wethAbi = [
    "function deposit() public payable",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ];

  // ABI for USDC (balanceOf, mint, etc)
  const usdcAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function mint(address to, uint256 amount) public",
    "function mint(uint256 amount) public",
    "function masterMinter() view returns (address)",
    "function owner() view returns (address)",
  ];

  const weth = new ethers.Contract(WETH_ARBITRUM_SEPOLIA, wethAbi, deployer);
  const usdc = new ethers.Contract(USDC_ARBITRUM_SEPOLIA, usdcAbi, deployer);

  let wethBal = await weth.balanceOf(deployer.address);
  let usdcBal = await usdc.balanceOf(deployer.address);

  console.log(`Initial WETH Balance: ${ethers.formatEther(wethBal)} WETH`);
  console.log(`Initial USDC Balance: ${ethers.formatUnits(usdcBal, 6)} USDC`);

  // 1. Acquire WETH by calling deposit() on WETH contract with 0.02 ETH
  if (wethBal < ethers.parseEther("0.01") && ethBal >= ethers.parseEther("0.02")) {
    console.log("\nAttempting to wrap 0.02 ETH -> WETH via deposit()...");
    const tx = await weth.deposit({ value: ethers.parseEther("0.02") });
    console.log(`Submitted WETH deposit tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ WETH deposit confirmed in block ${receipt.blockNumber}`);
    wethBal = await weth.balanceOf(deployer.address);
    console.log(`Updated WETH Balance: ${ethers.formatEther(wethBal)} WETH`);
  }

  // 2. Test USDC minting or check USDC balance
  console.log("\nChecking USDC contract capabilities...");
  try {
    console.log("Attempting USDC mint(address, amount)...");
    const tx = await usdc["mint(address,uint256)"](deployer.address, ethers.parseUnits("100", 6));
    console.log(`Submitted USDC mint tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ USDC mint confirmed in block ${receipt.blockNumber}`);
    usdcBal = await usdc.balanceOf(deployer.address);
    console.log(`Updated USDC Balance: ${ethers.formatUnits(usdcBal, 6)} USDC`);
  } catch (err) {
    console.log("USDC mint(address, amount) failed/reverted:", err.message);
    try {
      console.log("Attempting USDC mint(amount)...");
      const tx = await usdc["mint(uint256)"](ethers.parseUnits("100", 6));
      console.log(`Submitted USDC mint tx: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✓ USDC mint confirmed in block ${receipt.blockNumber}`);
      usdcBal = await usdc.balanceOf(deployer.address);
      console.log(`Updated USDC Balance: ${ethers.formatUnits(usdcBal, 6)} USDC`);
    } catch (err2) {
      console.log("USDC mint(amount) failed/reverted:", err2.message);
    }
  }

  wethBal = await weth.balanceOf(deployer.address);
  usdcBal = await usdc.balanceOf(deployer.address);

  console.log("\n=== Final Wallet Balances ===");
  console.log(`ETH:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`WETH: ${ethers.formatEther(wethBal)} WETH`);
  console.log(`USDC: ${ethers.formatUnits(usdcBal, 6)} USDC`);
}

main().catch((err) => {
  console.error("Step 0 Error:", err);
  process.exitCode = 1;
});
