"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Navbar } from "../components/Navbar";
import { Screen1Landing } from "../components/Screen1Landing";
import { Screen2StreamSetup } from "../components/Screen2StreamSetup";
import { Screen3CreditDashboard } from "../components/Screen3CreditDashboard";
import { Screen4RequestBorrow } from "../components/Screen4RequestBorrow";
import { Screen5LoanManagement } from "../components/Screen5LoanManagement";
import { Screen6SelectiveDisclosure } from "../components/Screen6SelectiveDisclosure";

export default function Home() {
  const { address, isConnected, status } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [activeScreen, setActiveScreen] = useState(1);

  // Application Vault State - Starts null until populated by confirmed on-chain stream creation
  const [streamData, setStreamData] = useState<{
    employer: string;
    monthlyRate: number;
    handle: string;
  } | null>(null);

  const [collateral] = useState(15000);
  const [activeBorrow, setActiveBorrow] = useState(0);

  const prevConnectedRef = useRef(isConnected);

  // 1. Trigger navigation ONLY when wallet connection transition false -> true succeeds
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      if (activeScreen === 1) {
        setActiveScreen(streamData ? 3 : 2);
      }
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, activeScreen, streamData]);

  // 2. Strict Access Control Guard: Disconnected users cannot access Screens 2-6
  useEffect(() => {
    if (!isConnected && status !== "reconnecting" && status !== "connecting") {
      if (activeScreen > 1) {
        setActiveScreen(1);
      }
    }
  }, [isConnected, status, activeScreen]);

  const handleConnect = () => {
    if (isConnected) {
      setActiveScreen(streamData ? 3 : 2);
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  const handleStreamCreated = (data: { employer: string; monthlyRate: number; handle: string }) => {
    setStreamData(data);
    setActiveScreen(3);
  };

  const handleBorrowApproved = (amount: number) => {
    setActiveBorrow((prev) => prev + amount);
    setActiveScreen(5);
  };

  const handleRepayExecuted = (repayAmount: number) => {
    setActiveBorrow((prev) => Math.max(0, prev - repayAmount));
  };

  const activeAddress = address || "";

  // Render loading state during initial browser rehydration if user refreshes on an app screen
  const isReconnectingSession = (status === "reconnecting" || status === "connecting") && activeScreen > 1;

  return (
    <div className="min-h-screen bg-mist-950 text-halo-soft flex flex-col font-sans selection:bg-patina-400 selection:text-mist-950">
      <Navbar
        activeScreen={activeScreen}
        setActiveScreen={(screen) => {
          // Block manual navigation via Navbar if wallet is not connected
          if (isConnected || screen === 1) {
            setActiveScreen(screen);
          } else if (openConnectModal) {
            openConnectModal();
          }
        }}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {isReconnectingSession ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-patina-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-patina-300">
              Reconnecting encrypted wallet session...
            </p>
          </div>
        ) : (
          <>
            {activeScreen === 1 && (
              <Screen1Landing
                onConnect={handleConnect}
                onExplore={() => {
                  if (isConnected) {
                    setActiveScreen(streamData ? 3 : 2);
                  } else if (openConnectModal) {
                    openConnectModal();
                  }
                }}
              />
            )}

            {activeScreen === 2 && isConnected && (
              <Screen2StreamSetup
                userAddress={activeAddress}
                onStreamCreated={handleStreamCreated}
              />
            )}

            {activeScreen === 3 && isConnected && (
              <Screen3CreditDashboard
                userAddress={activeAddress}
                streamData={streamData}
                activeBorrow={activeBorrow}
                collateral={collateral}
                onNavigateBorrow={() => setActiveScreen(4)}
                onNavigateStream={() => setActiveScreen(2)}
              />
            )}

            {activeScreen === 4 && isConnected && (
              <Screen4RequestBorrow
                userAddress={activeAddress}
                monthlyIncome={streamData ? streamData.monthlyRate : 8000}
                onBorrowApproved={handleBorrowApproved}
              />
            )}

            {activeScreen === 5 && isConnected && (
              <Screen5LoanManagement
                userAddress={activeAddress}
                activeBorrow={activeBorrow}
                onRepayExecuted={handleRepayExecuted}
              />
            )}

            {activeScreen === 6 && isConnected && (
              <Screen6SelectiveDisclosure
                userAddress={activeAddress}
                streamHandle={streamData ? streamData.handle : "0x0000000000000000000000000000000000000000000000000000000000000000"}
              />
            )}
          </>
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
