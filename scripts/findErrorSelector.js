const { ethers } = require("hardhat");

async function main() {
  const target = "0x84a73f36";
  const commonErrors = [
    "TransferFailed()",
    "InvalidAsset()",
    "InsufficientAllowance()",
    "InsufficientBalance()",
    "InvalidAmount()",
    "AmountMismatch()",
    "ProofMismatch()",
    "OwnerMismatch()",
    "AppMismatch()",
    "VaultMismatch()",
    "NotVault()",
    "OnlyVault()",
    "InvalidVault()",
    "AlreadyInitialized()",
    "NotInitialized()",
    "StreamNotFound()",
    "NoActiveStream()",
  ];

  for (const err of commonErrors) {
    const sel = ethers.id(err).slice(0, 10);
    if (sel === target) {
      console.log(`\n★★★ MATCH FOUND: ${err} -> ${sel} ★★★\n`);
    }
  }

  // Also check standard OpenZeppelin / Ethers errors
  console.log("Finished check.");
}

main().catch(console.error);
