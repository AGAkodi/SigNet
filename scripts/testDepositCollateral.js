const { ethers } = require("hardhat");
const { NoxClientSDK } = require("./noxClientSdk");

const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";
const AAVE_WETH_ATOKEN = "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";

async function main() {
  console.log("=== Testing Deposit Collateral on Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();
  const sdk = new NoxClientSDK(deployer);

  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
  ];

  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
    "function getUserCollateralAmount(address borrower) external view returns (uint256)",
  ];

  const weth = new ethers.Contract(WETH_ARBITRUM_SEPOLIA, erc20Abi, deployer);
  const aWeth = new ethers.Contract(AAVE_WETH_ATOKEN, erc20Abi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const depositAmount = ethers.parseEther("0.001");

  console.log("1. Approving ConfidentialCredit Vault to spend 0.001 WETH...");
  const appTx = await weth.approve(CONFIDENTIAL_CREDIT, depositAmount);
  console.log(`Approve Tx Hash: ${appTx.hash}`);
  await appTx.wait();
  console.log("✓ Approval confirmed.");

  const collateralInput = await sdk.encryptInput(100000, CONFIDENTIAL_CREDIT, deployer.address);

  console.log("2. Querying Aave aWETH balance BEFORE deposit...");
  const aWethBalBefore = await aWeth.balanceOf(CONFIDENTIAL_CREDIT);
  console.log(`Vault Aave aWETH Balance BEFORE: ${ethers.formatEther(aWethBalBefore)} aWETH`);

  console.log("3. Calling depositCollateral(WETH, 0.001)...");
  const depTx = await vault.depositCollateral(
    WETH_ARBITRUM_SEPOLIA,
    depositAmount,
    collateralInput.encryptedHandle,
    collateralInput.proof
  );
  console.log(`Deposit Tx Hash: ${depTx.hash}`);
  const receipt = await depTx.wait();
  console.log(`✓ Deposit confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

  console.log("4. Querying Aave aWETH balance AFTER deposit...");
  const aWethBalAfter = await aWeth.balanceOf(CONFIDENTIAL_CREDIT);
  console.log(`Vault Aave aWETH Balance AFTER: ${ethers.formatEther(aWethBalAfter)} aWETH`);

  const vaultCollateralRecorded = await vault.getUserCollateralAmount(deployer.address);
  console.log(`Vault Recorded Plaintext Collateral: ${ethers.formatEther(vaultCollateralRecorded)} WETH`);
}

main().catch((err) => {
  console.error("Deposit Collateral Error:", err);
  process.exitCode = 1;
});
