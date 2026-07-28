const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x5ad0DD36848a37BDe2492D822d31A19186Ff7914";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  console.log("=== Debugging depositCollateral with Uint256 (35) Handle ===");
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
  console.log(`Public Uint256 Handle: ${publicHandle}`);

  try {
    const res = await vault.depositCollateral.staticCall(
      WETH_ARBITRUM_SEPOLIA,
      amount,
      publicHandle,
      "0x"
    );
    console.log("✓ staticCall SUCCEEDED:", res);
  } catch (err) {
    console.log("staticCall REVERTED with message:", err.message);
    if (err.data) {
      console.log("Error data:", err.data);
      try {
        const text = ethers.toUtf8String("0x" + err.data.slice(138));
        console.log("Decoded error string:", text);
      } catch (e) {}
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
