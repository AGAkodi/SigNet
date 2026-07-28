const { ethers } = require("hardhat");
const { NoxClientSDK } = require("./noxClientSdk");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x15A9cFA9CD1dF724063511171f5bE34C39654928";

async function main() {
  console.log("=== Testing Input Proof on NoxCompute Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();
  const sdk = new NoxClientSDK(deployer);

  const input = await sdk.encryptInput(1000, CONFIDENTIAL_CREDIT, deployer.address);
  console.log("Generated input handle:", input.encryptedHandle);
  console.log("Generated proof:", input.proof);

  const noxAbi = [
    "function validateInputProof(bytes32 handle, address owner, bytes calldata proof, uint8 teeType) external view",
  ];
  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);

  try {
    await nox.validateInputProof(input.encryptedHandle, deployer.address, input.proof, 3); // 3 = Uint256
    console.log("✓ validateInputProof SUCCEEDED with SDK proof!");
  } catch (err) {
    console.log("validateInputProof WITH SDK PROOF REVERTED:", err.message);
  }

  try {
    await nox.validateInputProof(input.encryptedHandle, deployer.address, "0x", 3);
    console.log("✓ validateInputProof SUCCEEDED with 0x proof!");
  } catch (err) {
    console.log("validateInputProof WITH 0x PROOF REVERTED:", err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
