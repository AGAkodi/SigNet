const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x15A9cFA9CD1dF724063511171f5bE34C39654928";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  const [deployer] = await ethers.getSigners();

  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
  ];
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
  ];

  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const amount = ethers.parseEther("0.001");
  const publicHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(100000), 32), 35); // 35 = Uint256

  const block = await ethers.provider.getBlock("latest");
  const blockTime = block.timestamp;

  const ownerBytes = ethers.getBytes(deployer.address);
  const appBytes = ethers.getBytes(CONFIDENTIAL_CREDIT);
  const createdAtBytes = ethers.getBytes(ethers.zeroPadValue(ethers.toBeHex(blockTime), 32));
  const sigBytes = new Uint8Array(65);

  const proof = ethers.concat([ownerBytes, appBytes, createdAtBytes, sigBytes]);
  const proofHex = ethers.hexlify(proof);

  try {
    const res = await vault.depositCollateral.staticCall(
      WETH_ARBITRUM_SEPOLIA,
      amount,
      publicHandle,
      proofHex
    );
    console.log("★ SUCCESS! staticCall returned:", res);
  } catch (err) {
    if (err.data) {
      console.log("Raw err.data:", err.data);
    } else {
      console.log("Reverted msg:", err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
