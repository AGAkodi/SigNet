const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";

async function main() {
  const [deployer] = await ethers.getSigners();
  const abi = [
    "function kmsPublicKey() external view returns (bytes memory)",
    "function gateway() external view returns (address)",
    "function proofExpirationDuration() external view returns (uint256)",
    "function add(bytes32 a, bytes32 b) external view returns (bytes32)",
    "function ge(bytes32 a, bytes32 b) external view returns (bytes32)",
    "function isAllowed(bytes32 handle, address account) external view returns (bool)",
    "function isViewer(bytes32 handle, address account) external view returns (bool)",
    "function isPubliclyDecryptable(bytes32 handle) external view returns (bool)",
  ];

  const nox = new ethers.Contract(NOX_COMPUTE, abi, deployer);

  try {
    console.log("kmsPublicKey:", await nox.kmsPublicKey());
  } catch (e) {
    console.log("kmsPublicKey err:", e.message);
  }

  try {
    console.log("gateway:", await nox.gateway());
  } catch (e) {
    console.log("gateway err:", e.message);
  }

  try {
    console.log("proofExpirationDuration:", await nox.proofExpirationDuration());
  } catch (e) {
    console.log("proofExpirationDuration err:", e.message);
  }

  try {
    const sum = await nox.add(
      "0x0000000000000000000000000000000000000000000000000000000000000005",
      "0x000000000000000000000000000000000000000000000000000000000000000a"
    );
    console.log("add(5, 10) returned:", sum);
  } catch (e) {
    console.log("add err:", e.message);
  }

  try {
    const res = await nox.ge(
      "0x0000000000000000000000000000000000000000000000000000000000000064",
      "0x000000000000000000000000000000000000000000000000000000000000000a"
    );
    console.log("ge(100, 10) returned:", res);
  } catch (e) {
    console.log("ge err:", e.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
