const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0xAB12454Adb47b4aD79f336841Db7D1C10a068Dfe";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  console.log("=== Testing depositCollateral with teeType 35 (Uint256) & 137-byte proof ===");
  const [deployer] = await ethers.getSigners();

  const noxAbi = ["function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)"];
  const erc20Abi = ["function approve(address spender, uint256 amount) external returns (bool)"];
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
    "function getEncryptedCollateral(address account) external view returns (bytes32)",
  ];

  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);
  const weth = new ethers.Contract(WETH_ARBITRUM_SEPOLIA, erc20Abi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const depositAmount = ethers.parseEther("0.001");
  const publicHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(depositAmount), 32), 35); // 35 = Uint256
  console.log(`Generated Public Handle: ${publicHandle}`);

  const block = await ethers.provider.getBlock("latest");
  const ownerBytes = ethers.getBytes(deployer.address);
  const appBytes = ethers.getBytes(CONFIDENTIAL_CREDIT);
  const createdAtBytes = ethers.getBytes(ethers.zeroPadValue(ethers.toBeHex(block.timestamp), 32));
  const sigBytes = new Uint8Array(65);
  const proof137 = ethers.hexlify(ethers.concat([ownerBytes, appBytes, createdAtBytes, sigBytes]));

  console.log("1. Approving Vault to spend 0.001 WETH...");
  const appTx = await weth.approve(CONFIDENTIAL_CREDIT, depositAmount);
  await appTx.wait();
  console.log("   ✓ Approval confirmed.");

  console.log("2. Executing depositCollateral...");
  const depTx = await vault.depositCollateral(WETH_ARBITRUM_SEPOLIA, depositAmount, publicHandle, proof137, { gasLimit: 1500000 });
  console.log(`   Deposit Tx Hash: ${depTx.hash}`);
  const receipt = await depTx.wait();
  console.log(`✓ Deposit CONFIRMED in block ${receipt.blockNumber}, status: ${receipt.status}`);

  const storedHandle = await vault.getEncryptedCollateral(deployer.address);
  console.log(`   On-chain Stored Collateral Handle: ${storedHandle}`);
}

main().catch(console.error);
