"use client";

import React from "react";
import { SealedStatCard } from "./SealedStatCard";

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
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-mist-900 border border-mist-700 rounded-2xl p-8 shadow-panel">
          <div className="w-12 h-12 rounded-full bg-mist-800 border border-mist-700 text-patina-300 flex items-center justify-center mx-auto mb-4 font-display text-xl">
            🏛️
          </div>
          <h2 className="font-display text-2xl font-bold text-halo-soft mb-3">
            Vault Ledger Empty
          </h2>
          <p className="text-xs text-halo-dim mb-6 max-w-md mx-auto font-sans">
            No active salary stream registered. Set up an encrypted income stream to calculate your confidential borrow capacity.
          </p>
          <button
            onClick={onNavigateStream}
            className="px-6 py-2.5 bg-patina-400 hover:bg-patina-500 text-mist-950 font-semibold font-mono text-xs rounded-lg transition-colors shadow-panel"
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
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      {/* Header Ledger Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-mist-700 pb-6">
        <div>
          <span className="text-xs font-mono text-patina-400 uppercase tracking-wider block">
            VAULT LEDGER
          </span>
          <h2 className="font-display text-3xl font-bold text-halo-soft mt-1">
            Credit Dashboard
          </h2>
        </div>
        <button
          onClick={onNavigateBorrow}
          className="mt-4 sm:mt-0 px-5 py-2.5 bg-patina-400 hover:bg-patina-500 text-mist-950 font-semibold text-xs font-mono rounded-lg transition-colors shadow-panel"
        >
          + Request Borrow
        </button>
      </div>

      {/* 3 Sealed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Available to Borrow */}
        <SealedStatCard
          label="Available to Borrow"
          encryptedHandle={streamData.handle}
          actualValue={`$${availableBorrow.toLocaleString()}.00 USD`}
          userAddress={userAddress}
          footnote="Limit: 6x Monthly Salary"
        />

        {/* Card 2: Current Health Factor */}
        <SealedStatCard
          label="Current Health Factor"
          encryptedHandle="0x7e81b2...c901"
          actualValue="1.85 (HEALTHY)"
          userAddress={userAddress}
          footnote="Magnitude hidden from public view"
          statusBadge={{
            text: "HEALTHY (TEE VERIFIED)",
            isHealthy: true,
          }}
        />

        {/* Card 3: Active Loan Principal */}
        <SealedStatCard
          label="Active Loan Balance"
          encryptedHandle="0x4f1a09...b87e"
          actualValue={`$${activeBorrow.toLocaleString()}.00 USD`}
          userAddress={userAddress}
          footnote={`Collateral Deposited: $${collateral.toLocaleString()}`}
        />
      </div>

      {/* Underwriting Stream Details Panel */}
      <div className="bg-mist-900 border border-mist-700 rounded-xl p-6 shadow-panel">
        <h3 className="font-display text-lg font-semibold text-halo-soft mb-4">
          Underwriting Income Stream Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-mist-950 rounded-lg border border-mist-700">
            <span className="text-halo-deep block mb-1">EMPLOYER ADDRESS</span>
            <span className="text-halo-soft truncate block">{streamData.employer}</span>
          </div>
          <div className="p-3.5 bg-mist-950 rounded-lg border border-mist-700">
            <span className="text-halo-deep block mb-1">ENCRYPTED HANDLE</span>
            <span className="text-patina-300 truncate block">{streamData.handle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
