const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
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

  for (const len of [128, 129, 130, 137, 138, 140]) {
    const proofHex = "0x" + "00".repeat(len);
    try {
      const res = await vault.depositCollateral.staticCall(
        WETH_ARBITRUM_SEPOLIA,
        amount,
        publicHandle,
        proofHex
      );
      console.log(`✓ Length ${len}: staticCall SUCCEEDED! Result:`, res);
      break;
    } catch (err) {
      if (err.data) {
        console.log(`Length ${len} raw data len:`, err.data.length);
        console.log(`Length ${len} raw data:`, err.data);
      } else {
        console.log(`Length ${len} err msg:`, err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
