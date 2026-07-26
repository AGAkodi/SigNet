// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import "../src/ERC7984CreditToken.sol";
import "../src/IncomeStream.sol";
import "../src/ConfidentialCredit.sol";
import "../src/MockNoxCompute.sol";
import "../src/MockAavePool.sol";
import "../src/MockERC20.sol";

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
    bytes public proof = hex"01";

    function setUp() public {
        mockNoxCompute = new MockNoxCompute();
        vm.etch(address(0x39847AeBa923Cc7367d4684194091D022B3F8548), address(mockNoxCompute).code);

        mockAavePool = new MockAavePool();
        mockUsdc = new MockERC20("USD Coin", "USDC", 6);
        mockUsdc.mint(borrower, 1000000 * 1e6);

        mockIncomeRate = Nox.toEuint256(5000);   // $5,000 / month
        mockCollateral = Nox.toEuint256(15000);  // $15,000 collateral
        mockBorrow = Nox.toEuint256(20000);      // $20,000 requested borrow

        creditToken = new ERC7984CreditToken("Nox Credit Token", "NOXCRED", "https://signet.finance/token");
        incomeStream = new IncomeStream();
        creditVault = new ConfidentialCredit(
            address(incomeStream),
            address(creditToken),
            6,
            address(mockAavePool),
            address(0)
        );

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

        euint256 initialTotal = incomeStream.getTotalEarnedHandle(borrower);
        assertEq(euint256.unwrap(initialTotal), bytes32(0));

        vm.warp(block.timestamp + 30 days);
        vm.startPrank(borrower);
        euint256 updatedTotal = incomeStream.claimEarnedSalary(streamId);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(updatedTotal));
        assertTrue(uint256(euint256.unwrap(updatedTotal)) > 0);
    }

    function test_DepositCollateral_RoutesToAavePool() public {
        uint256 depositAmount = 15000 * 1e6;
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        euint256 collateralHandle = creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(collateralHandle));
        assertEq(mockAavePool.supplied(address(mockUsdc), address(creditVault)), depositAmount);
        assertEq(creditVault.getUserCollateralAmount(borrower), depositAmount);
    }

    function test_RequestBorrow_TwoSeparateTransactions_Success() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        externalEuint256 extBor = externalEuint256.wrap(euint256.unwrap(mockBorrow));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        // Transaction 1: Evaluate eligibility
        ebool signal = creditVault.evaluateBorrowEligibility(address(mockUsdc), borrowAmount, extBor, proof);
        assertTrue(Nox.isInitialized(signal));
        assertTrue(creditVault.isBorrowEligibilityEvaluated(borrower));
        assertEq(creditVault.getEvaluatedBorrowAmount(borrower), borrowAmount);

        // Transaction 2: Execute borrow with TEE proof
        uint256 initialBalance = mockUsdc.balanceOf(borrower);
        euint256 borrowedHandle = creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);
        vm.stopPrank();

        assertTrue(Nox.isInitialized(borrowedHandle));
        assertEq(mockUsdc.balanceOf(borrower), initialBalance + borrowAmount);
        assertEq(mockAavePool.borrowed(address(mockUsdc), address(creditVault)), borrowAmount);
        assertEq(creditVault.getUserBorrowAmount(borrower), borrowAmount);
        assertFalse(creditVault.isBorrowEligibilityEvaluated(borrower)); // Consumed
    }

    function test_RequestBorrow_RevertsWhenAmountMismatchBetweenTx1AndTx2() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 evalAmount = 10000 * 1e6;
        uint256 requestedAmount = 50000 * 1e6; // Mismatched higher amount in Tx2
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        euint256 evalHandle = Nox.toEuint256(10000);
        externalEuint256 extEval = externalEuint256.wrap(euint256.unwrap(evalHandle));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        // Tx 1: Evaluate for $10,000
        creditVault.evaluateBorrowEligibility(address(mockUsdc), evalAmount, extEval, proof);

        // Tx 2: Try to borrow $50,000 -> Reverts due to amount mismatch!
        vm.expectRevert("ConfidentialCredit: requested amount does not match evaluated amount");
        creditVault.requestBorrow(address(mockUsdc), requestedAmount, proof);
        vm.stopPrank();
    }

    function test_RequestBorrow_RejectedWhenOverCeiling_NoRealFundsTransferred() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 excessiveBorrow = 50000 * 1e6; // $50,000 exceeds $30,000 ceiling
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        euint256 excessiveHandle = Nox.toEuint256(50000);
        externalEuint256 extBor = externalEuint256.wrap(euint256.unwrap(excessiveHandle));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        // Tx 1: Evaluate for excessive amount
        creditVault.evaluateBorrowEligibility(address(mockUsdc), excessiveBorrow, extBor, proof);

        uint256 initialBalance = mockUsdc.balanceOf(borrower);

        // Tx 2: Attempt borrow -> Reverts on TEE eligibility check!
        vm.expectRevert("ConfidentialCredit: requested borrow exceeds salary eligibility ceiling");
        creditVault.requestBorrow(address(mockUsdc), excessiveBorrow, proof);
        vm.stopPrank();

        assertEq(mockUsdc.balanceOf(borrower), initialBalance);
        assertEq(mockAavePool.borrowed(address(mockUsdc), address(creditVault)), 0);
        assertEq(creditVault.getUserBorrowAmount(borrower), 0);
    }

    function test_RequestBorrow_RevertWithoutPriorEvaluationTx1() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        // Attempt Tx 2 without Tx 1 -> Reverts!
        vm.expectRevert("ConfidentialCredit: eligibility not yet evaluated");
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);
        vm.stopPrank();
    }

    function test_RepayLoan_RoutesToAavePool() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        uint256 repayAmount = 5000 * 1e6;
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        externalEuint256 extBor = externalEuint256.wrap(euint256.unwrap(mockBorrow));
        euint256 repayHandle = Nox.toEuint256(5000);
        externalEuint256 extRep = externalEuint256.wrap(euint256.unwrap(repayHandle));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        creditVault.evaluateBorrowEligibility(address(mockUsdc), borrowAmount, extBor, proof);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);

        mockUsdc.approve(address(creditVault), repayAmount);
        creditVault.repay(address(mockUsdc), repayAmount, extRep, proof);
        vm.stopPrank();

        assertEq(mockAavePool.borrowed(address(mockUsdc), address(creditVault)), borrowAmount - repayAmount);
        assertEq(creditVault.getUserBorrowAmount(borrower), borrowAmount - repayAmount);
    }

    function test_LiquidationFlow_HealthyPositionNotLiquidatable() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        externalEuint256 extBor = externalEuint256.wrap(euint256.unwrap(mockBorrow));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        creditVault.evaluateBorrowEligibility(address(mockUsdc), borrowAmount, extBor, proof);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);
        vm.stopPrank();

        ebool signal = creditVault.checkAndLiquidate(borrower);
        assertEq(ebool.unwrap(signal), bytes32(0));
    }

    function test_Liquidation_RevertsWhenHealthy() public {
        uint256 depositAmount = 15000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(mockCollateral));
        externalEuint256 extBor = externalEuint256.wrap(euint256.unwrap(mockBorrow));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        creditVault.evaluateBorrowEligibility(address(mockUsdc), borrowAmount, extBor, proof);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);
        vm.stopPrank();

        creditVault.checkAndLiquidate(borrower);

        vm.prank(liquidator);
        vm.expectRevert("ConfidentialCredit: position is healthy and not liquidatable");
        creditVault.liquidate(borrower, proof);
    }

    function test_LiquidationFlow_UnwindsRealAavePositionWhenUnderwater() public {
        uint256 depositAmount = 5000 * 1e6;
        uint256 borrowAmount = 20000 * 1e6;
        euint256 lowCollateral = Nox.toEuint256(5000);
        externalEuint256 extCol = externalEuint256.wrap(euint256.unwrap(lowCollateral));
        externalEuint256 extBor = externalEuint256.wrap(euint256.unwrap(mockBorrow));

        vm.prank(employer);
        incomeStream.createStream(borrower, mockIncomeRate);

        vm.startPrank(borrower);
        mockUsdc.approve(address(creditVault), depositAmount);
        creditVault.depositCollateral(address(mockUsdc), depositAmount, extCol, proof);

        // Borrow Call 1 ($20,000)
        creditVault.evaluateBorrowEligibility(address(mockUsdc), borrowAmount, extBor, proof);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);

        // Borrow Call 2 ($20,000 -> Total $40,000 debt vs $35,000 capacity)
        creditVault.evaluateBorrowEligibility(address(mockUsdc), borrowAmount, extBor, proof);
        creditVault.requestBorrow(address(mockUsdc), borrowAmount, proof);
        vm.stopPrank();

        creditVault.checkAndLiquidate(borrower);

        uint256 initialAaveDebt = mockAavePool.borrowed(address(mockUsdc), address(creditVault));
        assertEq(initialAaveDebt, 40000 * 1e6);

        vm.prank(liquidator);
        creditVault.liquidate(borrower, proof);

        assertEq(mockAavePool.borrowed(address(mockUsdc), address(creditVault)), 35000 * 1e6);
        assertEq(creditVault.getUserBorrowAmount(borrower), 0);
        assertEq(creditVault.getUserCollateralAmount(borrower), 0);
        assertEq(euint256.unwrap(creditVault.getEncryptedCollateral(borrower)), bytes32(0));
        assertEq(euint256.unwrap(creditVault.getEncryptedBorrowBalance(borrower)), bytes32(0));
    }
}
