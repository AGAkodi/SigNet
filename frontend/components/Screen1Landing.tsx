"use client";

import React from "react";
import { ScrambleCycle } from "./ScrambleCycle";

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
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-mist-900 border border-mist-700 rounded-full text-xs font-mono text-halo-DEFAULT mb-8 shadow-panel">
        <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
        <span>Confidential Credit Vault</span>
        <span className="text-mist-500">•</span>
        <span className="text-patina-300">Arbitrum Sepolia TEE</span>
      </div>

      {/* Thesis Headline with ScrambleCycle */}
      <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-halo-soft max-w-3xl leading-tight mb-6">
        Borrow against your income. <br />
        <ScrambleCycle
          words={[
            "No one sees the number.",
            "Fully Encrypted.",
            "TEE Verified.",
            "Zero On-Chain Leakage.",
          ]}
          className="italic text-patina-300"
        />
      </h1>

      {/* Narrative Subtitle */}
      <p className="text-base sm:text-lg text-halo-dim max-w-2xl mb-10 leading-relaxed font-sans">
        Salary-backed institutional lending powered by Nox TEE confidential compute.
        Your payroll streaming data underwrites loan eligibility without ever exposing salary magnitude or debt size on-chain.
      </p>

      {/* Primary CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
        <button
          onClick={onConnect}
          className="w-full sm:w-auto px-8 py-3.5 bg-patina-400 hover:bg-patina-500 text-mist-950 font-semibold text-xs font-mono rounded-lg transition-all shadow-panel focus:outline-none focus:ring-1 focus:ring-patina-300"
        >
          Connect Wallet & Open Vault
        </button>
        <button
          onClick={onExplore}
          className="w-full sm:w-auto px-6 py-3.5 bg-mist-900 hover:bg-mist-850 text-halo-soft border border-mist-700 font-mono text-xs rounded-lg transition-colors"
        >
          How It Works (3-Step Diagram)
        </button>
      </div>

      {/* 3-Step Visual Ledger */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left border-t border-mist-700 pt-12">
        <div className="p-5 rounded-xl bg-mist-900 border border-mist-700 shadow-panel">
          <div className="text-xs font-mono text-patina-300 mb-2">01. STREAM</div>
          <h3 className="font-display font-semibold text-lg text-halo-soft mb-2">
            Payroll Income Stream
          </h3>
          <p className="text-xs text-halo-dim leading-relaxed font-sans">
            Continuous Sablier/Superfluid salary streams emit encrypted Nox handles representing real-time earned income.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-mist-900 border border-mist-700 shadow-panel">
          <div className="text-xs font-mono text-patina-400 mb-2">02. SEAL</div>
          <h3 className="font-display font-semibold text-lg text-halo-soft mb-2">
            Client-Side Living Cipher
          </h3>
          <p className="text-xs text-halo-dim leading-relaxed font-sans">
            Nox JS SDK encrypts figures client-side. Numbers render as living scrambled cipher glyphs viewable only by you.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-mist-900 border border-mist-700 shadow-panel">
          <div className="text-xs font-mono text-patina-300 mb-2">03. BORROW</div>
          <h3 className="font-display font-semibold text-lg text-halo-soft mb-2">
            TEE Confidential Underwriting
          </h3>
          <p className="text-xs text-halo-dim leading-relaxed font-sans">
            Arbitrum Sepolia TEE coprocessor verifies eligibility and health factors privately, returning discrete boolean signals.
          </p>
        </div>
      </div>
    </div>
  );
};
