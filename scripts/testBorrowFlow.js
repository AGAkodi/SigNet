const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

async function main() {
  const [deployer] = await ethers.getSigners();
  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
  ];
  const vaultAbi = [
    "function evaluateBorrowEligibility(address borrowAsset, uint256 requestedAmount, bytes32 externalRequestedAmount, bytes calldata inputProof) external returns (bytes32)",
    "function requestBorrow(address borrowAsset, uint256 requestedAmount, bytes calldata eligibilityProof) external returns (bytes32)",
    "function getEncryptedBorrowEligibility(address account) external view returns (bytes32)",
  ];

  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);
  const handleClient = await createEthersHandleClient(deployer);

  const borrowAmount = 100000n; // 0.1 USDC
  const borrowHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(borrowAmount), 32), 35);

  console.log("1. Executing evaluateBorrowEligibility...");
  const evalTx = await vault.evaluateBorrowEligibility(USDC_ADDRESS, borrowAmount, borrowHandle, "0x");
  console.log(`   Tx Hash: ${evalTx.hash}`);
  await evalTx.wait();
  console.log("   ✓ evaluateBorrowEligibility confirmed.");

  const eligibilityHandle = await vault.getEncryptedBorrowEligibility(deployer.address);
  console.log(`2. Stored Eligibility Handle: ${eligibilityHandle}`);

  console.log("3. Fetching public decryption proof from Gateway...");
  try {
    const pubDec = await handleClient.publicDecrypt(eligibilityHandle);
    console.log(`   Decrypted value: ${pubDec.value}`);
    console.log(`   Proof length: ${(pubDec.decryptionProof.length - 2) / 2} bytes`);

    console.log("4. Executing requestBorrow...");
    const borrowTx = await vault.requestBorrow(USDC_ADDRESS, borrowAmount, pubDec.decryptionProof);
    console.log(`   Tx Hash: ${borrowTx.hash}`);
    await borrowTx.wait();
    console.log("★ SUCCESS! requestBorrow confirmed.");
  } catch (err) {
    console.log("Gateway publicDecrypt note:", err.message);
  }
}

main().catch(console.error);
