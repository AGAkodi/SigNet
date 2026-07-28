const { ethers } = require("hardhat");

const NOX_COMPUTE_ARBITRUM_SEPOLIA = "0xd464B198f06756a1d00be223634b85E0a731c229";

async function main() {
  const [deployer] = await ethers.getSigners();
  const code = await ethers.provider.getCode(NOX_COMPUTE_ARBITRUM_SEPOLIA);
  console.log(`NoxCompute contract byte length at ${NOX_COMPUTE_ARBITRUM_SEPOLIA}: ${code.length}`);

  // Let's test calling wrapAsPublicHandle or add or other functions
  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
    "function validateDecryptionProof(bytes32 handle, bytes calldata proof) external view returns (bytes memory)",
  ];
  const nox = new ethers.Contract(NOX_COMPUTE_ARBITRUM_SEPOLIA, noxAbi, deployer);

  try {
    const handle = await nox.wrapAsPublicHandle(ethers.ZeroHash, 0);
    console.log("wrapAsPublicHandle returned:", handle);
  } catch (err) {
    console.log("wrapAsPublicHandle error:", err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
