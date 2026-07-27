"use client";

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

interface NavbarProps {
  activeScreen: number;
  setActiveScreen: (screen: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeScreen,
  setActiveScreen,
}) => {
  const { isConnected } = useAccount();
  const showTabs = isConnected;

  return (
    <header className="w-full border-b border-mist-700 bg-mist-950/90 backdrop-blur sticky top-0 z-50 px-4 sm:px-6 py-3.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Thesis */}
        <div
          onClick={() => setActiveScreen(1)}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-patina-300 to-patina-500 flex items-center justify-center font-display font-bold text-mist-950 shadow-hair">
            S
          </div>
          <div>
            <h1 className="font-display font-semibold text-base sm:text-lg text-halo-soft tracking-wide group-hover:text-patina-300 transition-colors">
              SIGNET
            </h1>
            <span className="text-[11px] text-halo-deep font-mono hidden sm:block">
              Arbitrum Sepolia • TEE Verified
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Only rendered when wallet is genuinely connected) */}
        {showTabs && (
          <nav className="hidden md:flex items-center gap-1 bg-mist-900 p-1 rounded-lg border border-mist-700 overflow-x-auto">
            {[
              { id: 2, label: "1. Stream" },
              { id: 3, label: "2. Vault Ledger" },
              { id: 4, label: "3. Borrow" },
              { id: 5, label: "4. Manage" },
              { id: 6, label: "5. Audit View" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (isConnected) {
                    setActiveScreen(tab.id);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                  activeScreen === tab.id
                    ? "bg-patina-400 text-mist-950 font-semibold"
                    : "text-halo-dim hover:text-halo-soft"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* RainbowKit ConnectButton Component */}
        <div className="flex items-center gap-2 shrink-0">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus={{
              smallScreen: "avatar",
              largeScreen: "full",
            }}
          />
        </div>
      </div>
    </header>
  );
};
