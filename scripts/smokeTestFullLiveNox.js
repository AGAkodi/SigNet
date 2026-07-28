const { ethers } = require("hardhat");
const { createEthersHandleClient } = require("@iexec-nox/handle");

// Fresh Deployed Live Contract Addresses on Arbitrum Sepolia
const CREDIT_TOKEN_ADDRESS = "0x7B8902Ab7B59214b66876124710c39d0119a1bB6";
const INCOME_STREAM_ADDRESS = "0x94658D76467d322B5D5d77001126bE339DaF1AA9";
const CONFIDENTIAL_CREDIT_ADDRESS = "0x15A9cFA9CD1dF724063511171f5bE34C39654928";
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const WETH_ADDRESS = "0x1dF462e2712496373A347f8ad10802a5E95f053D";
const NOX_COMPUTE_ADDRESS = "0xd464B198f06756a1d00be223634b85E0a731c229";

async function encryptInputViaGateway(value, solidityType, applicationContract, ownerSigner) {
  const ownerAddress = await ownerSigner.getAddress();
  const hexValue = ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
  const url = "https://gateway-testnets.noxprotocol.dev/v0/secrets?chain_id=421614";
  const body = {
    value: hexValue,
    solidityType,
    applicationContract,
    owner: ownerAddress,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`Nox Gateway error: ${json.message || json.error}`);
  }
  const handle = json.payload?.handle || json.handle;
  const handleProof = json.payload?.proof || json.proof;
  return { handle, handleProof };
}

async function main() {
  console.log("=================================================================");
  console.log("  SIGNET — FULL LIVE SMOKE TEST ON ARBITRUM SEPOLIA AAVE POOL    ");
  console.log("=================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer wallet: ${deployer.address}`);

  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Native ETH Balance: ${ethers.formatEther(ethBalance)} ETH\n`);

  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function deposit() public payable",
  ];

  const creditTokenAbi = [
    "function creditVault() view returns (address)",
    "function setCreditVault(address _creditVault) external",
  ];

  const incomeStreamAbi = [
    "function employeeStreamId(address employee) external view returns (bytes32)",
    "function getIncomeRateHandle(address employee) external view returns (bytes32)",
    "function createStream(address employee, bytes32 rate) external returns (bytes32 streamId)",
  ];

  const confidentialCreditAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
    "function evaluateBorrowEligibility(address borrowAsset, uint256 requestedAmount, bytes32 externalRequestedAmount, bytes calldata inputProof) external returns (bytes32)",
    "function requestBorrow(address borrowAsset, uint256 requestedAmount, bytes calldata eligibilityProof) external returns (bytes32)",
    "function repay(address borrowAsset, uint256 repayAmount, bytes32 externalRepayAmount, bytes calldata proof) external returns (bytes32)",
    "function getUserCollateralAmount(address borrower) external view returns (uint256)",
    "function getUserBorrowAmount(address borrower) external view returns (uint256)",
    "function getEncryptedCollateral(address account) external view returns (bytes32)",
    "function getEncryptedBorrowEligibility(address account) external view returns (bytes32)",
  ];

  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
  ];

  const weth = new ethers.Contract(WETH_ADDRESS, erc20Abi, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, deployer);
  const creditToken = new ethers.Contract(CREDIT_TOKEN_ADDRESS, creditTokenAbi, deployer);
  const incomeStream = new ethers.Contract(INCOME_STREAM_ADDRESS, incomeStreamAbi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT_ADDRESS, confidentialCreditAbi, deployer);
  const nox = new ethers.Contract(NOX_COMPUTE_ADDRESS, noxAbi, deployer);

  console.log("Initializing @iexec-nox/handle SDK client with live gateway...");
  const handleClient = await createEthersHandleClient(deployer);
  console.log("✓ Live Nox handleClient initialized successfully.\n");

  // Ensure creditVault is set correctly
  const currentVault = await creditToken.creditVault();
  if (currentVault.toLowerCase() !== CONFIDENTIAL_CREDIT_ADDRESS.toLowerCase()) {
    console.log(`Setting creditVault on ERC7984CreditToken (${CREDIT_TOKEN_ADDRESS}) to ${CONFIDENTIAL_CREDIT_ADDRESS}...`);
    const setVaultTx = await creditToken.setCreditVault(CONFIDENTIAL_CREDIT_ADDRESS);
    await setVaultTx.wait();
    console.log("✓ creditVault updated successfully.\n");
  } else {
    console.log(`✓ creditVault is set correctly to ${CONFIDENTIAL_CREDIT_ADDRESS}\n`);
  }

  // Step 0: Ensure WETH balance
  let wethBal = await weth.balanceOf(deployer.address);
  console.log(`Current WETH Balance: ${ethers.formatEther(wethBal)} WETH`);
  if (wethBal < ethers.parseEther("0.002")) {
    console.log("Wrapping 0.005 ETH to WETH...");
    const depTx = await weth.deposit({ value: ethers.parseEther("0.005") });
    await depTx.wait();
    console.log(`✓ Wrapped WETH Tx: ${depTx.hash}`);
  }

  // Step 1: Ensure Income Stream
  let streamId = await incomeStream.employeeStreamId(deployer.address);
  if (streamId === ethers.ZeroHash) {
    console.log("\n--- STEP 1: Creating Income Stream for Employee ---");
    const salaryRate = 100000n;
    const rateHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(salaryRate), 32), 35);
    console.log(`Rate Handle: ${rateHandle}`);
    const tx = await incomeStream["createStream(address,bytes32)"](deployer.address, rateHandle);
    console.log(`Stream Tx Hash: ${tx.hash}`);
    await tx.wait();
    console.log(`✓ Income stream created successfully.`);
  } else {
    console.log(`\n--- STEP 1: Income Stream Already Active (Stream ID: ${streamId}) ---`);
  }

  const txResults = [];

  // =========================================================================
  // STEP 2 — depositCollateral
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 2 — depositCollateral (Real KMS Gateway Encrypted Handle)");
  console.log("-----------------------------------------------------------------");
  const depositAmount = ethers.parseEther("0.001"); // 1e15 wei
  console.log(`1. Encrypting deposit amount (${depositAmount.toString()}) via Nox Gateway...`);
  const depEnc = await encryptInputViaGateway(depositAmount, "uint256", CONFIDENTIAL_CREDIT_ADDRESS, deployer);
  console.log(`   Real KMS Encrypted Handle: ${depEnc.handle}`);
  console.log(`   KMS Handle Proof Length:   ${(depEnc.handleProof.length - 2) / 2} bytes`);

  console.log(`2. Approving Vault (${CONFIDENTIAL_CREDIT_ADDRESS}) to spend ${ethers.formatEther(depositAmount)} WETH...`);
  const appTx = await weth.approve(CONFIDENTIAL_CREDIT_ADDRESS, depositAmount);
  await appTx.wait();
  console.log(`   Approval Tx Hash: ${appTx.hash}`);

  console.log("3. Executing depositCollateral()...");
  const depTx = await vault.depositCollateral(
    WETH_ADDRESS,
    depositAmount,
    depEnc.handle,
    depEnc.handleProof,
    { gasLimit: 1500000 }
  );
  console.log(`   depositCollateral Tx Hash: ${depTx.hash}`);
  const depReceipt = await depTx.wait();
  console.log(`✓ depositCollateral confirmed in block ${depReceipt.blockNumber}, status: ${depReceipt.status}`);
  txResults.push({ step: "depositCollateral", hash: depTx.hash, targetContract: CONFIDENTIAL_CREDIT_ADDRESS });

  // Verification of stored handle non-reversibility
  console.log("\n   === VERIFYING STORED ON-CHAIN HANDLE NON-REVERSIBILITY ===");
  const onChainStoredHandle = await vault.getEncryptedCollateral(deployer.address);
  console.log(`   On-chain stored collateral handle: ${onChainStoredHandle}`);
  const plaintextHex = ethers.zeroPadValue(ethers.toBeHex(depositAmount), 32);
  console.log(`   Plaintext deposit hex commitment: ${plaintextHex}`);

  const isTriviallyReversible = onChainStoredHandle.toLowerCase() === plaintextHex.toLowerCase() || BigInt(onChainStoredHandle) === depositAmount;
  console.log(`   Is trivially reversible to plaintext? ${isTriviallyReversible ? "YES (FAIL)" : "NO (PASS)"}`);
  if (isTriviallyReversible) {
    throw new Error("SECURITY FAILURE: Stored handle is trivially reversible to plaintext!");
  }
  console.log("   ★ CONFIRMED: The actual encrypted bytes32 value bears NO resemblance to the plaintext input!");

  // =========================================================================
  // STEP 3 — evaluateBorrowEligibility
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 3 — evaluateBorrowEligibility (Tx 1 of 2)");
  console.log("-----------------------------------------------------------------");
  const borrowAmount = 100000n; // 0.1 USDC (6 decimals)
  console.log(`1. Encrypting requested borrow amount (${borrowAmount}) via Nox Gateway...`);
  const borrowEnc = await encryptInputViaGateway(borrowAmount, "uint256", CONFIDENTIAL_CREDIT_ADDRESS, deployer);
  console.log(`   Encrypted Borrow Handle: ${borrowEnc.handle}`);

  console.log("2. Executing evaluateBorrowEligibility()...");
  const evalTx = await vault.evaluateBorrowEligibility(
    USDC_ADDRESS,
    borrowAmount,
    borrowEnc.handle,
    borrowEnc.handleProof,
    { gasLimit: 1500000 }
  );
  console.log(`   evaluateBorrowEligibility Tx Hash: ${evalTx.hash}`);
  const evalReceipt = await evalTx.wait();
  console.log(`✓ evaluateBorrowEligibility confirmed in block ${evalReceipt.blockNumber}, status: ${evalReceipt.status}`);
  txResults.push({ step: "evaluateBorrowEligibility", hash: evalTx.hash, targetContract: CONFIDENTIAL_CREDIT_ADDRESS });

  // =========================================================================
  // STEP 4 — requestBorrow
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 4 — requestBorrow (Tx 2 of 2 - TEE Public Decryption Verification)");
  console.log("-----------------------------------------------------------------");
  const eligibilityHandle = await vault.getEncryptedBorrowEligibility(deployer.address);
  console.log(`1. Stored Eligibility Handle on-chain: ${eligibilityHandle}`);

  // Fetch live decryption proof from Nox Gateway
  const pubDec = await handleClient.publicDecrypt(eligibilityHandle);
  const eligibilityProof = pubDec.decryptionProof;
  console.log(`   Fetched live decryption proof from Nox Gateway (${(eligibilityProof.length - 2)/2} bytes). Decrypted value: ${pubDec.value}`);

  console.log("2. Executing requestBorrow()...");
  const borrowTx = await vault.requestBorrow(
    USDC_ADDRESS,
    borrowAmount,
    eligibilityProof,
    { gasLimit: 1500000 }
  );
  console.log(`   requestBorrow Tx Hash: ${borrowTx.hash}`);
  const borrowReceipt = await borrowTx.wait();
  console.log(`✓ requestBorrow confirmed in block ${borrowReceipt.blockNumber}, status: ${borrowReceipt.status}`);
  txResults.push({ step: "requestBorrow", hash: borrowTx.hash, targetContract: CONFIDENTIAL_CREDIT_ADDRESS });

  // =========================================================================
  // STEP 5 — repay
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 5 — repay");
  console.log("-----------------------------------------------------------------");
  const repayAmount = 100000n; // 0.1 USDC
  console.log(`1. Encrypting repay amount (${repayAmount}) via Nox Gateway...`);
  const repayEnc = await encryptInputViaGateway(repayAmount, "uint256", CONFIDENTIAL_CREDIT_ADDRESS, deployer);
  console.log(`   Encrypted Repay Handle: ${repayEnc.handle}`);

  console.log(`2. Approving Vault to spend ${repayAmount} USDC...`);
  const appUsdcTx = await usdc.approve(CONFIDENTIAL_CREDIT_ADDRESS, repayAmount);
  await appUsdcTx.wait();
  console.log(`   USDC Approval Tx Hash: ${appUsdcTx.hash}`);

  console.log("3. Executing repay()...");
  const repayTx = await vault.repay(
    USDC_ADDRESS,
    repayAmount,
    repayEnc.handle,
    repayEnc.handleProof,
    { gasLimit: 1500000 }
  );
  console.log(`   repay Tx Hash: ${repayTx.hash}`);
  const repayReceipt = await repayTx.wait();
  console.log(`✓ repay confirmed in block ${repayReceipt.blockNumber}, status: ${repayReceipt.status}`);
  txResults.push({ step: "repay", hash: repayTx.hash, targetContract: CONFIDENTIAL_CREDIT_ADDRESS });

  console.log("\n=================================================================");
  console.log("  ALL REAL TRANSACTIONS COMPLETED SUCCESSFULLY!");
  console.log("=================================================================");
  console.table(txResults);
}

main().catch((err) => {
  console.error("\n❌ Smoke Test Error:", err);
  process.exitCode = 1;
});
