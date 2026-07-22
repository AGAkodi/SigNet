"use client";

import React, { useState } from "react";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk } from "../lib/noxSdk";

interface Screen5LoanManagementProps {
  userAddress: string;
  activeBorrow: number;
  onRepayExecuted: (amount: number) => void;
}

export const Screen5LoanManagement: React.FC<Screen5LoanManagementProps> = ({
  userAddress,
  activeBorrow,
  onRepayExecuted,
}) => {
  const [repayAmount, setRepayAmount] = useState(activeBorrow > 0 ? "5000" : "0");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiquidatable, setIsLiquidatable] = useState(false);

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(repayAmount);
    if (num <= 0 || num > activeBorrow) return;

    setIsProcessing(true);
    try {
      // Execute Nox SDK client-side repayment encryption
      await noxSdk.encryptInput(
        num,
        "0x94B8aE1355a165EcC34D8a19C9b4a457a4eF77e4",
        userAddress
      );
      onRepayExecuted(num);
    } catch (err) {
      console.error("Repayment Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMockRisk = () => {
    setIsLiquidatable((prev) => !prev);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Liquidation Risk Banner */}
      {isLiquidatable && (
        <div className="p-4 bg-[#B84A3E]/20 border border-[#B84A3E] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="font-serif font-semibold text-sm text-[#F7F5F0]">
                Liquidation Risk Signal Active
              </h4>
              <p className="text-xs text-[#8E95A5]">
                TEE coprocessor emitted discrete boolean signal: <code className="text-[#B84A3E] font-mono">liquidatable = true</code>. No position sizes exposed.
              </p>
            </div>
          </div>
          <button
            onClick={handleRepay}
            className="px-4 py-2 bg-[#B84A3E] hover:bg-red-700 text-white font-mono text-xs rounded-lg font-semibold"
          >
            Emergency Repay
          </button>
        </div>
      )}

      {/* Loan Management Ledger */}
      <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2E3D] pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-[#B8933E]">STEP 04 OF 04</span>
            <h2 className="font-serif text-2xl font-bold text-[#F7F5F0]">
              Loan Position Management
            </h2>
          </div>
          <button
            onClick={toggleMockRisk}
            className="px-2.5 py-1 bg-[#12141A] hover:bg-[#2A2E3D] border border-[#2A2E3D] text-[11px] font-mono text-[#8E95A5] rounded"
          >
            {isLiquidatable ? "Simulate Healthy Status" : "Simulate Liquidation Risk"}
          </button>
        </div>

        {/* Position Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-[#12141A] border border-[#2A2E3D] rounded-xl">
            <WaxSealValue
              label="Active Principal Balance"
              encryptedHandle="0x4f1a09...b87e"
              actualValue={`$${activeBorrow.toLocaleString()}.00 USD`}
              userAddress={userAddress}
            />
          </div>

          <div className="p-4 bg-[#12141A] border border-[#2A2E3D] rounded-xl flex flex-col justify-between">
            <span className="text-xs uppercase tracking-wider text-[#8E95A5] font-mono">
              Health Status Badge
            </span>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-mono rounded-full border ${
                  isLiquidatable
                    ? "bg-[#B84A3E]/30 border-[#B84A3E] text-[#B84A3E]"
                    : "bg-[#2E5C57]/30 border-[#2E5C57] text-[#F7F5F0]"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLiquidatable ? "bg-[#B84A3E] animate-pulse" : "bg-emerald-400"
                  }`}
                />
                {isLiquidatable ? "LIQUIDATION RISK" : "HEALTHY POSITION"}
              </span>
            </div>
            <span className="text-[11px] text-[#8E95A5] font-mono mt-2">
              Discrete boolean state only
            </span>
          </div>
        </div>

        {/* Repayment Form */}
        <form onSubmit={handleRepay} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[#8E95A5] mb-1.5 uppercase">
              Repayment Amount ($ USD)
            </label>
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              disabled={activeBorrow === 0}
              min="1"
              max={activeBorrow}
              className="w-full bg-[#12141A] border border-[#2A2E3D] focus:border-[#B8933E] text-[#F7F5F0] font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={activeBorrow === 0 || isProcessing}
            className={`w-full py-3 font-semibold text-sm rounded-lg transition-colors shadow-lg ${
              activeBorrow > 0 && !isProcessing
                ? "bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] shadow-[#B8933E]/10"
                : "bg-[#12141A] text-[#8E95A5] border border-[#2A2E3D] cursor-not-allowed"
            }`}
          >
            {isProcessing
              ? "Executing Encrypted Repayment..."
              : activeBorrow === 0
              ? "No Active Borrow Balance"
              : "Repay Loan Principal"}
          </button>
        </form>
      </div>
    </div>
  );
};
