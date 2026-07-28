const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x15A9cFA9CD1dF724063511171f5bE34C39654928";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function main() {
  const [deployer] = await ethers.getSigners();

  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
  ];
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
  ];

  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);

  const amount = ethers.parseEther("0.001");
  const publicHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(100000), 32), 35); // 35 = Uint256

  const block = await ethers.provider.getBlock("latest");
  const blockTime = block.timestamp;
  console.log("Current block timestamp:", blockTime);

  // Let's test offset 0..65 for 4-byte uint32 or 8-byte uint64 or 5-byte uint40
  // Setting timestamp = blockTime
  for (let offset = 0; offset <= 129; offset += 4) {
    const proofBuf = new Uint8Array(137);
    const view = new DataView(proofBuf.buffer);
    view.setUint32(offset, blockTime, false); // Big Endian uint32

    try {
      const res = await vault.depositCollateral.staticCall(
        WETH_ARBITRUM_SEPOLIA,
        amount,
        publicHandle,
        ethers.hexlify(proofBuf)
      );
      console.log(`★ SUCCESS at uint32 offset ${offset}! Result:`, res);
      return;
    } catch (err) {
      if (err.data) {
        try {
          const text = ethers.toUtf8String("0x" + err.data.slice(138)).replace(/\0/g, '');
          if (text !== "Proof expired") {
            console.log(`Offset ${offset}: String -> "${text}"`);
          }
        } catch (e) {}
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
