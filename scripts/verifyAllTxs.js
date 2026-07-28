const { ethers } = require("hardhat");

const DEPLOYER = "0x7530e58314e6519F204536B034296996A911Dd93";
const VAULT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";

async function main() {
  const provider = ethers.provider;
  console.log("Checking transactions for deployer:", DEPLOYER);

  const txHashes = [
    "0x81881c5300fbc6a35976494e8aa09e14368a27f66ff0127de5531b5ac5b7a269",
    "0x3af3ccc5a6b04711940fcb9cfc9a3135a7f4265dc8e520b5fe390384202425a5",
    "0xad8b87f6cbbe6e52b9c6f5adcdcf0c9d68faefad7faaa49533e0f7b8c1504bc6",
    "0x2a772e345163052a1aecc71f48852e3351e4afaa71e20b7474add85832a68df3",
    "0xef881638aa274c2f06e5e8e7185de1a7204e43a476e1bc422a22ce7caeb613bc",
    "0x18e87b5c0c8a97d2aec6449a54d8e481f8975f2d949d4489fd0d2a407f44f07c",
    "0xabfea877613a5c766c84f56b626580aba608ff4425f02c5fc1526a35505048ae",
    "0xa710ed524f231a399cd5ad06736fa935e2ee047b830b63442c29fe8a34d76b0d",
    "0xc564cbe3586f7174b04a412fc6d867c2cbf29a4976168ee6d67774b45560eab1",
    "0xb2281901febab4ea681c71fc552442f05dc95ce31f93a572f26caefe4f486902"
  ];

  for (const hash of txHashes) {
    const tx = await provider.getTransaction(hash);
    const receipt = await provider.getTransactionReceipt(hash);
    if (tx && receipt) {
      const selector = tx.data.slice(0, 10);
      console.log(`\nHash: ${hash}`);
      console.log(`  To:       ${tx.to}`);
      console.log(`  Selector: ${selector}`);
      console.log(`  Status:   ${receipt.status === 1 ? "SUCCESS (1)" : "REVERTED (0)"}`);
      console.log(`  Block:    ${receipt.blockNumber}`);
    } else {
      console.log(`\nHash not found: ${hash}`);
    }
  }
}

main().catch(console.error);
