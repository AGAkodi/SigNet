const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

const CONFIDENTIAL_CREDIT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
  ];
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const depositAmount = ethers.parseEther("0.001");
  const handleClient = await createEthersHandleClient(deployer);

  console.log("Requesting REAL signed input proof from Nox Gateway...");
  const { handle, handleProof } = await handleClient.encryptInput(
    100000n,
    "uint256",
    CONFIDENTIAL_CREDIT
  );
  console.log(`Real Handle: ${handle}`);
  console.log(`Real HandleProof: ${handleProof}`);

  try {
    const res = await vault.depositCollateral.staticCall(
      WETH_ARBITRUM_SEPOLIA,
      depositAmount,
      handle,
      handleProof
    );
    console.log("★ SUCCESS! staticCall returned:", res);
  } catch (err) {
    if (err.data) {
      console.log("Raw err.data:", err.data);
      try {
        const text = ethers.toUtf8String("0x" + err.data.slice(138)).replace(/\0/g, '');
        console.log("Decoded error string:", text);
      } catch (e) {
        console.log("Could not decode string.");
      }
    } else {
      console.log("Reverted msg:", err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
