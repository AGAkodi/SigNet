// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ERC7984CreditToken.sol";
import "../src/IncomeStream.sol";
import "../src/ConfidentialCredit.sol";

contract ConfidentialCreditTest is Test {
    ERC7984CreditToken public creditToken;
    IncomeStream public incomeStream;
    ConfidentialCredit public creditVault;

    address public owner = address(this);
    address public employer = address(0x111);
    address public borrower = address(0x222);
    address public liquidator = address(0x333);

    bytes32 public mockIncomeRateHandle = keccak256("income_rate_5000_usdc");
    bytes32 public mockCollateralHandle = keccak256("collateral_10000_usdc");
    bytes32 public mockBorrowHandle = keccak256("borrow_20000_usdc");
    bytes32 public mockEligibilitySignal = keccak256("ebool_eligible_true");
    bytes32 public mockLiquidationSignal = keccak256("ebool_liquidatable_true");

    function setUp() public {
        // Deploy contracts
        creditToken = new ERC7984CreditToken("Nox Credit Token", "NOXCRED", 18);
        incomeStream = new IncomeStream();
        creditVault = new ConfidentialCredit(address(incomeStream), address(creditToken));

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
        bytes32 streamId = incomeStream.createStream(borrower, mockIncomeRateHandle);
        vm.stopPrank();

        assertTrue(streamId != bytes32(0));
        assertEq(incomeStream.getIncomeRateHandle(borrower), mockIncomeRateHandle);

        // Employee claims salary
        bytes32 newEarnedHandle = keccak256("earned_10000_usdc");
        vm.startPrank(borrower);
        incomeStream.claimEarnedSalary(streamId, newEarnedHandle);
        vm.stopPrank();

        assertEq(incomeStream.getTotalEarnedHandle(borrower), newEarnedHandle);
    }

    function test_DepositCollateral() public {
        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateralHandle);
        vm.stopPrank();

        assertEq(creditVault.getEncryptedCollateral(borrower), mockCollateralHandle);
    }

    function test_RequestBorrow_Success() public {
        // 1. Create stream
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRateHandle);

        // 2. Deposit collateral
        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateralHandle);

        // 3. Request borrow
        creditVault.requestBorrow(mockBorrowHandle, mockEligibilitySignal);
        vm.stopPrank();

        assertEq(creditVault.getEncryptedBorrowBalance(borrower), mockBorrowHandle);
        assertEq(creditToken.balanceOfEncrypted(borrower), mockBorrowHandle);
    }

    function test_RequestBorrow_RevertWithoutStream() public {
        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateralHandle);

        vm.expectRevert("IncomeStream: no active stream for employee");
        creditVault.requestBorrow(mockBorrowHandle, mockEligibilitySignal);
        vm.stopPrank();
    }

    function test_RepayLoan() public {
        // Setup borrow position
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRateHandle);

        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateralHandle);
        creditVault.requestBorrow(mockBorrowHandle, mockEligibilitySignal);

        // Repay loan
        bytes32 repayAmountHandle = keccak256("repay_10000_usdc");
        bytes32 updatedBalanceHandle = keccak256("borrow_10000_usdc");
        creditVault.repay(repayAmountHandle, updatedBalanceHandle);
        vm.stopPrank();

        assertEq(creditVault.getEncryptedBorrowBalance(borrower), updatedBalanceHandle);
        assertEq(creditToken.balanceOfEncrypted(borrower), repayAmountHandle);
    }

    function test_LiquidationFlow() public {
        // Setup borrow position
        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRateHandle);

        vm.startPrank(borrower);
        creditVault.depositCollateral(mockCollateralHandle);
        creditVault.requestBorrow(mockBorrowHandle, mockEligibilitySignal);
        vm.stopPrank();

        // 1. Position becomes liquidatable (owner sets liquidation boolean signal)
        creditVault.setLiquidationStatus(borrower, mockLiquidationSignal, true);
        assertTrue(creditVault.getLiquidationStatus(borrower));

        // 2. Liquidator executes liquidation
        vm.prank(liquidator);
        creditVault.liquidate(borrower);

        // 3. Verify position cleared and boolean reset
        assertEq(creditVault.getEncryptedBorrowBalance(borrower), bytes32(0));
        assertEq(creditVault.getEncryptedCollateral(borrower), bytes32(0));
        assertFalse(creditVault.getLiquidationStatus(borrower));
    }

    function test_Liquidate_RevertIfHealthy() public {
        vm.prank(liquidator);
        vm.expectRevert("ConfidentialCredit: position is not liquidatable");
        creditVault.liquidate(borrower);
    }
}
