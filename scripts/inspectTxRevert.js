const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x771e8f5606ac6376e9c926090f271abd23c5e83ead3a22f92ed10a020d3bb86f";
  const provider = ethers.provider;

  const tx = await provider.getTransaction(txHash);
  console.log("Tx From:", tx.from);
  console.log("Tx To:  ", tx.to);

  try {
    const res = await provider.call({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      blockNumber: tx.blockNumber - 1,
    });
    console.log("Call result:", res);
  } catch (err) {
    console.log("Revert reason:", err.message);
    if (err.data) {
      console.log("Revert err.data:", err.data);
      try {
        const text = ethers.toUtf8String("0x" + err.data.slice(138)).replace(/\0/g, '');
        console.log("Decoded text:", text);
      } catch (e) {}
    }
  }
}

main().catch(console.error);
