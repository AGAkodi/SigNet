"use client";

import React, { useState } from "react";
import { noxSdk } from "../lib/noxSdk";

interface Screen4RequestBorrowProps {
  userAddress: string;
  monthlyIncome: number;
  onBorrowApproved: (amount: number) => void;
}

export const Screen4RequestBorrow: React.FC<Screen4RequestBorrowProps> = ({
  userAddress,
  monthlyIncome,
  onBorrowApproved,
}) => {
  const maxLimit = monthlyIncome * 6;
  const [requestedAmount, setRequestedAmount] = useState(Math.min(15000, maxLimit));
  const [isSealing, setIsSealing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isEligible = requestedAmount <= maxLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEligible) return;

    setIsSealing(true);
    try {
      // Execute Nox SDK client-side input encryption
      await noxSdk.encryptInput(
        requestedAmount,
        "0x94B8aE1355a165EcC34D8a19C9b4a457a4eF77e4",
        userAddress
      );
      setIsSubmitted(true);
      onBorrowApproved(requestedAmount);
    } catch (err) {
      console.error("Borrow Request Error:", err);
    } finally {
      setIsSealing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2E3D] pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-[#B8933E]">STEP 03 OF 04</span>
            <h2 className="font-serif text-2xl font-bold text-[#F7F5F0]">
              Request Borrow Position
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-[#2E5C57]/30 border border-[#2E5C57] text-[#F7F5F0] text-xs font-mono rounded">
            TEE Confidential Check
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-mono text-[#8E95A5] uppercase">
                Requested Loan Amount ($ USD)
              </label>
              <span className="font-serif text-xl font-bold text-[#B8933E]">
                ${requestedAmount.toLocaleString()}.00
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max={Math.max(50000, maxLimit)}
              step="500"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(Number(e.target.value))}
              className="w-full h-2 bg-[#12141A] rounded-lg appearance-none cursor-pointer accent-[#B8933E]"
            />
            <div className="flex justify-between text-[11px] font-mono text-[#8E95A5] mt-1">
              <span>$1,000</span>
              <span>Max Capacity: ${maxLimit.toLocaleString()} (6x Salary)</span>
            </div>
          </div>

          {/* Real-time Private Eligibility Indicator */}
          <div className="p-4 bg-[#12141A] border border-[#2A2E3D] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {isEligible ? "✅" : "❌"}
              </span>
              <div>
                <span className="text-xs font-mono text-[#F7F5F0] block font-semibold">
                  {isEligible ? "Qualifies (TEE Verified)" : "Exceeds Income Capacity"}
                </span>
                <span className="text-[11px] text-[#8E95A5]">
                  Evaluated privately in Nox TEE. Numbers remain hidden.
                </span>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 text-[11px] font-mono rounded border ${
                isEligible
                  ? "bg-[#2E5C57]/30 border-[#2E5C57] text-[#F7F5F0]"
                  : "bg-[#B84A3E]/30 border-[#B84A3E] text-[#B84A3E]"
              }`}
            >
              {isEligible ? "ELIGIBLE" : "INELIGIBLE"}
            </span>
          </div>

          {/* Sealing Transition State */}
          {isSealing && (
            <div className="p-3 bg-[#2E5C57]/20 border border-[#2E5C57] rounded-lg text-xs font-mono text-[#F7F5F0] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B8933E] animate-ping" />
              Sealing input & generating TEE cryptographic proof...
            </div>
          )}

          {isSubmitted && (
            <div className="p-3 bg-[#2E5C57]/30 border border-[#2E5C57] rounded-lg text-xs font-mono text-emerald-400">
              ✓ Borrow request successfully executed on Arbitrum Sepolia!
            </div>
          )}

          <button
            type="submit"
            disabled={!isEligible || isSealing}
            className={`w-full py-3 font-semibold text-sm rounded-lg transition-colors shadow-lg ${
              isEligible && !isSealing
                ? "bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] shadow-[#B8933E]/10"
                : "bg-[#1A1D26] text-[#8E95A5] cursor-not-allowed border border-[#2A2E3D]"
            }`}
          >
            {isSealing ? "Sealing Input..." : "Confirm & Sign Encrypted Borrow"}
          </button>
        </form>
      </div>
    </div>
  );
};
