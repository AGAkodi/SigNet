"use client";

import React from "react";
import { WaxSealValue } from "./WaxSealValue";

interface Screen3CreditDashboardProps {
  userAddress: string;
  streamData: { employer: string; monthlyRate: number; handle: string } | null;
  activeBorrow: number;
  collateral: number;
  onNavigateBorrow: () => void;
  onNavigateStream: () => void;
}

export const Screen3CreditDashboard: React.FC<Screen3CreditDashboardProps> = ({
  userAddress,
  streamData,
  activeBorrow,
  collateral,
  onNavigateBorrow,
  onNavigateStream,
}) => {
  if (!streamData) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-2xl p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#2E5C57]/30 border border-[#2E5C57] text-[#B8933E] flex items-center justify-center mx-auto mb-4 font-serif text-xl">
            🏛️
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#F7F5F0] mb-3">
            Vault Ledger Empty
          </h2>
          <p className="text-xs text-[#8E95A5] mb-6 max-w-md mx-auto">
            No active salary stream registered. Set up an encrypted income stream to calculate your confidential borrow capacity.
          </p>
          <button
            onClick={onNavigateStream}
            className="px-6 py-2.5 bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] font-semibold text-xs rounded-lg transition-colors"
          >
            + Register Salary Stream
          </button>
        </div>
      </div>
    );
  }

  const maxBorrowCapacity = streamData.monthlyRate * 6;
  const availableBorrow = Math.max(0, maxBorrowCapacity - activeBorrow);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header Ledger Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#2A2E3D] pb-6">
        <div>
          <span className="text-xs font-mono text-[#B8933E]">VAULT LEDGER</span>
          <h2 className="font-serif text-3xl font-bold text-[#F7F5F0]">
            Credit Dashboard
          </h2>
        </div>
        <button
          onClick={onNavigateBorrow}
          className="mt-4 sm:mt-0 px-5 py-2.5 bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-[#B8933E]/10"
        >
          + Request Borrow
        </button>
      </div>

      {/* 3 Sealed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Available to Borrow */}
        <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <WaxSealValue
              label="Available to Borrow"
              encryptedHandle={streamData.handle}
              actualValue={`$${availableBorrow.toLocaleString()}.00 USD`}
              userAddress={userAddress}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-[#2A2E3D] text-[11px] font-mono text-[#8E95A5]">
            Limit: 6x Monthly Salary
          </div>
        </div>

        {/* Card 2: Current Health Factor */}
        <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[#8E95A5] font-mono">
              Current Health Factor
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-3 py-1 bg-[#2E5C57] text-[#F7F5F0] text-xs font-mono rounded-full border border-[#B8933E]">
                ● HEALTHY (TEE VERIFIED)
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2A2E3D] text-[11px] font-mono text-[#8E95A5]">
            Magnitude hidden from public view
          </div>
        </div>

        {/* Card 3: Active Loan Principal */}
        <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <WaxSealValue
              label="Active Loan Balance"
              encryptedHandle="0x4f1a09...b87e"
              actualValue={`$${activeBorrow.toLocaleString()}.00 USD`}
              userAddress={userAddress}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-[#2A2E3D] text-[11px] font-mono text-[#8E95A5]">
            Collateral Deposited: ${collateral.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Stream Overview Table */}
      <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-xl p-6">
        <h3 className="font-serif text-lg font-semibold text-[#F7F5F0] mb-4">
          Underwriting Income Stream Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#12141A] rounded border border-[#2A2E3D]">
            <span className="text-[#8E95A5] block mb-1">EMPLOYER ADDRESS</span>
            <span className="text-[#F7F5F0]">{streamData.employer}</span>
          </div>
          <div className="p-3 bg-[#12141A] rounded border border-[#2A2E3D]">
            <span className="text-[#8E95A5] block mb-1">ENCRYPTED HANDLE</span>
            <span className="text-[#B8933E]">{streamData.handle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
