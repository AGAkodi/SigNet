const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  const list = [
    { step: "Setup (WETH Approve)", hash: "0x4d457f36ae192aea813193d09fb4f8db98bc36582d805e1a5045c4376b44e889" },
    { step: "Step 1 (IncomeStream)", hash: "0x33df206fd62502430b7027d59f2752aa01030b4870ec6f0f6ff36c0f3632da16" },
    { step: "Step 2 (depositCollateral)", hash: "0x1b8aad911805d86b8dc1c426be99743d60d7ce0f759e7baec3b110834a61d7cd" },
    { step: "Step 3 (evaluateBorrowEligibility)", hash: "0xde04521115625b976bd6bb8302eecf1415fc719b27b8755bfe03ba88ad059d19" },
    { step: "Step 4 (requestBorrow)", hash: "0x14e9f37c66ac1c3d5f97ea177817dd0802cf9de54215582a02fdb40992c516a2" },
    { step: "Setup (USDC Approve)", hash: "0xaee32783bd125daf6651cec5db7322c26617b12a3f420c07c753d32ffcbee9af" },
    { step: "Step 5 (repay)", hash: "0x1d68b702b9da971e52737f767910b9ec5f5276837ba02e80e2cc4895279b8265" },
  ];

  for (const item of list) {
    const tx = await provider.getTransaction(item.hash);
    const receipt = await provider.getTransactionReceipt(item.hash);
    if (tx && receipt) {
      console.log(`Step: ${item.step}`);
      console.log(`  Hash:   ${item.hash}`);
      console.log(`  To:     ${tx.to}`);
      console.log(`  Status: ${receipt.status === 1 ? "SUCCESS (1)" : "REVERTED (0)"}`);
      console.log(`  Block:  ${receipt.blockNumber}`);
    }
  }
}

main().catch(console.error);
