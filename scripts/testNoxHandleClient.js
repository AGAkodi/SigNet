const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

const CONFIDENTIAL_CREDIT = "0x5ad0DD36848a37BDe2492D822d31A19186Ff7914";

async function main() {
  console.log("=== Testing Real iExec Nox Handle SDK Client on Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  console.log("Initializing createEthersHandleClient(deployer)...");
  const handleClient = await createEthersHandleClient(deployer);
  console.log("✓ handleClient initialized successfully!");

  console.log("Encrypting input (100000n, 'uint256', CONFIDENTIAL_CREDIT)...");
  const { handle, handleProof } = await handleClient.encryptInput(
    100000n,
    "uint256",
    CONFIDENTIAL_CREDIT
  );

  console.log("★ ENCRYPTION SUCCESS!");
  console.log(`  Handle:       ${handle}`);
  console.log(`  HandleProof:  ${handleProof}`);
  console.log(`  Proof Length: ${(handleProof.length - 2) / 2} bytes`);
}

main().catch((err) => {
  console.error("SDK Test Error:", err);
  process.exitCode = 1;
});
