const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const GATEWAY_ADDRESS = "0xE13191F53671957C8a48A7A3Ff15E16450a1552F";

async function main() {
  const [deployer] = await ethers.getSigners();
  const noxAbi = [
    "function validateInputProof(bytes32 handle, address owner, bytes calldata proof, uint8 teeType) external view",
  ];
  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);

  const handle = ethers.keccak256(ethers.toUtf8Bytes("test_handle_1"));

  // 1. Packed: (handle, owner, teeType)
  const hash1 = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "uint8"],
    [handle, deployer.address, 3]
  );
  const sig1 = await deployer.signMessage(ethers.getBytes(hash1));

  try {
    await nox.validateInputProof(handle, deployer.address, sig1, 3);
    console.log("✓ validateInputProof succeeded with hash1 signature!");
  } catch (e) {
    console.log("hash1 sig err:", e.message);
  }

  // 2. Raw handle signed
  const sig2 = await deployer.signMessage(ethers.getBytes(handle));
  try {
    await nox.validateInputProof(handle, deployer.address, sig2, 3);
    console.log("✓ validateInputProof succeeded with handle signature!");
  } catch (e) {
    console.log("handle sig err:", e.message);
  }

  // 3. EIP-712 or typed hash
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
