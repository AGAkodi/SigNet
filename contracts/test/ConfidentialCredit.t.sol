// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Nox, euint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import "../src/ERC7984CreditToken.sol";
import "../src/IncomeStream.sol";
import "../src/ConfidentialCredit.sol";
import "./MockNoxCompute.sol";
import "./MockAavePool.sol";
import "./MockERC20.sol";

contract ConfidentialCreditTest is Test {
    ERC7984CreditToken public creditToken;
    IncomeStream public incomeStream;
    ConfidentialCredit public creditVault;
    MockNoxCompute public mockNoxCompute;
    MockAavePool public mockAavePool;
    MockERC20 public mockUsdc;

    address public owner = address(this);
    address public employer = address(0x111);
    address public borrower = address(0x222);
    address public liquidator = address(0x333);

    euint256 public mockIncomeRate;
    euint256 public mockCollateral;
    euint256 public mockBorrow;

    function setUp() public {
        // Deploy MockNoxCompute to local dev chain NoxCompute address (0x39847AeBa923Cc7367d4684194091D022B3F8548)
        mockNoxCompute = new MockNoxCompute();
        vm.etch(address(0x39847AeBa923Cc7367d4684194091D022B3F8548), address(mockNoxCompute).code);

        // Deploy Mock Aave Pool & Mock USDC Token
        mockAavePool = new MockAavePool();
        mockUsdc = new MockERC20("USD Coin", "USDC", 6);

        // Mint USDC to borrower for collateral deposit & repayment tests
        mockUsdc.mint(borrower, 1000000 * 1e6);

        // Initialize Nox handles for testing
        mockIncomeRate = Nox.toEuint256(5000);   // $5,000 / month
        mockCollateral = Nox.toEuint256(15000);  // $15,000 collateral handle
        mockBorrow = Nox.toEuint256(20000);      // $20,000 requested borrow ($20k <= $5k * 6 = $30k limit)

        // Deploy contracts
        creditToken = new ERC7984CreditToken("Nox Credit Token", "NOXCRED", "https://signet.finance/token");
        incomeStream = new IncomeStream();
        creditVault = new ConfidentialCredit(
            address(incomeStream),
            address(creditToken),
            6,
            address(mockAavePool),
            address(0)
        );

        // Configure vault permissions
        creditToken.setCreditVault(address(creditVault));
    }

    function test_TokenDeployment() public view {
        assertEq(creditToken.name(), "Nox Credit Token");
        assertEq(creditToken.symbol(), "NOXCRED");
        assertEq(creditToken.creditVault(), address(creditVault));
    }

    function test_IncomeStreamLifecycle() public {
        vm.startPrank(employer);
        bytes32 streamId = incomeStream.createStream(borrower, mockIncomeRate);
        vm.stopPrank();

        assertTrue(streamId != bytes32(0));
        euint256 rate = incomeStream.getIncomeRateHandle(borrower);
        assertTrue(Nox.isInitialized(rate));

        // Assert fresh stream total earned is 0 before any claim
        euint256 initialTotal = incomeStream.getTotalEarnedHandle(borrower);
        assertEq(euint256.unwrap(initialTotal), bytes32(0));

        // Warp time by 30 days and claim salary
        vm.warp(block.timestamp + 30 days);
        vm.startPrank(borrower);
        euint256 updatedTotal = incomeStream.claimEarnedSalary(streamId);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(updatedTotal));
        assertTrue(uint256(euint256.unwrap(updatedTotal)) > 0);
    }

    function test_DepositCollateral_RoutesToAavePool() public {
        uint256 depositAmount = 15000 * 1e6;
        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        euint256 collateralHandle = creditVault.depositCollateral(address(mockUsdc), depositAmount, mockCollateral);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(collateralHandle));
        // Verify real collateral is supplied to Aave Pool on behalf of creditVault
        assertEq(mockAavePool.supplied(address(mockUsdc), address(creditVault)), depositAmount);
    }

    function test_RequestBorrow_RoutesThroughAavePool() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;

        // 1. Create income stream
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        // 2. Deposit collateral
        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, mockCollateral);

        // 3. Request borrow within eligibility limit ($20,000 <= $30,000 ceiling)
        uint256 initialBalance = mockUsdc.balanceOf(borrower);
        euint256 borrowedHandle = creditVault.requestBorrow(address(mockUsdc), borrowAmount, mockBorrow);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(borrowedHandle));
        // Verify borrowed funds arrived in borrower's wallet
        assertEq(mockUsdc.balanceOf(borrower), initialBalance + borrowAmount);
        // Verify Aave Pool recorded vault debt
        assertEq(mockAavePool.borrowed(address(mockUsdc), address(creditVault)), borrowAmount);
    }

    function test_RepayLoan_RoutesToAavePool() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        uint256 repayAmount = 5000 * 1e6;

        // Setup borrow position
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, mockCollateral);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, mockBorrow);

        // Repay loan
        mockUsdc.approve(address(creditVault), repayAmount);
        euint256 repayHandle = Nox.toEuint256(5000);
        creditVault.repay(address(mockUsdc), repayAmount, repayHandle);
        vm.stopPrank();

        // Verify vault debt on Aave reduced from 20k to 15k
        assertEq(mockAavePool.borrowed(address(mockUsdc), address(creditVault)), borrowAmount - repayAmount);
    }

    function test_LiquidationFlow_TriggersWhenUnderwater() public {
        uint256 depositAmount = 5000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;

        // 1. Create stream ($5,000 / mo => $30,000 income support)
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        // 2. Deposit low collateral ($5,000) => Total capacity = $35,000
        euint256 lowCollateral = Nox.toEuint256(5000);
        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, lowCollateral);

        // 3. Request borrows totaling $40,000 ($20,000 x 2)
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, mockBorrow);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, mockBorrow);
        vm.stopPrank();

        // 4. Evaluate liquidation: borrow balance ($40k) exceeds buffered capacity ($35k * 75% LTV)
        ebool signal = creditVault.checkAndLiquidate(borrower);
        assertEq(ebool.unwrap(signal), bytes32(uint256(1)));

        // 5. Liquidate position with valid proof
        bytes memory proof = hex"01";
        vm.prank(liquidator);
        creditVault.liquidate(borrower, proof);

        // 6. Assert collateral and borrow balance handles are cleared to zero
        assertEq(euint256.unwrap(creditVault.getEncryptedCollateral(borrower)), bytes32(0));
        assertEq(euint256.unwrap(creditVault.getEncryptedBorrowBalance(borrower)), bytes32(0));
    }
}
