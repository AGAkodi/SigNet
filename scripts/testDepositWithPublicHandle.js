const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";
const AAVE_WETH_ATOKEN = "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";

async function main() {
  console.log("=== Testing depositCollateral with Valid Public Nox Handle ===");
  const [deployer] = await ethers.getSigners();

  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
  ];
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
  ];
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
    "function getUserCollateralAmount(address borrower) external view returns (uint256)",
  ];

  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);
  const weth = new ethers.Contract(WETH_ARBITRUM_SEPOLIA, erc20Abi, deployer);
  const aWeth = new ethers.Contract(AAVE_WETH_ATOKEN, erc20Abi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const depositAmount = ethers.parseEther("0.001");
  const publicHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(100000), 32), 3);
  console.log(`Generated Valid Nox Public Handle: ${publicHandle}`);

  console.log("1. Approving ConfidentialCredit Vault to spend 0.001 WETH...");
  const appTx = await weth.approve(CONFIDENTIAL_CREDIT, depositAmount);
  console.log(`Approve Tx Hash: ${appTx.hash}`);
  await appTx.wait();
  console.log("✓ Approval confirmed.");

  const aWethBefore = await aWeth.balanceOf(CONFIDENTIAL_CREDIT);
  console.log(`Vault Aave aWETH Balance BEFORE: ${ethers.formatEther(aWethBefore)} aWETH`);

  console.log("2. Calling depositCollateral(WETH, 0.001)...");
  const depTx = await vault.depositCollateral(
    WETH_ARBITRUM_SEPOLIA,
    depositAmount,
    publicHandle,
    "0x"
  );
  console.log(`Deposit Tx Hash: ${depTx.hash}`);
  const receipt = await depTx.wait();
  console.log(`✓ Deposit confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

  const aWethAfter = await aWeth.balanceOf(CONFIDENTIAL_CREDIT);
  console.log(`Vault Aave aWETH Balance AFTER: ${ethers.formatEther(aWethAfter)} aWETH`);

  const userCollateral = await vault.getUserCollateralAmount(deployer.address);
  console.log(`Vault Recorded Plaintext Collateral: ${ethers.formatEther(userCollateral)} WETH`);
}

main().catch((err) => {
  console.error("Deposit Error:", err);
  process.exitCode = 1;
});
