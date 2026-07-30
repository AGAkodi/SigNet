import { parseTxError } from './errorHelper.ts';

// Helper to run assertions
function assertEqual(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed!\nExpected: "${expected}"\nActual:   "${actual}"`);
  }
}

console.log("Running parseTxError tests...");

// Test Case 1: Simple custom error selector in message
const err1 = {
  message: "execution reverted: 0x3e1d1a10",
};
assertEqual(parseTxError(err1), "Transaction would fail: Health factor too low / Insufficient collateral on Aave");

// Test Case 2: Standalone error selector in message
const err2 = {
  message: "reverted with the following signature:\n0x5c0b115b\n\n",
};
assertEqual(parseTxError(err2), "Transaction would fail: Health factor too low / Insufficient collateral on Aave");

// Test Case 3: Error selector in error.data
const err3 = {
  data: "0x1f0d3a5a",
};
assertEqual(parseTxError(err3), "Transaction would fail: Borrowing not enabled for asset on Aave");

// Test Case 4: Custom error revert data in error.data (longer hex payload starting with selector)
const err4 = {
  data: "0x3e1d1a100000000000000000000000000000000000000000000000000000000000000005",
};
assertEqual(parseTxError(err4), "Transaction would fail: Health factor too low / Insufficient collateral on Aave");

// Test Case 5: Nested error.cause.data
const err5 = {
  cause: {
    data: "0x3e1d1a10",
  },
};
assertEqual(parseTxError(err5), "Transaction would fail: Health factor too low / Insufficient collateral on Aave");

// Test Case 6: Nested walk structure (viem structure)
const err6 = {
  walk: (fn: any) => {
    // Simulate walk finding a node with err.data
    const node = { data: "0x1f0d3a5a" };
    if (fn(node)) return node;
    return null;
  },
};
assertEqual(parseTxError(err6), "Transaction would fail: Borrowing not enabled for asset on Aave");

// Test Case 7: Unrecognized error selector
const err7 = {
  data: "0x12345678",
};
assertEqual(parseTxError(err7), "Contract reverted with unrecognized error 0x12345678 — check 4byte.directory or the source ABI");

// Test Case 8: False positive prevention (transaction hash)
const txHash = "0x771e8f5606ac6376e9c926090f271abd23c5e83ead3a22f92ed10a020d3bb86f";
const err8 = {
  message: `Transaction failed with hash ${txHash}`,
};
assertEqual(parseTxError(err8), `Transaction failed with hash ${txHash}`);

// Test Case 9: False positive prevention (address)
const address = "0x6f5e52c71A88Ba8973061d3dCE5619EbA65B8Fb4";
const err9 = {
  message: `Failed for address ${address}`,
};
assertEqual(parseTxError(err9), `Failed for address ${address}`);

// Test Case 10: Standard Solidity Error(string) decoding
const err10 = {
  data: "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002b496e636f6d6553747265616d3a206e6f206163746976652073747265616d20666f7220656d706c6f796565000000000000000000000000000000000000000000",
};
assertEqual(parseTxError(err10), "IncomeStream: no active stream for employee");

console.log("All parseTxError tests passed successfully!");
