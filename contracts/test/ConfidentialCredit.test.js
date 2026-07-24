const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Nox Private Credit — Real Nox Primitives Suite", function () {
  let creditToken, incomeStream, creditVault, mockNox;
  let owner, employer, borrower, liquidator;

  // Real Nox uint256 handles wrapping public values (mocking Nox.toEuint256)
  const mockIncomeRate = ethers.zeroPadValue(ethers.toBeHex(5000), 32);   // $5,000 / mo
  const mockCollateral = ethers.zeroPadValue(ethers.toBeHex(15000), 32);  // $15,000 collateral
  const mockBorrow = ethers.zeroPadValue(ethers.toBeHex(20000), 32);      // $20,000 requested borrow

  beforeEach(async function () {
    [owner, employer, borrower, liquidator] = await ethers.getSigners();

    // Deploy MockNoxCompute and etch to local chain NoxCompute address (0x39847AeBa923Cc7367d4684194091D022B3F8548)
    const MockNoxCompute = await ethers.getContractFactory("MockNoxCompute");
    mockNox = await MockNoxCompute.deploy();
    const code = await ethers.provider.getCode(await mockNox.getAddress());
    await ethers.provider.send("hardhat_setCode", [
      "0x39847AeBa923Cc7367d4684194091D022B3F8548",
      code,
    ]);

    // Deploy ERC7984 Credit Token
    const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
    creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "https://signet.finance/token");

    // Deploy Income Stream
    const IncomeStream = await ethers.getContractFactory("IncomeStream");
    incomeStream = await IncomeStream.deploy();

    // Deploy Confidential Credit Vault with 6x multiplier
    const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
    creditVault = await ConfidentialCredit.deploy(
      await incomeStream.getAddress(),
      await creditToken.getAddress(),
      6
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
      const tx = await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await tx.wait();

      const rate = await incomeStream.getIncomeRateHandle(borrower.address);
      expect(rate).to.not.equal(ethers.ZeroHash);
    });

    it("should initialize freshly created stream total earned to zero before claim and increase after claim", async function () {
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

  describe("ConfidentialCredit Vault", function () {
    it("should accept collateral deposits operating on euint256 handles", async function () {
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](mockCollateral);
      const collateral = await creditVault.getEncryptedCollateral(borrower.address);
      expect(collateral).to.not.equal(ethers.ZeroHash);
    });

    it("should allow borrower with active stream to request borrow within capacity", async function () {
      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](mockCollateral);

      await creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow);

      const borrowBalance = await creditVault.getEncryptedBorrowBalance(borrower.address);
      expect(borrowBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should revert borrow request if borrower has no active income stream", async function () {
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](mockCollateral);

      await expect(
        creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow)
      ).to.be.revertedWith("IncomeStream: no active stream for employee");
    });

    it("should process loan repayment using euint256 handles", async function () {
      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](mockCollateral);
      await creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow);

      const repayAmount = ethers.zeroPadValue(ethers.toBeHex(5000), 32);
      await creditVault.connect(borrower)["repay(bytes32)"](repayAmount);

      const borrowBalance = await creditVault.getEncryptedBorrowBalance(borrower.address);
      expect(borrowBalance).to.not.equal(ethers.ZeroHash);
    });

    it("should evaluate liquidation signal on-chain using TEE primitives", async function () {
      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](mockCollateral);
      await creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow);

      await creditVault.evaluateLiquidation(borrower.address);
      const signal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
      // Under healthy position ($20k borrow vs $45k capacity), liquidation boolean signal is false (0)
      expect(signal).to.equal(ethers.ZeroHash);
    });

    it("should correctly liquidate an underwater position", async function () {
      // 1. Create stream ($5,000 / mo => $30,000 income support)
      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);

      // 2. Deposit collateral ($5,000) => Total capacity = $35,000
      const lowCollateral = ethers.zeroPadValue(ethers.toBeHex(5000), 32);
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](lowCollateral);

      // 3. Request borrows totaling $40,000 ($20,000 x 2)
      await creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow);
      await creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow);

      // 4. Evaluate liquidation: borrow balance ($40k) exceeds total capacity ($35k)
      await creditVault.evaluateLiquidation(borrower.address);
      const signal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
      expect(signal).to.equal(ethers.zeroPadValue(ethers.toBeHex(1), 32));

      // 5. Liquidate position with valid decryption proof
      const validProof = "0x01";
      await creditVault.connect(liquidator).liquidate(borrower.address, validProof);

      // 6. Assert collateral and borrow balance handles are cleared to zero
      const collateral = await creditVault.getEncryptedCollateral(borrower.address);
      const borrowBalance = await creditVault.getEncryptedBorrowBalance(borrower.address);
      expect(collateral).to.equal(ethers.ZeroHash);
      expect(borrowBalance).to.equal(ethers.ZeroHash);
    });

    it("should revert liquidation attempt on a healthy position", async function () {
      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await creditVault.connect(borrower)["depositCollateral(bytes32)"](mockCollateral);
      await creditVault.connect(borrower)["requestBorrow(bytes32)"](mockBorrow);

      await creditVault.evaluateLiquidation(borrower.address);

      const validProof = "0x01";
      await expect(
        creditVault.connect(liquidator).liquidate(borrower.address, validProof)
      ).to.be.reverted;
    });
  });
});
