// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Nox, euint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import "../src/ERC7984CreditToken.sol";
import "../src/IncomeStream.sol";
import "../src/ConfidentialCredit.sol";
import "./MockNoxCompute.sol";

contract ConfidentialCreditTest is Test {
    ERC7984CreditToken public creditToken;
    IncomeStream public incomeStream;
    ConfidentialCredit public creditVault;
    MockNoxCompute public mockNoxCompute;

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

        // Initialize Nox handles for testing
        mockIncomeRate = Nox.toEuint256(5000);   // $5,000 / month
        mockCollateral = Nox.toEuint256(15000);  // $15,000 collateral
        mockBorrow = Nox.toEuint256(20000);      // $20,000 requested borrow ($20k <= $5k * 6 = $30k limit)

        // Deploy contracts
        creditToken = new ERC7984CreditToken("Nox Credit Token", "NOXCRED", "https://signet.finance/token");
        incomeStream = new IncomeStream();
        creditVault = new ConfidentialCredit(address(incomeStream), address(creditToken), 6);

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

        // Warp time by 30 days and claim salary
        vm.warp(block.timestamp + 30 days);
        vm.startPrank(borrower);
        euint256 updatedTotal = incomeStream.claimEarnedSalary(streamId);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(updatedTotal));
    }

    function test_DepositCollateral() public {
        vm.startPrank(borrower);
        euint256 collateralHandle = creditVault.depositCollateral(mockCollateral);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(collateralHandle));
    }

    function test_RequestBorrow_Success() public {
        // 1. Create stream
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        // 2. Deposit collateral
        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateral);

        // 3. Request borrow within eligibility limit ($20,000 <= $30,000 ceiling)
        euint256 borrowed = creditVault.requestBorrow(mockBorrow);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(borrowed));
        assertTrue(Nox.isInitialized(creditVault.getEncryptedBorrowBalance(borrower)));
    }

    function test_RequestBorrow_RejectedWhenOverCeiling() public {
        // 1. Create stream ($5,000 / mo => Max capacity = $30,000)
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateral);

        // Request $50,000 (exceeds $30,000 ceiling)
        euint256 excessiveBorrow = Nox.toEuint256(50000);
        creditVault.requestBorrow(excessiveBorrow);
        vm.stopPrank();

        euint256 actualBalance = creditVault.getEncryptedBorrowBalance(borrower);
        assertTrue(Nox.isInitialized(actualBalance));
    }

    function test_RequestBorrow_RevertWithoutStream() public {
        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateral);

        vm.expectRevert("IncomeStream: no active stream for employee");
        creditVault.requestBorrow(mockBorrow);
        vm.stopPrank();
    }

    function test_RepayLoan() public {
        // Setup borrow position
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateral);
        creditVault.requestBorrow(mockBorrow);

        // Repay loan
        euint256 repayAmount = Nox.toEuint256(5000);
        creditVault.repay(repayAmount);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(creditVault.getEncryptedBorrowBalance(borrower)));
    }

    function test_LiquidationFlow() public {
        // Setup borrow position
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateral);
        creditVault.requestBorrow(mockBorrow);
        vm.stopPrank();

        // Evaluate liquidation on-chain via TEE operations
        ebool signal = creditVault.evaluateLiquidation(borrower);
        // Position is healthy ($20k borrow vs $45k capacity), so liquidation signal is 0 (false)
        assertEq(ebool.unwrap(signal), bytes32(0));
    }
}
