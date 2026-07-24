"use client";

import React, { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Navbar } from "../components/Navbar";
import { Screen1Landing } from "../components/Screen1Landing";
import { Screen2StreamSetup } from "../components/Screen2StreamSetup";
import { Screen3CreditDashboard } from "../components/Screen3CreditDashboard";
import { Screen4RequestBorrow } from "../components/Screen4RequestBorrow";
import { Screen5LoanManagement } from "../components/Screen5LoanManagement";
import { Screen6SelectiveDisclosure } from "../components/Screen6SelectiveDisclosure";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [activeScreen, setActiveScreen] = useState(1);

  // Application Vault State - Starts null until populated by confirmed on-chain stream creation
  const [streamData, setStreamData] = useState<{
    employer: string;
    monthlyRate: number;
    handle: string;
  } | null>(null);

  const [collateral, setCollateral] = useState(15000);
  const [activeBorrow, setActiveBorrow] = useState(0);

  const handleConnect = () => {
    if (!isConnected) {
      const injectedConnector = connectors.find((c) => c.id === "injected") || connectors[0];
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      }
    }
    if (activeScreen === 1) {
      setActiveScreen(3); // Navigate to Vault Ledger once connected
    }
  };

  const handleStreamCreated = (data: { employer: string; monthlyRate: number; handle: string }) => {
    setStreamData(data);
    setActiveScreen(3);
  };

  const handleBorrowApproved = (amount: number) => {
    setActiveBorrow((prev) => prev + amount);
    setActiveScreen(5); // Navigate to loan management
  };

  const handleRepayExecuted = (repayAmount: number) => {
    setActiveBorrow((prev) => Math.max(0, prev - repayAmount));
  };

  const activeAddress = address || "";

  return (
    <div className="min-h-screen bg-mist-950 text-halo-soft flex flex-col font-sans selection:bg-patina-400 selection:text-mist-950">
      <Navbar
        isConnected={isConnected}
        address={activeAddress}
        onConnect={handleConnect}
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeScreen === 1 && (
          <Screen1Landing
            onConnect={handleConnect}
            onExplore={() => {
              if (!isConnected) {
                handleConnect();
              }
              setActiveScreen(2);
            }}
          />
        )}

        {activeScreen === 2 && (
          <Screen2StreamSetup
            userAddress={activeAddress}
            onStreamCreated={handleStreamCreated}
          />
        )}

        {activeScreen === 3 && (
          <Screen3CreditDashboard
            userAddress={activeAddress}
            streamData={streamData}
            activeBorrow={activeBorrow}
            collateral={collateral}
            onNavigateBorrow={() => setActiveScreen(4)}
            onNavigateStream={() => setActiveScreen(2)}
          />
        )}

        {activeScreen === 4 && (
          <Screen4RequestBorrow
            userAddress={activeAddress}
            monthlyIncome={streamData ? streamData.monthlyRate : 8000}
            onBorrowApproved={handleBorrowApproved}
          />
        )}

        {activeScreen === 5 && (
          <Screen5LoanManagement
            userAddress={activeAddress}
            activeBorrow={activeBorrow}
            onRepayExecuted={handleRepayExecuted}
          />
        )}

        {activeScreen === 6 && (
          <Screen6SelectiveDisclosure
            userAddress={activeAddress}
            streamHandle={streamData ? streamData.handle : "0x0000000000000000000000000000000000000000000000000000000000000000"}
          />
        )}
      </main>

      {/* Vault Footer */}
      <footer className="w-full border-t border-mist-700 py-6 px-6 text-center text-xs font-mono text-halo-deep">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Nox Private Credit — Salary-Backed Confidential Lending</span>
          <span>Arbitrum Sepolia (Chain ID 421614) • TEE Secured</span>
        </div>
      </footer>
    </div>
  );
}
