const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAddress = "0x563d5fc58CC6CEBd049728753ba97cb374B25E37";
  const confidentialCreditAbi = [
    "function getEncryptedBorrowEligibility(address account) external view returns (bytes32)",
  ];
  const noxComputeAbi = [
    "function isPubliclyDecryptable(bytes32 handle) external view returns (bool)",
    "function isAllowed(bytes32 handle, address account) external view returns (bool)",
    "function validateDecryptionProof(bytes32 handle, bytes calldata proof) external view returns (bytes memory)",
  ];

  const vault = new ethers.Contract(vaultAddress, confidentialCreditAbi, deployer);
  const noxCompute = new ethers.Contract("0xd464B198f06756a1d00be223634b85E0a731c229", noxComputeAbi, deployer);

  const handle = await vault.getEncryptedBorrowEligibility(deployer.address);
  console.log("Stored Eligibility Handle:", handle);

  const sigBytes65 = new Uint8Array(65);
  sigBytes65[64] = 27;
  const trueByte = new Uint8Array([1]); // boolean true
  const dummyProof = ethers.hexlify(ethers.concat([sigBytes65, trueByte]));

  console.log("\nTesting validateDecryptionProof with dummyProof directly on NoxCompute...");
  try {
    const res = await noxCompute.validateDecryptionProof(handle, dummyProof, { from: vaultAddress });
    console.log("Direct call from Vault result:", res);
  } catch (err) {
    console.log("Direct call from Vault error:", err.message);
    if (err.data) console.log("err.data:", err.data);
  }

  try {
    const res = await noxCompute.validateDecryptionProof(handle, dummyProof, { from: deployer.address });
    console.log("Direct call from Deployer result:", res);
  } catch (err) {
    console.log("Direct call from Deployer error:", err.message);
    if (err.data) console.log("err.data:", err.data);
  }
}

main().catch(console.error);
