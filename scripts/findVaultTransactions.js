const { ethers } = require("hardhat");

const DEPLOYER = "0x7530e58314e6519F204536B034296996A911Dd93";
const VAULT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";

async function main() {
  const provider = ethers.provider;
  const latestBlock = await provider.getBlockNumber();
  console.log(`Scanning blocks from ${latestBlock - 20000} to ${latestBlock} for Vault calls...`);

  const vaultSelectors = {
    [ethers.id("depositCollateral(address,uint256,bytes32,bytes)").slice(0, 10)]: "depositCollateral",
    [ethers.id("evaluateBorrowEligibility(address,uint256,bytes32,bytes)").slice(0, 10)]: "evaluateBorrowEligibility",
    [ethers.id("requestBorrow(address,uint256,bytes)").slice(0, 10)]: "requestBorrow",
    [ethers.id("repay(address,uint256,bytes32,bytes)").slice(0, 10)]: "repay",
  };

  console.log("Known selectors:");
  console.table(vaultSelectors);

  const startBlock = latestBlock - 10000;
  for (let b = latestBlock; b >= startBlock; b -= 100) {
    const block = await provider.getBlock(b, true);
    if (!block || !block.prefetchedTransactions) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.to && tx.to.toLowerCase() === VAULT.toLowerCase()) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        const sel = tx.data.slice(0, 10);
        const name = vaultSelectors[sel] || sel;
        console.log(`Found Vault Tx: ${tx.hash}`);
        console.log(`  From:     ${tx.from}`);
        console.log(`  Method:   ${name} (${sel})`);
        console.log(`  Status:   ${receipt.status === 1 ? "SUCCESS (1)" : "REVERTED (0)"}`);
        console.log(`  Block:    ${receipt.blockNumber}`);
      }
    }
  }
}

main().catch(console.error);
