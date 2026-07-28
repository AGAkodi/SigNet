"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk, EncryptedInputResult } from "../lib/noxSdk";

import { CONTRACT_ADDRESSES } from "../lib/contracts";

interface Screen4RequestBorrowProps {
  userAddress: string;
  monthlyIncome: number;
  onBorrowApproved: (amount: number) => void;
}

const CONFIDENTIAL_CREDIT_ADDRESS = CONTRACT_ADDRESSES.ConfidentialCredit;
const USDC_ARBITRUM_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

const CONFIDENTIAL_CREDIT_ABI = [
  {
    type: "function",
    name: "evaluateBorrowEligibility",
    inputs: [
      { name: "borrowAsset", type: "address" },
      { name: "requestedAmount", type: "uint256" },
      { name: "externalRequestedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestBorrow",
    inputs: [
      { name: "borrowAsset", type: "address" },
      { name: "requestedAmount", type: "uint256" },
      { name: "eligibilityProof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

export const Screen4RequestBorrow: React.FC<Screen4RequestBorrowProps> = ({
  userAddress,
  monthlyIncome,
  onBorrowApproved,
}) => {
  const maxLimit = monthlyIncome > 0 ? monthlyIncome * 6 : 48000;
  const [requestedAmount, setRequestedAmount] = useState(Math.min(15000, maxLimit));
  const [encResult, setEncResult] = useState<EncryptedInputResult | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const { writeContract: writeEval, data: hashEval, isPending: isWritingEval, error: writeErrorEval } = useWriteContract();
  const { isLoading: isConfirmingEval, isSuccess: isConfirmedEval } = useWaitForTransactionReceipt({ hash: hashEval });

  const { writeContract: writeBorrow, data: hashBorrow, isPending: isWritingBorrow, error: writeErrorBorrow } = useWriteContract();
  const { isLoading: isConfirmingBorrow, isSuccess: isConfirmedBorrow } = useWaitForTransactionReceipt({ hash: hashBorrow });

  // Re-encrypt handle whenever slider amount updates
  useEffect(() => {
    let isMounted = true;
    const updateEncryption = async () => {
      if (!requestedAmount || requestedAmount <= 0) return;
      try {
        const res = await noxSdk.encryptInput(
          requestedAmount,
          CONFIDENTIAL_CREDIT_ADDRESS,
          userAddress || "0x0000000000000000000000000000000000000000"
        );
        if (isMounted) {
          setEncResult(res);
        }
      } catch (err) {
        console.error("Encryption error:", err);
      }
    };
    updateEncryption();
    return () => {
      isMounted = false;
    };
  }, [requestedAmount, userAddress]);

  // Transition from Step 1 to Step 2 when Tx 1 is confirmed
  useEffect(() => {
    if (isConfirmedEval && hashEval) {
      setStep(2);
    }
  }, [isConfirmedEval, hashEval]);

  // Navigate to Screen 5 after Tx 2 confirmation
  useEffect(() => {
    if (isConfirmedBorrow && hashBorrow) {
      onBorrowApproved(requestedAmount);
    }
  }, [isConfirmedBorrow, hashBorrow, requestedAmount, onBorrowApproved]);

  const handleStep1Evaluate = async () => {
    if (!userAddress) {
      alert("Please connect your wallet first to submit a confidential borrow request.");
      return;
    }
    try {
      const res = await noxSdk.encryptInput(requestedAmount, CONFIDENTIAL_CREDIT_ADDRESS, userAddress);
      setEncResult(res);

      writeEval({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "evaluateBorrowEligibility",
        args: [
          USDC_ARBITRUM_SEPOLIA,
          BigInt(requestedAmount),
          res.encryptedHandle as `0x${string}`,
          "0x01" as `0x${string}`,
        ],
      });
    } catch (err) {
      console.error("Evaluation Error:", err);
    }
  };

  const handleStep2ExecuteBorrow = async () => {
    try {
      writeBorrow({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "requestBorrow",
        args: [
          USDC_ARBITRUM_SEPOLIA,
          BigInt(requestedAmount),
          "0x01" as `0x${string}`,
        ],
      });
    } catch (err) {
      console.error("Borrow Execution Error:", err);
    }
  };

  const isBusy = isWritingEval || isConfirmingEval || isWritingBorrow || isConfirmingBorrow;
  const currentHandle = encResult?.encryptedHandle || "0x0000000000000000000000000000000000000000000000000000000000000000";

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="card">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-mist-700 pb-5 mb-6">
          <div>
            <div className="eyebrow-tag">
              <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
              <span>[ 03. CONFIDENTIAL BORROW (2-STEP NOX FLOW) ]</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft">
              Confidential Borrow Request
            </h2>
          </div>
          <span className="px-3 py-1 bg-mist-800 border border-mist-700 text-patina-300 text-xs font-mono rounded-lg shadow-panel shrink-0 mt-1">
            ConfidentialCredit.sol
          </span>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`p-3 rounded-xl border text-xs font-mono transition-all ${step === 1 ? "bg-patina-500/10 border-patina-400 text-patina-300" : "bg-mist-950 border-mist-700 text-halo-dim opacity-70"}`}>
            <div className="font-bold mb-1">Tx 1: Evaluate TEE Eligibility</div>
            <div>Compute salary ceiling check on-chain</div>
          </div>
          <div className={`p-3 rounded-xl border text-xs font-mono transition-all ${step === 2 ? "bg-patina-500/10 border-patina-400 text-patina-300" : "bg-mist-950 border-mist-700 text-halo-dim opacity-70"}`}>
            <div className="font-bold mb-1">Tx 2: Execute Aave Borrow</div>
            <div>Submit TEE proof & receive Aave funds</div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Amount Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-halo-dim uppercase tracking-wider font-medium">
                Requested Loan Amount ($ USD)
              </label>
              <span className="font-display text-2xl font-bold text-patina-300">
                ${requestedAmount.toLocaleString()}.00
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max={Math.max(50000, maxLimit)}
              step="500"
              disabled={step === 2}
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(Number(e.target.value))}
              className="w-full h-2.5 bg-mist-950 rounded-lg appearance-none cursor-pointer accent-patina-400 border border-mist-700 disabled:opacity-50"
            />
            <div className="flex justify-between text-[11px] font-mono text-halo-deep pt-1">
              <span>Min: $1,000</span>
              <span>Max Capacity: ${maxLimit.toLocaleString()} (6x Salary)</span>
            </div>
          </div>

          {/* Sealed Borrow Handle Ticker Preview */}
          <div className="p-5 bg-mist-950/80 border border-mist-700 rounded-xl space-y-3 shadow-panel">
            <WaxSealValue
              label="Encrypted Borrow Amount Handle"
              encryptedHandle={currentHandle}
              actualValue={`$${requestedAmount.toLocaleString()}.00 USD`}
              userAddress={userAddress}
            />
          </div>

          {/* Transaction Status & Loading Indicators */}
          {(isWritingEval || isWritingBorrow) && (
            <div className="p-4 bg-patina-500/10 border border-patina-400/40 rounded-xl text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the transaction signature in your MetaMask wallet...
            </div>
          )}

          {(isConfirmingEval || isConfirmingBorrow) && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
                {step === 1 ? "Mining Step 1 (TEE Eligibility Evaluation)..." : "Mining Step 2 (Aave Borrow Execution)..."}
              </div>
            </div>
          )}

          {(writeErrorEval || writeErrorBorrow) && (
            <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {writeErrorEval?.message || writeErrorBorrow?.message || "Contract call failed."}
              </p>
            </div>
          )}

          {/* Action Buttons for 2-Step UX */}
          {step === 1 ? (
            <button
              type="button"
              onClick={handleStep1Evaluate}
              disabled={isBusy}
              className={`w-full ${isBusy ? "btn-outline opacity-60" : "btn-primary"}`}
            >
              {isWritingEval
                ? "Confirming Tx 1 Signature..."
                : isConfirmingEval
                ? "Evaluating Salary Eligibility on Sepolia..."
                : "1. Evaluate Salary Eligibility (Tx 1)"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStep2ExecuteBorrow}
              disabled={isBusy}
              className={`w-full ${isBusy ? "btn-outline opacity-60" : "btn-primary"}`}
            >
              {isWritingBorrow
                ? "Confirming Tx 2 Signature..."
                : isConfirmingBorrow
                ? "Executing Aave Borrow on Sepolia..."
                : "2. Confirm & Execute Aave Borrow (Tx 2)"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
