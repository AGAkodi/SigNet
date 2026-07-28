const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAddress = "0x563d5fc58CC6CEBd049728753ba97cb374B25E37";
  const confidentialCreditAbi = [
    "function getEncryptedBorrowEligibility(address account) external view returns (bytes32)",
    "function requestBorrow(address borrowAsset, uint256 requestedAmount, bytes calldata eligibilityProof) external returns (bytes32)",
  ];
  const noxComputeAbi = [
    "function validateDecryptionProof(bytes32 handle, bytes calldata proof) external view returns (bytes memory)",
  ];

  const vault = new ethers.Contract(vaultAddress, confidentialCreditAbi, deployer);
  const noxCompute = new ethers.Contract("0xd464B198f06756a1d00be223634b85E0a731c229", noxComputeAbi, deployer);

  const handle = await vault.getEncryptedBorrowEligibility(deployer.address);
  console.log("Stored Eligibility Handle:", handle);

  console.log("Initializing Nox handleClient to request live public decryption proof from Gateway...");
  const handleClient = await createEthersHandleClient(deployer);

  try {
    const pubDec = await handleClient.publicDecrypt(handle);
    console.log("Live Public Decryption Payload:", pubDec);
    const proof = pubDec.decryptionProof;
    console.log(`Proof length: ${(proof.length - 2) / 2} bytes`);

    console.log("Testing validateDecryptionProof on NoxCompute with REAL Gateway Proof...");
    const res = await noxCompute.validateDecryptionProof(handle, proof);
    console.log("validateDecryptionProof result hex:", res);
    const boolVal = ethers.getBytes(res)[0] !== 0;
    console.log("Decrypted Boolean Signal:", boolVal);

    console.log("\nExecuting requestBorrow on ConfidentialCredit Vault with REAL Gateway Proof...");
    const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    const tx = await vault.requestBorrow(USDC_ADDRESS, 100000n, proof, { gasLimit: 1500000 });
    console.log("requestBorrow Tx Hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ requestBorrow SUCCESS! Status:", receipt.status, "in block:", receipt.blockNumber);
  } catch (err) {
    console.log("❌ Error:", err);
  }
}

main().catch(console.error);
