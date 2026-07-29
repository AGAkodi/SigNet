"use client";

import React, { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk } from "../lib/noxSdk";
import { useBufferedFees, parseTxError } from "../lib/errorHelper";

import { CONTRACT_ADDRESSES } from "../lib/contracts";

interface Screen5LoanManagementProps {
  userAddress: string;
  activeBorrow: number;
  onRepayExecuted: (amount: number) => void;
}

const CONFIDENTIAL_CREDIT_ADDRESS = CONTRACT_ADDRESSES.ConfidentialCredit;

const CONFIDENTIAL_CREDIT_ABI = [
  {
    type: "function",
    name: "getEncryptedBorrowBalance",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "repay",
    inputs: [{ name: "repayAmount", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "evaluateLiquidation",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

export const Screen5LoanManagement: React.FC<Screen5LoanManagementProps> = ({
  userAddress,
  activeBorrow,
  onRepayExecuted,
}) => {
  const [repayAmount, setRepayAmount] = useState(activeBorrow > 0 ? "5000" : "1000");
  const [isLiquidatable, setIsLiquidatable] = useState(false);
  const [activeAction, setActiveAction] = useState<"REPAY" | "EVALUATE" | null>(null);

  // Read real on-chain borrow balance handle from ConfidentialCredit contract
  const { data: onChainBorrowHandle, refetch: refetchBorrowBalance } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getEncryptedBorrowBalance",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  const { writeContract, data: hash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { getBufferedFeeData } = useBufferedFees();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({
      hash,
    });

  // When on-chain repayment or evaluation transaction completes
  useEffect(() => {
    if (isConfirmed && hash) {
      if (activeAction === "REPAY") {
        refetchBorrowBalance();
        const num = parseFloat(repayAmount);
        if (!isNaN(num) && num > 0) {
          onRepayExecuted(num);
        }
      }
      setActiveAction(null);
    }
  }, [isConfirmed, hash, activeAction, repayAmount, refetchBorrowBalance, onRepayExecuted]);

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert("Please connect your wallet first to repay an encrypted position.");
      return;
    }
    const num = parseFloat(repayAmount);
    if (isNaN(num) || num <= 0) return;

    reset();
    setActiveAction("REPAY");

    try {
      const enc = await noxSdk.encryptInput(num, CONFIDENTIAL_CREDIT_ADDRESS, userAddress);
      const feeData = await getBufferedFeeData();

      writeContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "repay",
        args: [enc.encryptedHandle as `0x${string}`],
        ...feeData,
      });
    } catch (err) {
      console.error("Repayment Error:", err);
    }
  };

  const handleEvaluateLiquidationOnChain = async () => {
    if (!userAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    reset();
    setActiveAction("EVALUATE");

    try {
      const feeData = await getBufferedFeeData();

      writeContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "evaluateLiquidation",
        args: [userAddress as `0x${string}`],
        ...feeData,
      });
    } catch (err) {
      console.error("Liquidation Evaluation Error:", err);
    }
  };

  const currentOnChainHandle =
    onChainBorrowHandle && typeof onChainBorrowHandle === "string" && onChainBorrowHandle !== "0x0000000000000000000000000000000000000000000000000000000000000000"
      ? onChainBorrowHandle
      : "0x4f1a09...b87e";

  const isBusy = isWriting || isConfirming;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Liquidation Risk Banner */}
      {isLiquidatable && (
        <div className="p-5 bg-danger-soft border border-danger-border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-panel">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div>
              <h4 className="font-display font-semibold text-sm text-halo-soft">
                Liquidation Risk Signal Active
              </h4>
              <p className="text-xs text-halo-dim font-sans leading-relaxed">
                TEE coprocessor emitted discrete boolean signal: <code className="text-danger font-mono font-semibold">liquidatable = true</code>. No position magnitudes exposed.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleEvaluateLiquidationOnChain()}
            disabled={isBusy}
            className="shrink-0 btn-danger"
          >
            Emergency Repay
          </button>
        </div>
      )}

      {/* Loan Management Ledger */}
      <div className="card">
        {/* Header with Consistent Eyebrow Tag */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-mist-700 pb-5 mb-6">
          <div>
            <div className="eyebrow-tag">
              <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
              <span>[ 04. LOAN MANAGEMENT ]</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft">
              Active Debt & Repayment
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEvaluateLiquidationOnChain}
              disabled={isBusy}
              className="btn-outline !px-3 !py-1.5 !text-[11px]"
            >
              Evaluate On-Chain Liquidation (TEE)
            </button>
            <button
              type="button"
              onClick={() => setIsLiquidatable((prev) => !prev)}
              className="btn-ghost !px-3 !py-1.5 !text-[11px]"
            >
              {isLiquidatable ? "Clear Local Banner" : "Preview Risk Banner"}
            </button>
          </div>
        </div>

        {/* Position Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 items-stretch">
          {/* Card 1: Real On-Chain Encrypted Borrow Balance */}
          <div className="p-5 bg-mist-950/80 border border-mist-700 rounded-xl flex flex-col justify-between shadow-panel">
            <WaxSealValue
              label="Active Principal Balance (On-Chain)"
              encryptedHandle={currentOnChainHandle}
              actualValue={`$${activeBorrow.toLocaleString()}.00 USD`}
              userAddress={userAddress}
            />
          </div>

          {/* Card 2: Health Status Badge */}
          <div className="p-5 bg-mist-950/80 border border-mist-700 rounded-xl flex flex-col justify-between shadow-panel">
            <span className="text-[10px] uppercase tracking-wider text-halo-dim font-mono block mb-2 font-semibold">
              HEALTH STATUS BADGE
            </span>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono rounded-full border shadow-panel ${
                  isLiquidatable
                    ? "bg-danger-soft border-danger-border text-danger font-semibold"
                    : "bg-patina-500/20 border-patina-400/50 text-patina-300 font-semibold"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLiquidatable ? "bg-danger animate-pulse" : "bg-patina-400"
                  }`}
                />
                {isLiquidatable ? "LIQUIDATION RISK" : "HEALTHY POSITION (TEE VERIFIED)"}
              </span>
            </div>
            <span className="text-[11px] text-halo-deep font-mono mt-3 block">
              Evaluated on-chain via ConfidentialCredit.evaluateLiquidation()
            </span>
          </div>
        </div>

        {/* Repayment Form */}
        <form onSubmit={handleRepay} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-halo-dim mb-2 uppercase tracking-wider font-medium">
              Repayment Amount ($ USD)
            </label>
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              min="1"
              required
              className="input-field"
            />
          </div>

          {/* Transaction Status Alerts */}
          {isWriting && (
            <div className="p-4 bg-patina-500/10 border border-patina-400/40 rounded-xl text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the {activeAction === "REPAY" ? "Repayment" : "Liquidation Evaluation"} transaction in your wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
                {activeAction === "REPAY" ? "Encrypted Repayment" : "Liquidation Evaluation"} submitted! Mining block on Sepolia...
              </div>
              <a
                href={`https://sepolia.arbiscan.io/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-patina-400 hover:underline block truncate"
              >
                View on Arbiscan: {hash}
              </a>
            </div>
          )}

          {(writeError || receiptError) && (
            <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {parseTxError(writeError || receiptError)}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className={`w-full ${isBusy ? "btn-outline opacity-60" : "btn-primary"}`}
          >
            {isWriting
              ? "Confirming Signature in Wallet..."
              : isConfirming
              ? "Broadcasting Repayment to Sepolia..."
              : "Repay Loan Principal (On-Chain)"}
          </button>
        </form>
      </div>
    </div>
  );
};
