const { ethers } = require("hardhat");

async function main() {
  const errors = [
    "InvalidZeroAddress()",
    "InvalidEmptyBytes()",
    "UnauthorizedSender(address)",
    "NotAllowed(bytes32,address)",
    "InvalidProof(bytes,string)",
    "UnsupportedType()",
    "IncompatibleTypes()",
    "NotPubliclyDecryptable(bytes32)",
    "PublicHandleACLForbidden()",
    "UndefinedHandle()",
    "NonArithmeticType()",
    "UnsupportedArithmeticType()",
    "MalformedDecryptedData(bytes)",
    "SafeERC20FailedOperation(address)",
    "ERC20InsufficientBalance(address,uint256,uint256)",
    "ERC20InsufficientAllowance(address,uint256,uint256)",
    "ReentrancyGuardReentrantCall()",
  ];

  console.log("Looking for selector 0xf645eedf:");
  for (const err of errors) {
    const sel = ethers.id(err).slice(0, 10);
    console.log(`  ${sel} -> ${err}`);
    if (sel === "0xf645eedf") {
      console.log(`★★★ MATCH FOUND: ${err} ★★★`);
    }
  }
}

main().catch(console.error);
