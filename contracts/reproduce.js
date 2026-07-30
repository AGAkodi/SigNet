const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const CONFIDENTIAL_CREDIT = "0xB3D77A7e224913e546CDB614815Aadcea23C8BA2";
  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  const borrowAmount = 100000n; // 0.1 USDC

  // Minimal ABI for evaluateBorrowEligibility
  const abi = [
    "function evaluateBorrowEligibility(address borrowAsset, uint256 requestedAmount, bytes32 externalRequestedAmount, bytes calldata inputProof) external returns (bytes32)"
  ];

  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, abi, deployer);

  // We will use a dummy handle/proof to see the exact revert reason.
  const dummyHandle = ethers.zeroPadValue("0x1234", 32);
  const dummyProof = "0x";

  console.log("Simulating evaluateBorrowEligibility via callStatic...");
  try {
    await vault.evaluateBorrowEligibility.staticCall(
      USDC_ADDRESS,
      borrowAmount,
      dummyHandle,
      dummyProof
    );
    console.log("Simulation succeeded unexpectedly!");
  } catch (error) {
    console.log("--- RAW ERROR OBJECT ---");
    console.log(error);
    console.log("--- ERROR KEYS ---");
    console.log(Object.keys(error));
    if (error.data) {
      console.log("Direct error.data:", error.data);
    }
    if (error.error?.data) {
      console.log("Nested error.error.data:", error.error.data);
    }
    // Print message
    console.log("Error Message:", error.message);
  }
}

main().catch(console.error);
