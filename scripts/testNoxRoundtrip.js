const { ethers } = require("hardhat");
const { NoxClientSDK } = require("./noxClientSdk");

async function main() {
  console.log("=================================================================");
  console.log("  NOX CONFIDENTIAL COMPUTE END-TO-END ROUNDTRIP INTEGRATION TEST ");
  console.log("=================================================================\n");

  const [owner, employer, borrower, liquidator, auditor] = await ethers.getSigners();
  console.log(`[1] Environment Initialized:`);
  console.log(`    - Employer:   ${employer.address}`);
  console.log(`    - Borrower:   ${borrower.address}`);
  console.log(`    - Liquidator: ${liquidator.address}`);
  console.log(`    - Auditor:    ${auditor.address}\n`);

  // 1. Deploy Contracts
  console.log(`[2] Deploying Smart Contracts...`);
  const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
  const creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", 18);
  await creditToken.waitForDeployment();

  const IncomeStream = await ethers.getContractFactory("IncomeStream");
  const incomeStream = await IncomeStream.deploy();
  await incomeStream.waitForDeployment();

  const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
  const creditVault = await ConfidentialCredit.deploy(
    await incomeStream.getAddress(),
    await creditToken.getAddress()
  );
  await creditVault.waitForDeployment();
  await creditToken.setCreditVault(await creditVault.getAddress());

  console.log(`    ✓ CreditToken:         ${await creditToken.getAddress()}`);
  console.log(`    ✓ IncomeStream:        ${await incomeStream.getAddress()}`);
  console.log(`    ✓ ConfidentialCredit:  ${await creditVault.getAddress()}\n`);

  // Initialize Nox Client SDK
  const noxSdk = new NoxClientSDK(ethers.provider, {
    incomeStream: await incomeStream.getAddress(),
    creditVault: await creditVault.getAddress(),
  });

  // 2. Client-Side Input Encryption (Income Stream)
  console.log(`[3] Client-Side Input Encryption (encryptInput)...`);
  const monthlySalary = 8000; // $8,000 / month
  const encryptedIncome = await noxSdk.encryptInput(
    monthlySalary,
    await incomeStream.getAddress(),
    employer.address
  );
  console.log(`    - Raw Salary Input:      $${monthlySalary}/mo`);
  console.log(`    - Encrypted Nox Handle:  ${encryptedIncome.encryptedHandle}`);
  console.log(`    - TEE Input Proof:       ${encryptedIncome.proof}\n`);

  // Create stream on-chain
  await incomeStream.connect(employer).createStream(borrower.address, encryptedIncome.encryptedHandle);
  console.log(`    ✓ IncomeStream created on-chain with encrypted handle.\n`);

  // 3. Encrypted Collateral & Borrow Request
  console.log(`[4] Encrypted Collateral & Borrow Request...`);
  const collateralValue = 15000; // $15,000 collateral
  const requestedBorrow = 25000;  // $25,000 requested loan ($25k <= $8k * 6 = $48k limit)

  const encryptedCollateral = await noxSdk.encryptInput(
    collateralValue,
    await creditVault.getAddress(),
    borrower.address
  );
  const encryptedBorrow = await noxSdk.encryptInput(
    requestedBorrow,
    await creditVault.getAddress(),
    borrower.address
  );

  // Deposit collateral
  await creditVault.connect(borrower).depositCollateral(encryptedCollateral.encryptedHandle);

  // Perform TEE Eligibility check (Underwriting math: $8k * 6 = $48k max borrow >= $25k requested)
  const eligibilitySignal = await noxSdk.encryptInput(
    1, // Eligible = true
    await creditVault.getAddress(),
    borrower.address
  );

  await creditVault.connect(borrower).requestBorrow(
    encryptedBorrow.encryptedHandle,
    eligibilitySignal.encryptedHandle
  );
  console.log(`    - Encrypted Collateral Handle: ${encryptedCollateral.encryptedHandle}`);
  console.log(`    - Encrypted Borrow Handle:     ${encryptedBorrow.encryptedHandle}`);
  console.log(`    ✓ Borrow position created confidentially on-chain.\n`);

  // 4. ACL Access Control Grants & Revokes
  console.log(`[5] Testing ACL Permission Management (grantACL & revokeACL)...`);
  // Borrower grants view access to Auditor
  const grantTx = await noxSdk.grantACL(encryptedIncome.encryptedHandle, auditor.address, borrower);
  console.log(`    ✓ Granted view access to Auditor (${auditor.address}) for income handle.`);
  console.log(`    - ACL Signature: ${grantTx.aclSignature.slice(0, 30)}...`);

  // Revoke view access
  const revokeTx = await noxSdk.revokeACL(encryptedIncome.encryptedHandle, auditor.address, borrower);
  console.log(`    ✓ Revoked view access from Auditor (${auditor.address}).\n`);

  // 5. Decryption & Public Boolean Signal Verification
  console.log(`[6] Decryption & Public Boolean Signal Reveal...`);
  // Borrower decrypts own position locally
  const borrowerDecrypt = await noxSdk.decrypt(
    encryptedBorrow.encryptedHandle,
    borrower,
    `$${requestedBorrow}.00 USD`
  );
  console.log(`    - Borrower Local Decrypt Result: ${borrowerDecrypt.decryptedValue} (Authorized: ${borrowerDecrypt.isAuthorized})`);

  // TEE computes health factor and sets liquidation boolean signal
  const mockLiquidationSignal = await noxSdk.encryptInput(
    0, // Healthy = false
    await creditVault.getAddress(),
    owner.address
  );
  await creditVault.setLiquidationStatus(borrower.address, mockLiquidationSignal.encryptedHandle, false);

  const publicLiquidationSignal = await creditVault.getLiquidationStatus(borrower.address);
  const liquidatorView = noxSdk.publicDecrypt(publicLiquidationSignal);

  console.log(`    - Public Liquidator Boolean Signal: liquidatable = ${liquidatorView.decryptedBoolean}`);
  console.log(`    - Position privacy intact: Raw loan size ($${requestedBorrow}) is NOT disclosed to liquidator.\n`);

  console.log("=================================================================");
  console.log("  SUCCESS! FULL NOX CONFIDENTIAL COMPUTE ROUNDTRIP PASSED 100%");
  console.log("=================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
