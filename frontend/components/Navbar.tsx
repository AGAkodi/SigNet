"use client";

import React from "react";

interface NavbarProps {
  isConnected: boolean;
  address: string;
  onConnect: () => void;
  activeScreen: number;
  setActiveScreen: (screen: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  address,
  onConnect,
  activeScreen,
  setActiveScreen,
}) => {
  return (
    <header className="w-full border-b border-[#2A2E3D] bg-[#12141A]/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Thesis */}
        <div
          onClick={() => setActiveScreen(1)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8933E] flex items-center justify-center font-serif font-bold text-[#12141A]">
            N
          </div>
          <div>
            <h1 className="font-serif font-semibold text-lg text-[#F7F5F0] tracking-wide">
              Nox Private Credit
            </h1>
            <span className="text-xs text-[#8E95A5] font-mono block">
              Arbitrum Sepolia • TEE Verified
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        {isConnected && (
          <nav className="hidden md:flex items-center gap-1 bg-[#1A1D26] p-1 rounded-lg border border-[#2A2E3D]">
            {[
              { id: 2, label: "1. Stream" },
              { id: 3, label: "2. Vault Ledger" },
              { id: 4, label: "3. Borrow" },
              { id: 5, label: "4. Manage" },
              { id: 6, label: "5. Audit View" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveScreen(tab.id)}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                  activeScreen === tab.id
                    ? "bg-[#B8933E] text-[#12141A] font-semibold"
                    : "text-[#8E95A5] hover:text-[#F7F5F0]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Wallet Connect & Network Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-[#2E5C57]/30 border border-[#2E5C57] rounded-full text-[11px] font-mono text-[#F7F5F0]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Arbitrum Sepolia
          </div>

          {isConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1D26] border border-[#B8933E]/40 rounded-lg text-xs font-mono text-[#F7F5F0]">
              <span className="text-[#B8933E]">●</span>
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] font-medium text-xs rounded-lg transition-colors shadow-lg shadow-[#B8933E]/10 focus:outline-none focus:ring-2 focus:ring-[#B8933E]"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
