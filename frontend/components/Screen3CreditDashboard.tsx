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
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="card text-center space-y-6">
          <div className="eyebrow-tag mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
            <span>[ 02. VAULT LEDGER ]</span>
          </div>

          {/* Empty-state House Line-Art SVG Diagram */}
          <div className="w-full h-40 bg-mist-950/80 rounded-xl border border-mist-700/80 flex items-center justify-center p-4 shadow-inner">
            <svg viewBox="0 0 320 120" className="w-full h-full max-w-[280px]" fill="none">
              <rect x="20" y="20" width="280" height="80" rx="8" stroke="#3B382D" strokeWidth="1.5" fill="#16150F" strokeDasharray="6 6" />
              <path d="M 60 60 H 260" stroke="#565243" strokeWidth="1" />
              <circle cx="60" cy="60" r="8" fill="#1C1A14" stroke="#BFA24C" strokeWidth="2" />
              <circle cx="160" cy="60" r="8" fill="#1C1A14" stroke="#565243" strokeWidth="1.5" />
              <circle cx="260" cy="60" r="8" fill="#1C1A14" stroke="#565243" strokeWidth="1.5" />
              <text x="160" y="92" textAnchor="middle" className="font-mono text-[10px] fill-halo-deep tracking-wider">
                WAITING FOR ON-CHAIN INCOME STREAM
              </text>
            </svg>
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold text-halo-soft mb-2">
              Vault Ledger Empty
            </h2>
            <p className="text-xs sm:text-sm text-halo-dim max-w-md mx-auto font-sans leading-relaxed">
              No active salary stream registered on-chain yet. Register an encrypted income stream to calculate your confidential borrowing capacity.
            </p>
          </div>

          <button
            onClick={onNavigateStream}
            className="btn-primary w-full sm:w-auto"
          >
            + Register Salary Stream (Step 01)
          </button>
        </div>
      </div>
    );
  }

  const maxBorrowCapacity = streamData.monthlyRate * 6;
  const availableBorrow = Math.max(0, maxBorrowCapacity - activeBorrow);

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2">
      {/* Header Ledger Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-mist-700 pb-6">
        <div>
          <div className="eyebrow-tag">
            <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
            <span>[ 02. VAULT LEDGER ]</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft">
            Confidential Credit Ledger
          </h2>
        </div>
        <button
          onClick={onNavigateBorrow}
          className="mt-4 sm:mt-0 btn-primary"
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
      <div className="card space-y-4">
        <h3 className="font-display text-xl font-bold text-halo-soft">
          Underwriting Income Stream Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 bg-mist-950/80 rounded-xl border border-mist-700/80 shadow-panel space-y-1">
            <span className="text-halo-deep block text-[10px] tracking-wider uppercase font-semibold">EMPLOYER ADDRESS</span>
            <span className="text-halo-soft truncate block font-medium">{streamData.employer}</span>
          </div>
          <div className="p-4 bg-mist-950/80 rounded-xl border border-mist-700/80 shadow-panel space-y-1">
            <span className="text-halo-deep block text-[10px] tracking-wider uppercase font-semibold">ENCRYPTED CIPHER HANDLE</span>
            <span className="text-patina-300 truncate block font-semibold">{streamData.handle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
