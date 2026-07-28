const { ethers } = require("hardhat");

const DEPLOYER = "0x7530e58314e6519F204536B034296996A911Dd93";
const VAULT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";

async function main() {
  const provider = ethers.provider;
  const nonce = await provider.getTransactionCount(DEPLOYER);
  console.log(`Deployer transaction count (nonce): ${nonce}`);

  const vaultSelectors = {
    [ethers.id("depositCollateral(address,uint256,bytes32,bytes)").slice(0, 10)]: "depositCollateral",
    [ethers.id("evaluateBorrowEligibility(address,uint256,bytes32,bytes)").slice(0, 10)]: "evaluateBorrowEligibility",
    [ethers.id("requestBorrow(address,uint256,bytes)").slice(0, 10)]: "requestBorrow",
    [ethers.id("repay(address,uint256,bytes32,bytes)").slice(0, 10)]: "repay",
    [ethers.id("setCreditVault(address)").slice(0, 10)]: "setCreditVault",
    [ethers.id("approve(address,uint256)").slice(0, 10)]: "approve",
  };

  // We can scan recent transactions from log receipts or block range where nonce grew
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);

  const foundTxs = [];

  for (let b = latestBlock; b >= latestBlock - 5000; b--) {
    const block = await provider.getBlock(b, true);
    if (!block || !block.prefetchedTransactions) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.from && tx.from.toLowerCase() === DEPLOYER.toLowerCase()) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        const sel = tx.data.slice(0, 10);
        const name = vaultSelectors[sel] || sel;
        foundTxs.push({
          hash: tx.hash,
          to: tx.to,
          method: name,
          selector: sel,
          status: receipt.status === 1 ? "SUCCESS" : "REVERTED",
          block: receipt.blockNumber
        });
        console.log(`Found Deployer Tx: ${tx.hash} | To: ${tx.to} | Method: ${name} | Status: ${receipt.status === 1 ? "SUCCESS" : "REVERTED"}`);
      }
    }
  }

  console.log("\nSummary Table of Deployer Transactions:");
  console.table(foundTxs);
}

main().catch(console.error);
