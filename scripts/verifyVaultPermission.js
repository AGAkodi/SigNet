const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x7B8902Ab7B59214b66876124710c39d0119a1bB6";
  const expectedVault = "0xECA515C29Eb3FD70cCdA5c8E2602a9094C137A65";
  const txHash = "0x939448cb2c5a11803e1ec98ef4b73f77151febfe14651079d1db6d1afcdb91a2";

  console.log("=================================================================");
  console.log("  VERIFYING ERC7984 CREDIT VAULT PERMISSION ON ARBITRUM SEPOLIA   ");
  console.log("=================================================================\n");

  const provider = ethers.provider;

  // Query transaction status
  console.log(`Checking transaction status for: ${txHash}`);
  const txReceipt = await provider.getTransactionReceipt(txHash);
  if (txReceipt) {
    console.log(`Transaction Receipt Status: ${txReceipt.status === 1 ? "Success (1)" : "Failed (0)"}`);
    console.log(`Block Number: ${txReceipt.blockNumber}`);
  } else {
    console.log("Transaction receipt not found yet.");
  }

  const tx = await provider.getTransaction(txHash);
  if (tx) {
    console.log(`Tx To: ${tx.to}`);
    console.log(`Tx Data: ${tx.data}`);
  }

  // Query on-chain state getter creditVault()
  console.log(`\nQuerying ERC7984CreditToken at: ${tokenAddress}`);
  const abi = ["function creditVault() external view returns (address)"];
  const tokenContract = new ethers.Contract(tokenAddress, abi, provider);

  const currentVault = await tokenContract.creditVault();
  console.log(`Currently set creditVault address: ${currentVault}`);
  console.log(`Expected ConfidentialCredit address: ${expectedVault}`);
  console.log(`Match Verified: ${currentVault.toLowerCase() === expectedVault.toLowerCase()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
