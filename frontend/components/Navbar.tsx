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
  const showTabs = isConnected || activeScreen > 1;

  return (
    <header className="w-full border-b border-mist-700 bg-mist-950/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Thesis */}
        <div
          onClick={() => setActiveScreen(1)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-patina-300 to-patina-500 flex items-center justify-center font-display font-bold text-mist-950 shadow-hair">
            N
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg text-halo-soft tracking-wide group-hover:text-patina-300 transition-colors">
              Nox Private Credit
            </h1>
            <span className="text-xs text-halo-deep font-mono block">
              Arbitrum Sepolia • TEE Verified
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        {showTabs && (
          <nav className="hidden md:flex items-center gap-1 bg-mist-900 p-1 rounded-lg border border-mist-700">
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
                    ? "bg-patina-400 text-mist-950 font-semibold"
                    : "text-halo-dim hover:text-halo-soft"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Wallet Connect & Network Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-patina-500/10 border border-patina-400/30 rounded-full text-[11px] font-mono text-patina-300">
            <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
            Arbitrum Sepolia
          </div>

          {isConnected && address ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-mist-900 border border-mist-700 rounded-lg text-xs font-mono text-halo-soft">
              <span className="text-patina-400">●</span>
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-patina-400 hover:bg-patina-500 text-mist-950 font-semibold text-xs font-mono rounded-lg transition-colors shadow-panel focus:outline-none focus:ring-1 focus:ring-patina-300"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
