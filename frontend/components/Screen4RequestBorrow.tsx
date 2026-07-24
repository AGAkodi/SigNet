"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk, EncryptedInputResult } from "../lib/noxSdk";

interface Screen4RequestBorrowProps {
  userAddress: string;
  monthlyIncome: number;
  onBorrowApproved: (amount: number) => void;
}

const CONFIDENTIAL_CREDIT_ADDRESS = "0xECA515C29Eb3FD70cCdA5c8E2602a9094C137A65";

const CONFIDENTIAL_CREDIT_ABI = [
  {
    type: "function",
    name: "requestBorrow",
    inputs: [{ name: "requestedAmount", type: "bytes32" }],
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

  const { writeContract, data: hash, isPending: isWriting, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Re-encrypt handle whenever slider amount or userAddress updates
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

  // Navigate to Screen 5 only after on-chain transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash) {
      onBorrowApproved(requestedAmount);
    }
  }, [isConfirmed, hash, requestedAmount, onBorrowApproved]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert("Please connect your wallet first to submit a confidential borrow request.");
      return;
    }

    try {
      const res = await noxSdk.encryptInput(requestedAmount, CONFIDENTIAL_CREDIT_ADDRESS, userAddress);
      setEncResult(res);

      writeContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "requestBorrow",
        args: [res.encryptedHandle as `0x${string}`],
      });
    } catch (err) {
      console.error("Borrow Request Error:", err);
    }
  };

  const isBusy = isWriting || isConfirming;
  const currentHandle = encResult?.encryptedHandle || "0x0000000000000000000000000000000000000000000000000000000000000000";

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="bg-mist-900 border border-mist-700 rounded-2xl p-6 sm:p-8 shadow-panel">
        <div className="flex items-center justify-between border-b border-mist-700 pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-patina-400">STEP 03 OF 04</span>
            <h2 className="font-display text-2xl font-bold text-halo-soft">
              Request Borrow Position
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-mist-800 border border-mist-700 text-patina-300 text-xs font-mono rounded">
            ConfidentialCredit.sol (Sepolia)
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-mono text-halo-dim uppercase">
                Requested Loan Amount ($ USD)
              </label>
              <span className="font-display text-xl font-bold text-patina-300">
                ${requestedAmount.toLocaleString()}.00
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max={Math.max(50000, maxLimit)}
              step="500"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(Number(e.target.value))}
              className="w-full h-2 bg-mist-950 rounded-lg appearance-none cursor-pointer accent-patina-400 border border-mist-700"
            />
            <div className="flex justify-between text-[11px] font-mono text-halo-deep mt-1">
              <span>$1,000</span>
              <span>Max Capacity: ${maxLimit.toLocaleString()} (6x Salary)</span>
            </div>
          </div>

          {/* Sealed Borrow Handle Ticker Preview */}
          <div className="p-4 bg-mist-950 border border-mist-700 rounded-xl space-y-2">
            <WaxSealValue
              label="Encrypted Borrow Amount Handle"
              encryptedHandle={currentHandle}
              actualValue={`$${requestedAmount.toLocaleString()}.00 USD`}
              userAddress={userAddress}
            />
            <div className="text-[11px] text-halo-dim font-sans pt-2 border-t border-mist-700/50">
              <span className="text-patina-300 font-mono font-semibold block mb-0.5">TEE On-Chain Evaluation Notice:</span>
              Borrow eligibility is evaluated confidentially on-chain by <code className="text-patina-300 font-mono">ConfidentialCredit.sol</code> using Nox TEE primitives (<code className="text-patina-300 font-mono">Nox.ge</code> & <code className="text-patina-300 font-mono">Nox.select</code>). Token minting is gated directly inside the contract.
            </div>
          </div>

          {/* Transaction Status & Loading Indicators */}
          {isWriting && (
            <div className="p-3 bg-patina-500/10 border border-patina-400/40 rounded-lg text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the borrow request signature in your MetaMask wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-3.5 bg-mist-950 border border-patina-400/60 rounded-lg text-xs font-mono text-halo-soft space-y-1">
              <div className="flex items-center gap-2 text-patina-300">
                <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
                Borrow request submitted! Mining block on Arbitrum Sepolia...
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
            <div className="p-3.5 bg-danger-soft border border-danger-border rounded-lg text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ Borrow Request Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {writeError?.message || receiptError?.message || "Contract call failed."}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className={`w-full py-3 font-semibold text-xs font-mono rounded-lg transition-colors shadow-panel ${
              isBusy
                ? "bg-mist-800 text-halo-deep cursor-wait border border-mist-700"
                : "bg-patina-400 hover:bg-patina-500 text-mist-950 focus:outline-none focus:ring-1 focus:ring-patina-300"
            }`}
          >
            {isWriting
              ? "Confirming Signature in Wallet..."
              : isConfirming
              ? "Broadcasting Borrow Request to Sepolia..."
              : "Confirm & Sign Encrypted Borrow (On-Chain)"}
          </button>
        </form>
      </div>
    </div>
  );
};
