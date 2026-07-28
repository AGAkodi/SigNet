const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Initializing handleClient...");
  const handleClient = await createEthersHandleClient(deployer);
  console.log("✓ handleClient ready.");

  // Test publicDecrypt method
  const testHandle = "0x0000066eee2301a066afce0fb6d07693c9845fe653c0c8257c6276da3d3848f1";
  console.log(`Testing publicDecrypt on handle: ${testHandle}...`);
  try {
    const res = await handleClient.publicDecrypt(testHandle);
    console.log("Public Decrypt Result:", res);
  } catch (err) {
    console.log("publicDecrypt Error:", err.message);
  }
}

main().catch(console.error);
