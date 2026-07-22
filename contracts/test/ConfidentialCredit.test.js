const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Nox Private Credit — Confidential Contracts Suite", function () {
  let creditToken, incomeStream, creditVault;
  let owner, employer, borrower, liquidator;

  const mockIncomeRateHandle = ethers.keccak256(ethers.toUtf8Bytes("income_rate_5000_usdc"));
  const mockCollateralHandle = ethers.keccak256(ethers.toUtf8Bytes("collateral_10000_usdc"));
  const mockBorrowHandle = ethers.keccak256(ethers.toUtf8Bytes("borrow_20000_usdc"));
  const mockEligibilitySignal = ethers.keccak256(ethers.toUtf8Bytes("ebool_eligible_true"));
  const mockLiquidationSignal = ethers.keccak256(ethers.toUtf8Bytes("ebool_liquidatable_true"));

  beforeEach(async function () {
    [owner, employer, borrower, liquidator] = await ethers.getSigners();

    // Deploy ERC7984 Credit Token
    const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
    creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", 18);

    // Deploy Income Stream
    const IncomeStream = await ethers.getContractFactory("IncomeStream");
    incomeStream = await IncomeStream.deploy();

    // Deploy Confidential Credit Vault
    const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
    creditVault = await ConfidentialCredit.deploy(
      await incomeStream.getAddress(),
      await creditToken.getAddress()
    );

    // Authorize vault on token
    await creditToken.setCreditVault(await creditVault.getAddress());
  });

  describe("ERC7984 Credit Token", function () {
    it("should initialize token metadata correctly", async function () {
      expect(await creditToken.name()).to.equal("Nox Credit Token");
      expect(await creditToken.symbol()).to.equal("NOXCRED");
      expect(await creditToken.creditVault()).to.equal(await creditVault.getAddress());
    });
  });

  describe("IncomeStream Contract", function () {
    it("should allow employer to create an encrypted income stream", async function () {
      const tx = await incomeStream.connect(employer).createStream(borrower.address, mockIncomeRateHandle);
      await tx.wait();

      expect(await incomeStream.getIncomeRateHandle(borrower.address)).to.equal(mockIncomeRateHandle);
    });

    it("should allow employee to claim earned salary handle", async function () {
      const tx = await incomeStream.connect(employer).createStream(borrower.address, mockIncomeRateHandle);
      const receipt = await tx.wait();
      const streamId = await incomeStream.employeeStreamId(borrower.address);

      const newEarnedHandle = ethers.keccak256(ethers.toUtf8Bytes("earned_10000_usdc"));
      await incomeStream.connect(borrower).claimEarnedSalary(streamId, newEarnedHandle);

      expect(await incomeStream.getTotalEarnedHandle(borrower.address)).to.equal(newEarnedHandle);
    });
  });

  describe("ConfidentialCredit Vault", function () {
    it("should accept collateral deposits operating on encrypted handles", async function () {
      await creditVault.connect(borrower).depositCollateral(mockCollateralHandle);
      expect(await creditVault.getEncryptedCollateral(borrower.address)).to.equal(mockCollateralHandle);
    });

    it("should allow borrower with active stream to request borrow", async function () {
      await incomeStream.connect(employer).createStream(borrower.address, mockIncomeRateHandle);
      await creditVault.connect(borrower).depositCollateral(mockCollateralHandle);

      await creditVault.connect(borrower).requestBorrow(mockBorrowHandle, mockEligibilitySignal);

      expect(await creditVault.getEncryptedBorrowBalance(borrower.address)).to.equal(mockBorrowHandle);
      expect(await creditToken.balanceOfEncrypted(borrower.address)).to.equal(mockBorrowHandle);
    });

    it("should revert borrow request if borrower has no active income stream", async function () {
      await creditVault.connect(borrower).depositCollateral(mockCollateralHandle);

      await expect(
        creditVault.connect(borrower).requestBorrow(mockBorrowHandle, mockEligibilitySignal)
      ).to.be.revertedWith("IncomeStream: no active stream for employee");
    });

    it("should process loan repayment and update encrypted handles", async function () {
      await incomeStream.connect(employer).createStream(borrower.address, mockIncomeRateHandle);
      await creditVault.connect(borrower).depositCollateral(mockCollateralHandle);
      await creditVault.connect(borrower).requestBorrow(mockBorrowHandle, mockEligibilitySignal);

      const repayHandle = ethers.keccak256(ethers.toUtf8Bytes("repay_10000_usdc"));
      const updatedBalance = ethers.keccak256(ethers.toUtf8Bytes("borrow_10000_usdc"));

      await creditVault.connect(borrower).repay(repayHandle, updatedBalance);

      expect(await creditVault.getEncryptedBorrowBalance(borrower.address)).to.equal(updatedBalance);
      expect(await creditToken.balanceOfEncrypted(borrower.address)).to.equal(repayHandle);
    });

    it("should execute liquidation flow based strictly on boolean liquidation signal", async function () {
      await incomeStream.connect(employer).createStream(borrower.address, mockIncomeRateHandle);
      await creditVault.connect(borrower).depositCollateral(mockCollateralHandle);
      await creditVault.connect(borrower).requestBorrow(mockBorrowHandle, mockEligibilitySignal);

      // Set position liquidatable
      await creditVault.setLiquidationStatus(borrower.address, mockLiquidationSignal, true);
      expect(await creditVault.getLiquidationStatus(borrower.address)).to.be.true;

      // Liquidator acts on boolean signal
      await creditVault.connect(liquidator).liquidate(borrower.address);

      expect(await creditVault.getEncryptedBorrowBalance(borrower.address)).to.equal(ethers.ZeroHash);
      expect(await creditVault.getEncryptedCollateral(borrower.address)).to.equal(ethers.ZeroHash);
      expect(await creditVault.getLiquidationStatus(borrower.address)).to.be.false;
    });

    it("should revert liquidation call if position is not liquidatable", async function () {
      await expect(
        creditVault.connect(liquidator).liquidate(borrower.address)
      ).to.be.revertedWith("ConfidentialCredit: position is not liquidatable");
    });
  });
});
