const { ethers } = require("hardhat");

const VAULT = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";

async function main() {
  const provider = ethers.provider;
  console.log(`Querying all event logs for ConfidentialCredit Vault at ${VAULT}...`);

  const vaultAbi = [
    "event CollateralDeposited(address indexed borrower, address indexed asset, uint256 amount, bytes32 encryptedCollateralHandle)",
    "event BorrowEligibilityEvaluated(address indexed borrower, address indexed borrowAsset, uint256 requestedAmount, bytes32 isEligible)",
    "event BorrowRequested(address indexed borrower, address indexed asset, uint256 amount, bytes32 encryptedBorrowHandle)",
    "event RepaymentMade(address indexed borrower, address indexed asset, uint256 amount, bytes32 encryptedRepayHandle)",
  ];

  const vault = new ethers.Contract(VAULT, vaultAbi, provider);

  const logs = await provider.getLogs({
    address: VAULT,
    fromBlock: 292300000,
    toBlock: "latest",
  });

  console.log(`Total event logs found: ${logs.length}\n`);

  for (const log of logs) {
    try {
      const parsed = vault.interface.parseLog(log);
      console.log(`Event: ${parsed.name}`);
      console.log(`  Tx Hash: ${log.transactionHash}`);
      console.log(`  Block:   ${log.blockNumber}`);
      console.log(`  Args:    `, parsed.args);
      console.log("-----------------------------------------------------------------");
    } catch (e) {
      console.log(`Unparsed log topic: ${log.topics[0]} in tx ${log.transactionHash}`);
    }
  }
}

main().catch(console.error);
