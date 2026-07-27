const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SIGNET — Real Aave V3 Comprehensive Suite", function () {
  let creditToken, incomeStream, creditVault, mockNox, mockAavePool, mockUsdc;
  let owner, employer, borrower, liquidator;

  const mockIncomeRate = ethers.zeroPadValue(ethers.toBeHex(5000), 32);   // $5,000 / mo
  const mockCollateral = ethers.zeroPadValue(ethers.toBeHex(15000), 32);  // $15,000 collateral
  const mockBorrow = ethers.zeroPadValue(ethers.toBeHex(20000), 32);      // $20,000 requested borrow
  const proof = "0x01";

  beforeEach(async function () {
    [owner, employer, borrower, liquidator] = await ethers.getSigners();

    const MockNoxCompute = await ethers.getContractFactory("MockNoxCompute");
    mockNox = await MockNoxCompute.deploy();
    const code = await ethers.provider.getCode(await mockNox.getAddress());
    await ethers.provider.send("hardhat_setCode", [
      "0x39847AeBa923Cc7367d4684194091D022B3F8548",
      code,
    ]);

    const MockAavePool = await ethers.getContractFactory("MockAavePool");
    mockAavePool = await MockAavePool.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUsdc.mint(borrower.address, ethers.parseUnits("1000000", 6));

    const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
    creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "https://signet.finance/token");

    const IncomeStream = await ethers.getContractFactory("IncomeStream");
    incomeStream = await IncomeStream.deploy();

    const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
    creditVault = await ConfidentialCredit.deploy(
      await incomeStream.getAddress(),
      await creditToken.getAddress(),
      6,
      await mockAavePool.getAddress(),
      ethers.ZeroAddress
    );

    await creditToken.setCreditVault(await creditVault.getAddress());
  });

  describe("1. Token Metadata & IncomeStream Lifecycle", function () {
    it("should initialize token metadata correctly", async function () {
      expect(await creditToken.name()).to.equal("Nox Credit Token");
      expect(await creditToken.symbol()).to.equal("NOXCRED");
      expect(await creditToken.creditVault()).to.equal(await creditVault.getAddress());
    });

    it("should create income stream, verify initial zero balance, and claim accrued salary after 30 days", async function () {
      const tx = await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await tx.wait();
      const streamId = await incomeStream.employeeStreamId(borrower.address);

      const initialTotal = await incomeStream.getTotalEarnedHandle(borrower.address);
      expect(initialTotal).to.equal(ethers.ZeroHash);

      await ethers.provider.send("evm_increaseTime", [30 * 86400]);
      await ethers.provider.send("evm_mine", []);

      const claimTx = await incomeStream.connect(borrower).claimEarnedSalary(streamId);
      await claimTx.wait();

      const totalEarned = await incomeStream.getTotalEarnedHandle(borrower.address);
      expect(totalEarned).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("2. Verified Collateral Deposit", function () {
    it("should deposit collateral with input proof and supply to Aave Pool", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);

      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      const collateral = await creditVault.getEncryptedCollateral(borrower.address);
      expect(collateral).to.not.equal(ethers.ZeroHash);

      const supplied = await mockAavePool.supplied(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(supplied).to.equal(depositAmount);
      expect(await creditVault.getUserCollateralAmount(borrower.address)).to.equal(depositAmount);
    });
  });

  describe("3. Strict 2-Transaction Salary-Gated Borrowing", function () {
    it("should borrow from Aave Pool using two separate transactions (Tx 1: Evaluate, Tx 2: Execute)", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      // Transaction 1: Standalone Evaluation
      await creditVault.connect(borrower).evaluateBorrowEligibility(
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof
      );
      expect(await creditVault.isBorrowEligibilityEvaluated(borrower.address)).to.be.true;
      expect(await creditVault.getEvaluatedBorrowAmount(borrower.address)).to.equal(borrowAmount);

      // Transaction 2: Standalone Execution with TEE proof
      const balBefore = await mockUsdc.balanceOf(borrower.address);
      await creditVault.connect(borrower).requestBorrow(
        await mockUsdc.getAddress(),
        borrowAmount,
        proof
      );

      const balAfter = await mockUsdc.balanceOf(borrower.address);
      expect(balAfter - balBefore).to.equal(borrowAmount);

      const vaultDebt = await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(vaultDebt).to.equal(borrowAmount);
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(borrowAmount);
      expect(await creditVault.isBorrowEligibilityEvaluated(borrower.address)).to.be.false; // Consumed
    });

    it("should REVERT when Tx 2 requested amount does not match Tx 1 evaluated amount", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const evalAmount = ethers.parseUnits("10000", 6);
      const higherRequestedAmount = ethers.parseUnits("50000", 6);
      const evalHandle = ethers.zeroPadValue(ethers.toBeHex(10000), 32);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      // Tx 1: Evaluate $10,000
      await creditVault.connect(borrower).evaluateBorrowEligibility(
        await mockUsdc.getAddress(),
        evalAmount,
        evalHandle,
        proof
      );

      // Tx 2: Try to borrow $50,000 -> Reverts!
      await expect(
        creditVault.connect(borrower).requestBorrow(
          await mockUsdc.getAddress(),
          higherRequestedAmount,
          proof
        )
      ).to.be.revertedWith("ConfidentialCredit: requested amount does not match evaluated amount");
    });

    it("should REVERT over-ceiling borrow request in Tx 2 and transfer NO real Aave funds", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const excessiveBorrowAmount = ethers.parseUnits("50000", 6); // $50,000 exceeds $30,000 ceiling
      const excessiveHandle = ethers.zeroPadValue(ethers.toBeHex(50000), 32);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      // Tx 1: Evaluate excessive amount
      await creditVault.connect(borrower).evaluateBorrowEligibility(
        await mockUsdc.getAddress(),
        excessiveBorrowAmount,
        excessiveHandle,
        proof
      );

      const balBefore = await mockUsdc.balanceOf(borrower.address);

      // Tx 2: Attempt borrow -> Reverts!
      await expect(
        creditVault.connect(borrower).requestBorrow(
          await mockUsdc.getAddress(),
          excessiveBorrowAmount,
          proof
        )
      ).to.be.revertedWith("ConfidentialCredit: requested borrow exceeds salary eligibility ceiling");

      const balAfter = await mockUsdc.balanceOf(borrower.address);
      expect(balAfter).to.equal(balBefore);
      expect(await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress())).to.equal(0);
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(0);
    });

    it("should REVERT borrow request in Tx 2 if Tx 1 was not called first", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);

      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      await expect(
        creditVault.connect(borrower).requestBorrow(
          await mockUsdc.getAddress(),
          borrowAmount,
          proof
        )
      ).to.be.revertedWith("ConfidentialCredit: eligibility not yet evaluated");
    });
  });

  describe("4. Repayment & Unwound Real Aave Liquidation", function () {
    it("should repay Aave debt through vault", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);
      const repayAmount = ethers.parseUnits("5000", 6);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), repayAmount);
      const repayHandle = ethers.zeroPadValue(ethers.toBeHex(5000), 32);
      await creditVault.connect(borrower)["repay(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        repayAmount,
        repayHandle,
        proof
      );

      const vaultDebt = await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(vaultDebt).to.equal(borrowAmount - repayAmount);
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(borrowAmount - repayAmount);
    });

    it("should NOT trigger liquidation on a healthy position", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      await creditVault.checkAndLiquidate(borrower.address);
      const signal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
      expect(signal).to.equal(ethers.ZeroHash);
    });

    it("should REVERT liquidation call on a healthy position", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral,
        proof
      );

      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      await creditVault.checkAndLiquidate(borrower.address);

      await expect(
        creditVault.connect(liquidator).liquidate(borrower.address, proof)
      ).to.be.revertedWith("ConfidentialCredit: position is healthy and not liquidatable");
    });

    it("should trigger liquidation AND unwind real Aave collateral/debt when position is underwater", async function () {
      const depositAmount = ethers.parseUnits("5000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);
      const lowCollateral = ethers.zeroPadValue(ethers.toBeHex(5000), 32);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        lowCollateral,
        proof
      );

      // Borrow Call 1 ($20,000)
      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      // Borrow Call 2 ($20,000 -> Total $40,000 debt vs $35,000 capacity)
      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      await creditVault.checkAndLiquidate(borrower.address);
      await creditVault.connect(liquidator).liquidate(borrower.address, proof);

      expect(await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress())).to.equal(ethers.parseUnits("35000", 6));
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(0);
      expect(await creditVault.getUserCollateralAmount(borrower.address)).to.equal(0);
      expect(await creditVault.getEncryptedCollateral(borrower.address)).to.equal(ethers.ZeroHash);
      expect(await creditVault.getEncryptedBorrowBalance(borrower.address)).to.equal(ethers.ZeroHash);
    });

    it("should REVERT liquidate() when borrower repays and becomes healthy between checkAndLiquidate (Tx 1) and liquidate (Tx 2)", async function () {
      const depositAmount = ethers.parseUnits("5000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);
      const repayAmount = ethers.parseUnits("10000", 6);
      const lowCollateral = ethers.zeroPadValue(ethers.toBeHex(5000), 32);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        depositAmount,
        lowCollateral,
        proof
      );

      // Borrow Call 1 ($20,000)
      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      // Borrow Call 2 ($20,000 -> Total $40,000 debt vs $35,000 capacity)
      await creditVault.connect(borrower).evaluateBorrowEligibility(await mockUsdc.getAddress(), borrowAmount, mockBorrow, proof);
      await creditVault.connect(borrower).requestBorrow(await mockUsdc.getAddress(), borrowAmount, proof);

      // 1. Position underwater -> checkAndLiquidate (Tx 1)
      await creditVault.checkAndLiquidate(borrower.address);
      const oldSignal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
      expect(oldSignal).to.not.equal(ethers.ZeroHash);

      // 2. Borrower repays $10,000 to become healthy -> triggers _autoCheckLiquidation & overwrites signal handle
      const repayHandle = ethers.zeroPadValue(ethers.toBeHex(10000), 32);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), repayAmount);
      await creditVault.connect(borrower)["repay(address,uint256,bytes32,bytes)"](
        await mockUsdc.getAddress(),
        repayAmount,
        repayHandle,
        proof
      );

      const newSignal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
      expect(newSignal).to.equal(ethers.ZeroHash); // Fresh signal overwritten to healthy (false)

      // 3. Liquidator attempts liquidate (Tx 2) with old proof -> REVERTS
      await expect(
        creditVault.connect(liquidator).liquidate(borrower.address, proof)
      ).to.be.revertedWith("ConfidentialCredit: position is healthy and not liquidatable");
    });
  });
});
