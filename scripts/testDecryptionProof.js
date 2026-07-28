const { ethers } = require("hardhat");

const NOX_COMPUTE_ARBITRUM_SEPOLIA = "0xd464B198f06756a1d00be223634b85E0a731c229";

async function main() {
  console.log("=== Testing NoxCompute on Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();

  const noxAbi = [
    "function validateDecryptionProof(bytes32 handle, bytes calldata proof) external view returns (bytes memory)",
    "function validateInputProof(bytes32 handle, address owner, bytes calldata proof, uint8 teeType) external view",
  ];

  const noxContract = new ethers.Contract(NOX_COMPUTE_ARBITRUM_SEPOLIA, noxAbi, deployer);

  const testHandle = ethers.keccak256(ethers.toUtf8Bytes("test_handle"));
  
  // Test different proof payloads to see what validateDecryptionProof returns
  const sampleProofHex = "0x" + "00".repeat(65) + "01"; // 65 bytes sig + 0x01 (true)
  try {
    const res = await noxContract.validateDecryptionProof(testHandle, sampleProofHex);
    console.log("validateDecryptionProof result:", res);
  } catch (err) {
    console.log("validateDecryptionProof error:", err.message);
  }

  const sampleProofHexShort = "0x01";
  try {
    const res = await noxContract.validateDecryptionProof(testHandle, sampleProofHexShort);
    console.log("validateDecryptionProof (0x01) result:", res);
  } catch (err) {
    console.log("validateDecryptionProof (0x01) error:", err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
