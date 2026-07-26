const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Nox Private Credit — Real Aave V3 Comprehensive Suite", function () {
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

  describe("3. Salary-Gated Borrowing (Issue 1 Gating Fix)", function () {
    it("should borrow from Aave Pool upon successful salary underwriting", async function () {
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

      const balBefore = await mockUsdc.balanceOf(borrower.address);
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof,
        proof
      );

      const balAfter = await mockUsdc.balanceOf(borrower.address);
      expect(balAfter - balBefore).to.equal(borrowAmount);

      const vaultDebt = await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(vaultDebt).to.equal(borrowAmount);
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(borrowAmount);
    });

    it("should REVERT over-ceiling borrow request and transfer NO real Aave funds (Issue 1 Verification)", async function () {
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

      const balBefore = await mockUsdc.balanceOf(borrower.address);

      await expect(
        creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
          await mockUsdc.getAddress(),
          excessiveBorrowAmount,
          excessiveHandle,
          proof,
          proof
        )
      ).to.be.revertedWith("ConfidentialCredit: requested borrow exceeds salary eligibility ceiling");

      // Verify NO real funds transferred and NO vault debt created
      const balAfter = await mockUsdc.balanceOf(borrower.address);
      expect(balAfter).to.equal(balBefore);
      expect(await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress())).to.equal(0);
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(0);
    });

    it("should revert borrow request if borrower has no active income stream", async function () {
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
        creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
          await mockUsdc.getAddress(),
          borrowAmount,
          mockBorrow,
          proof,
          proof
        )
      ).to.be.revertedWith("IncomeStream: no active stream for employee");
    });
  });

  describe("4. Repayment & Unwound Real Aave Liquidation (Issue 2 Fix)", function () {
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
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof,
        proof
      );

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
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof,
        proof
      );

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
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof,
        proof
      );

      await creditVault.checkAndLiquidate(borrower.address);

      await expect(
        creditVault.connect(liquidator).liquidate(borrower.address, proof)
      ).to.be.revertedWith("ConfidentialCredit: position is healthy and not liquidatable");
    });

    it("should trigger liquidation AND unwind real Aave collateral/debt when position is underwater (Issue 2 Verification)", async function () {
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

      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof,
        proof
      );

      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32,bytes,bytes)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow,
        proof,
        proof
      );

      await creditVault.checkAndLiquidate(borrower.address);
      await creditVault.connect(liquidator).liquidate(borrower.address, proof);

      // Verify REAL Aave collateral was withdrawn, REAL Aave debt was repaid (reduced from $40k to $35k by $5k collateral), and private handles cleared
      expect(await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress())).to.equal(ethers.parseUnits("35000", 6));
      expect(await creditVault.getUserBorrowAmount(borrower.address)).to.equal(0);
      expect(await creditVault.getUserCollateralAmount(borrower.address)).to.equal(0);
      expect(await creditVault.getEncryptedCollateral(borrower.address)).to.equal(ethers.ZeroHash);
      expect(await creditVault.getEncryptedBorrowBalance(borrower.address)).to.equal(ethers.ZeroHash);
    });
  });
});
