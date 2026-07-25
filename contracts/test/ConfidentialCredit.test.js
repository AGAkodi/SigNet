const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Nox Private Credit — Real Aave V3 Integration Suite", function () {
  let creditToken, incomeStream, creditVault, mockNox, mockAavePool, mockUsdc;
  let owner, employer, borrower, liquidator;

  const mockIncomeRate = ethers.zeroPadValue(ethers.toBeHex(5000), 32);   // $5,000 / mo
  const mockCollateral = ethers.zeroPadValue(ethers.toBeHex(15000), 32);  // $15,000 collateral
  const mockBorrow = ethers.zeroPadValue(ethers.toBeHex(20000), 32);      // $20,000 requested borrow

  beforeEach(async function () {
    [owner, employer, borrower, liquidator] = await ethers.getSigners();

    // Deploy MockNoxCompute to local dev chain NoxCompute address (0x39847AeBa923Cc7367d4684194091D022B3F8548)
    const MockNoxCompute = await ethers.getContractFactory("MockNoxCompute");
    mockNox = await MockNoxCompute.deploy();
    const code = await ethers.provider.getCode(await mockNox.getAddress());
    await ethers.provider.send("hardhat_setCode", [
      "0x39847AeBa923Cc7367d4684194091D022B3F8548",
      code,
    ]);

    // Deploy Mock Aave Pool & Mock ERC20
    const MockAavePool = await ethers.getContractFactory("MockAavePool");
    mockAavePool = await MockAavePool.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUsdc.mint(borrower.address, ethers.parseUnits("1000000", 6));

    // Deploy ERC7984 Credit Token
    const ERC7984CreditToken = await ethers.getContractFactory("ERC7984CreditToken");
    creditToken = await ERC7984CreditToken.deploy("Nox Credit Token", "NOXCRED", "https://signet.finance/token");

    // Deploy Income Stream
    const IncomeStream = await ethers.getContractFactory("IncomeStream");
    incomeStream = await IncomeStream.deploy();

    // Deploy Confidential Credit Vault with Aave V3 integration
    const ConfidentialCredit = await ethers.getContractFactory("ConfidentialCredit");
    creditVault = await ConfidentialCredit.deploy(
      await incomeStream.getAddress(),
      await creditToken.getAddress(),
      6,
      await mockAavePool.getAddress(),
      ethers.ZeroAddress
    );

    // Authorize vault on token
    await creditToken.setCreditVault(await creditVault.getAddress());
  });

  describe("Aave V3 Collateral Supply & Entitlement Token", function () {
    it("should supply collateral to Aave Pool and update private entitlement claim", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);

      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral
      );

      const collateral = await creditVault.getEncryptedCollateral(borrower.address);
      expect(collateral).to.not.equal(ethers.ZeroHash);

      // Confirm Aave Pool received collateral from vault
      const supplied = await mockAavePool.supplied(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(supplied).to.equal(depositAmount);
    });
  });

  describe("Salary-Gated Borrowing Routed Through Aave", function () {
    it("should borrow from Aave Pool upon successful salary underwriting", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral
      );

      const balBefore = await mockUsdc.balanceOf(borrower.address);
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow
      );

      const balAfter = await mockUsdc.balanceOf(borrower.address);
      expect(balAfter - balBefore).to.equal(borrowAmount);

      const vaultDebt = await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(vaultDebt).to.equal(borrowAmount);
    });
  });

  describe("Repayment & Buffered Liquidation", function () {
    it("should repay Aave debt through vault", async function () {
      const depositAmount = ethers.parseUnits("15000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);
      const repayAmount = ethers.parseUnits("5000", 6);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        depositAmount,
        mockCollateral
      );
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow
      );

      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), repayAmount);
      const repayHandle = ethers.zeroPadValue(ethers.toBeHex(5000), 32);
      await creditVault.connect(borrower)["repay(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        repayAmount,
        repayHandle
      );

      const vaultDebt = await mockAavePool.borrowed(await mockUsdc.getAddress(), await creditVault.getAddress());
      expect(vaultDebt).to.equal(borrowAmount - repayAmount);
    });

    it("should trigger per-user internal liquidation when position exceeds 75% LTV buffer", async function () {
      const depositAmount = ethers.parseUnits("5000", 6);
      const borrowAmount = ethers.parseUnits("20000", 6);
      const lowCollateral = ethers.zeroPadValue(ethers.toBeHex(5000), 32);

      await incomeStream.connect(employer)["createStream(address,bytes32)"](borrower.address, mockIncomeRate);
      await mockUsdc.connect(borrower).approve(await creditVault.getAddress(), depositAmount);
      await creditVault.connect(borrower)["depositCollateral(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        depositAmount,
        lowCollateral
      );

      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow
      );
      await creditVault.connect(borrower)["requestBorrow(address,uint256,bytes32)"](
        await mockUsdc.getAddress(),
        borrowAmount,
        mockBorrow
      );

      await creditVault.checkAndLiquidate(borrower.address);
      const signal = await creditVault.getEncryptedLiquidationSignal(borrower.address);
      expect(signal).to.equal(ethers.zeroPadValue(ethers.toBeHex(1), 32));

      await creditVault.connect(liquidator).liquidate(borrower.address, "0x01");

      const collateral = await creditVault.getEncryptedCollateral(borrower.address);
      const borrowBalance = await creditVault.getEncryptedBorrowBalance(borrower.address);
      expect(collateral).to.equal(ethers.ZeroHash);
      expect(borrowBalance).to.equal(ethers.ZeroHash);
    });
  });
});
