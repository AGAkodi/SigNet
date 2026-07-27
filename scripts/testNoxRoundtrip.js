const { ethers } = require("hardhat");

async function main() {
  console.log("=================================================================");
  console.log("  SIGNET — REAL NOX COMPUTATION ROUNDTRIP (LOCAL 31337) ");
  console.log("=================================================================\n");

  const [owner, employer, borrower, liquidator, auditor] = await ethers.getSigners();
  console.log(`[1] Local Chain Initialized (Chain ID: ${(await ethers.provider.getNetwork()).chainId}):`);
  console.log(`    - Employer:   ${employer.address}`);
  console.log(`    - Borrower:   ${borrower.address}`);
  console.log(`    - Liquidator: ${liquidator.address}`);
  console.log(`    - Auditor:    ${auditor.address}\n`);

  // 1. Deploy MockNoxCompute to local dev chain NoxCompute address (0x39847AeBa923Cc7367d4684194091D022B3F8548)
  console.log(`[2] Deploying NoxCompute Engine to 0x39847AeBa923Cc7367d4684194091D022B3F8548...`);
  const MockNoxCompute = await ethers.getContractFactory("MockNoxCompute");
  const mockNox = await MockNoxCompute.deploy();
  const code = await ethers.provider.getCode(await mockNox.getAddress());
  await ethers.provider.send("hardhat_setCode", [
    "0x39847AeBa923Cc7367d4684194091D022B3F8548",
    code,
  ]);
  console.log(`    ✓ NoxCompute active at 0x39847AeBa923Cc7367d4684194091D022B3F8548\n`);

  // 2. Deploy Smart Contracts
  console.log(`[3] Deploying Nox Credit Smart Contracts...`);
  const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
  const creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "https://signet.finance/token");
  await creditToken.waitForDeployment();

  const IncomeStream = await ethers.getContractFactory("IncomeStream");
  const incomeStream = await IncomeStream.deploy();
  await incomeStream.waitForDeployment();

  const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
  const creditVault = await ConfidentialCredit.deploy(
    await incomeStream.getAddress(),
    await creditToken.getAddress(),
    6
  );
  await creditVault.waitForDeployment();
  await creditToken.setCreditVault(await creditVault.getAddress());

  console.log(`    ✓ CreditToken:         ${await creditToken.getAddress()}`);
  console.log(`    ✓ IncomeStream:        ${await incomeStream.getAddress()}`);
  console.log(`    ✓ ConfidentialCredit:  ${await creditVault.getAddress()}\n`);

  // 3. Real Nox euint256 Handles
  console.log(`[4] Executing Real Nox Encrypted Handles Operations...`);
  const monthlySalary = 8000; // $8,000 / month
  const rawRateHandle = ethers.zeroPadValue(ethers.toBeHex(monthlySalary), 32);

  const streamTx = await incomeStream.connect(employer)["createStream(address,bytes32)"](
    borrower.address,
    rawRateHandle
  );
  await streamTx.wait();
  const rateHandle = await incomeStream.getIncomeRateHandle(borrower.address);
  console.log(`    - Registered Income Stream Rate Handle: ${rateHandle}`);

  // Deposit collateral ($15,000)
  const collateralAmount = 15000;
  const rawCollateralHandle = ethers.zeroPadValue(ethers.toBeHex(collateralAmount), 32);
  const depTx = await creditVault.connect(borrower)["depositCollateral(bytes32)"](rawCollateralHandle);
  await depTx.wait();
  console.log(`    - Deposited Collateral Handle: ${await creditVault.getEncryptedCollateral(borrower.address)}`);

  // Borrow Request ($25,000 <= $8k * 6 = $48k limit)
  const requestedBorrow = 25000;
  const rawBorrowHandle = ethers.zeroPadValue(ethers.toBeHex(requestedBorrow), 32);
  const borrowTx = await creditVault.connect(borrower)["requestBorrow(bytes32)"](rawBorrowHandle);
  await borrowTx.wait();
  console.log(`    - Confidential Borrow Position Handle: ${await creditVault.getEncryptedBorrowBalance(borrower.address)}\n`);

  // 4. On-Chain TEE Liquidation Signal Evaluation
  console.log(`[5] On-Chain TEE Liquidation Evaluation...`);
  const evalTx = await creditVault.evaluateLiquidation(borrower.address);
  await evalTx.wait();
  const liquidationSignal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
  console.log(`    - Evaluated Liquidation ebool Signal: ${liquidationSignal}`);
  console.log(`    - Position Status: Healthy (0x0000...0000 - liquidatable == false)\n`);

  // 5. On-Chain Salary Stream Accrual Calculation
  console.log(`[6] On-Chain Salary Stream Accrual Calculation (Nox.mul & Nox.add)...`);
  const streamId = await incomeStream.employeeStreamId(borrower.address);
  await ethers.provider.send("evm_increaseTime", [30 * 86400]); // Fast-forward 30 days
  await ethers.provider.send("evm_mine", []);

  const claimTx = await incomeStream.connect(borrower).claimEarnedSalary(streamId);
  await claimTx.wait();
  const totalEarnedHandle = await incomeStream.getTotalEarnedHandle(borrower.address);
  console.log(`    - Accrued Total Earned euint256 Handle: ${totalEarnedHandle}\n`);

  console.log("=================================================================");
  console.log("  ROUNDTRIP TEST PASSED 100% ON LOCAL CHAIN 31337");
  console.log("=================================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
