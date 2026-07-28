const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

const CONFIDENTIAL_CREDIT = "0xfaA9f8b7577BB3bFb2dC6058739b5Ee39aCE18cB";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
  ];
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const depositAmount = ethers.parseEther("0.001");
  const handleClient = await createEthersHandleClient(deployer);

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
    } else {
      console.log("Reverted msg:", err.message);
    }
  }
}

main().catch(console.error);
