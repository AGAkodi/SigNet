const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAddress = "0x563d5fc58CC6CEBd049728753ba97cb374B25E37";
  const confidentialCreditAbi = [
    "function getEncryptedBorrowEligibility(address account) external view returns (bytes32)",
    "function requestBorrow(address borrowAsset, uint256 requestedAmount, bytes calldata eligibilityProof) external returns (bytes32)",
  ];
  const noxComputeAbi = [
    "function allowPublicDecryption(bytes32 handle) external",
    "function allow(bytes32 handle, address account) external",
    "function isPubliclyDecryptable(bytes32 handle) external view returns (bool)",
    "function isAllowed(bytes32 handle, address account) external view returns (bool)",
  ];

  const vault = new ethers.Contract(vaultAddress, confidentialCreditAbi, deployer);
  const noxCompute = new ethers.Contract("0xd464B198f06756a1d00be223634b85E0a731c229", noxComputeAbi, deployer);

  const handle = await vault.getEncryptedBorrowEligibility(deployer.address);
  console.log("Stored Eligibility Handle:", handle);

  console.log("Allowing Vault on handle from Deployer...");
  try {
    const tx1 = await noxCompute.allow(handle, vaultAddress);
    await tx1.wait();
    console.log("✓ allow(handle, vaultAddress) succeeded.");
  } catch (err) {
    console.log("allow error:", err.message);
  }

  console.log("Allowing Public Decryption from Deployer...");
  try {
    const tx2 = await noxCompute.allowPublicDecryption(handle);
    await tx2.wait();
    console.log("✓ allowPublicDecryption succeeded.");
  } catch (err) {
    console.log("allowPublicDecryption error:", err.message);
  }

  const isPublic = await noxCompute.isPubliclyDecryptable(handle);
  console.log("Is Publicly Decryptable on NoxCompute?", isPublic);

  const isVaultAllowed = await noxCompute.isAllowed(handle, vaultAddress);
  console.log("Is Vault Allowed on NoxCompute?", isVaultAllowed);
}

main().catch(console.error);
