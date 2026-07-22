"use client";

import React, { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Screen1Landing } from "../components/Screen1Landing";
import { Screen2StreamSetup } from "../components/Screen2StreamSetup";
import { Screen3CreditDashboard } from "../components/Screen3CreditDashboard";
import { Screen4RequestBorrow } from "../components/Screen4RequestBorrow";
import { Screen5LoanManagement } from "../components/Screen5LoanManagement";
import { Screen6SelectiveDisclosure } from "../components/Screen6SelectiveDisclosure";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState("0x30a23FE8957cD4f1C1a5f6D8A6F011030eB4420A");
  const [activeScreen, setActiveScreen] = useState(1);

  // Application Vault State
  const [streamData, setStreamData] = useState<{
    employer: string;
    monthlyRate: number;
    handle: string;
  } | null>({
    employer: "0x4A817942C5c106A9a3a93F877b0C019c92238472",
    monthlyRate: 8000,
    handle: "0x9c82f00...a4e1",
  });
  const [collateral, setCollateral] = useState(15000);
  const [activeBorrow, setActiveBorrow] = useState(25000);

  const handleConnect = () => {
    setIsConnected(true);
    if (activeScreen === 1) {
      setActiveScreen(3); // Navigate straight to Vault Ledger once connected
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

  return (
    <div className="min-h-screen bg-[#12141A] text-[#F7F5F0] flex flex-col font-sans">
      <Navbar
        isConnected={isConnected}
        address={address}
        onConnect={handleConnect}
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeScreen === 1 && (
          <Screen1Landing
            onConnect={handleConnect}
            onExplore={() => {
              setIsConnected(true);
              setActiveScreen(2);
            }}
          />
        )}

        {activeScreen === 2 && (
          <Screen2StreamSetup
            userAddress={address}
            onStreamCreated={handleStreamCreated}
          />
        )}

        {activeScreen === 3 && (
          <Screen3CreditDashboard
            userAddress={address}
            streamData={streamData}
            activeBorrow={activeBorrow}
            collateral={collateral}
            onNavigateBorrow={() => setActiveScreen(4)}
            onNavigateStream={() => setActiveScreen(2)}
          />
        )}

        {activeScreen === 4 && (
          <Screen4RequestBorrow
            userAddress={address}
            monthlyIncome={streamData ? streamData.monthlyRate : 8000}
            onBorrowApproved={handleBorrowApproved}
          />
        )}

        {activeScreen === 5 && (
          <Screen5LoanManagement
            userAddress={address}
            activeBorrow={activeBorrow}
            onRepayExecuted={handleRepayExecuted}
          />
        )}

        {activeScreen === 6 && (
          <Screen6SelectiveDisclosure
            userAddress={address}
            streamHandle={streamData ? streamData.handle : "0x9c82f00...a4e1"}
          />
        )}
      </main>

      {/* Vault Footer */}
      <footer className="w-full border-t border-[#2A2E3D] py-6 px-6 text-center text-xs font-mono text-[#8E95A5]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Nox Private Credit — Salary-Backed Confidential Lending</span>
          <span>Deployed on Arbitrum Sepolia (Chain ID 421614)</span>
        </div>
      </footer>
    </div>
  );
}
