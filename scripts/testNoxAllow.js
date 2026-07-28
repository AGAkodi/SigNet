const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

const CONFIDENTIAL_CREDIT = "0x99394B9b29b111275f5bf1BDA8Fd25b136c2E52e";

async function main() {
  const [deployer] = await ethers.getSigners();
  const handleClient = await createEthersHandleClient(deployer);

  const { handle, handleProof } = await handleClient.encryptInput(
    100000n,
    "uint256",
    CONFIDENTIAL_CREDIT
  );

  console.log("Handle:", handle);
  console.log("Proof length:", (handleProof.length - 2) / 2);

  // Test calling Nox.fromExternal and Nox.allow via a custom test contract
  const factory = await ethers.getContractFactory("TestNoxPermission");
  const testContract = await factory.deploy();
  await testContract.waitForDeployment();
  console.log("TestNoxPermission deployed to:", await testContract.getAddress());

  // Encrypt proof specifically for testContract
  const { handle: h2, handleProof: p2 } = await handleClient.encryptInput(
    100000n,
    "uint256",
    await testContract.getAddress()
  );

  const tx = await testContract.testPermission(h2, p2, deployer.address);
  await tx.wait();
  console.log("★ testPermission SUCCEEDED!");
}

main().catch(console.error);
