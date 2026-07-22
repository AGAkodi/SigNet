"use client";

import React from "react";

interface Screen1LandingProps {
  onConnect: () => void;
  onExplore: () => void;
}

export const Screen1Landing: React.FC<Screen1LandingProps> = ({
  onConnect,
  onExplore,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] max-w-4xl mx-auto px-6 text-center py-12">
      {/* Badge Header */}
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#2E5C57]/20 border border-[#2E5C57] rounded-full text-xs font-mono text-[#F7F5F0] mb-8">
        <span>🔒 Confidential Credit Vault</span>
        <span className="text-[#8E95A5]">•</span>
        <span>Arbitrum Sepolia</span>
      </div>

      {/* Thesis Headline */}
      <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#F7F5F0] max-w-3xl leading-tight mb-6">
        Borrow against your income. <br />
        <span className="italic text-[#B8933E]">No one sees the number.</span>
      </h1>

      {/* Narrative Subtitle */}
      <p className="text-base sm:text-lg text-[#8E95A5] max-w-2xl mb-10 leading-relaxed font-sans">
        Salary-backed institutional lending powered by Nox TEE confidential compute.
        Your payroll streaming data underwrites loan eligibility without ever exposing salary magnitude or debt size on-chain.
      </p>

      {/* Primary CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
        <button
          onClick={onConnect}
          className="w-full sm:w-auto px-8 py-3.5 bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] font-semibold text-sm rounded-lg transition-all shadow-xl shadow-[#B8933E]/15 focus:outline-none focus:ring-2 focus:ring-[#B8933E]"
        >
          Connect Wallet & Open Vault
        </button>
        <button
          onClick={onExplore}
          className="w-full sm:w-auto px-6 py-3.5 bg-[#1A1D26] hover:bg-[#2A2E3D] text-[#F7F5F0] border border-[#2A2E3D] font-mono text-xs rounded-lg transition-colors"
        >
          How It Works (3-Step Diagram)
        </button>
      </div>

      {/* 3-Step Visual Ledger */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left border-t border-[#2A2E3D] pt-12">
        <div className="p-5 rounded-xl bg-[#1A1D26] border border-[#2A2E3D]">
          <div className="text-xs font-mono text-[#B8933E] mb-2">01. STREAM</div>
          <h3 className="font-serif font-semibold text-lg text-[#F7F5F0] mb-2">
            Payroll Income Stream
          </h3>
          <p className="text-xs text-[#8E95A5] leading-relaxed">
            Continuous Sablier/Superfluid salary streams emit encrypted Nox handles representing real-time earned income.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#1A1D26] border border-[#2A2E3D]">
          <div className="text-xs font-mono text-[#2E5C57] mb-2">02. SEAL</div>
          <h3 className="font-serif font-semibold text-lg text-[#F7F5F0] mb-2">
            Client-Side Encrypted Handles
          </h3>
          <p className="text-xs text-[#8E95A5] leading-relaxed">
            Nox JS SDK encrypts figures client-side. Numbers render as sealed wax-stamp glyphs viewable only by you.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#1A1D26] border border-[#2A2E3D]">
          <div className="text-xs font-mono text-[#B8933E] mb-2">03. BORROW</div>
          <h3 className="font-serif font-semibold text-lg text-[#F7F5F0] mb-2">
            TEE Confidential Underwriting
          </h3>
          <p className="text-xs text-[#8E95A5] leading-relaxed">
            Arbitrum Sepolia TEE coprocessor verifies eligibility and health factors privately, returning discrete boolean signals.
          </p>
        </div>
      </div>
    </div>
  );
};
