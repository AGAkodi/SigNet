"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk, EncryptedInputResult } from "../lib/noxSdk";

interface Screen2StreamSetupProps {
  userAddress: string;
  onStreamCreated: (streamData: { employer: string; monthlyRate: number; handle: string }) => void;
}

const INCOME_STREAM_ADDRESS = "0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf";

const INCOME_STREAM_ABI = [
  {
    type: "function",
    name: "createStream",
    inputs: [
      { name: "employee", type: "address" },
      { name: "rate", type: "bytes32" },
    ],
    outputs: [{ name: "streamId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

export const Screen2StreamSetup: React.FC<Screen2StreamSetupProps> = ({
  userAddress,
  onStreamCreated,
}) => {
  const [employerAddress, setEmployerAddress] = useState("0x4A817942C5c106A9a3a93F877b0C019c92238472");
  const [monthlySalary, setMonthlySalary] = useState("8000");
  const [encResult, setEncResult] = useState<EncryptedInputResult | null>(null);

  const { writeContract, data: hash, isPending: isWriting, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Re-generate encrypted handle whenever monthly salary or address changes
  useEffect(() => {
    let isMounted = true;
    const updateEncryption = async () => {
      if (!monthlySalary || isNaN(Number(monthlySalary)) || Number(monthlySalary) <= 0) return;
      try {
        const res = await noxSdk.encryptInput(
          monthlySalary,
          INCOME_STREAM_ADDRESS,
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
  }, [monthlySalary, userAddress]);

  // Navigate to Screen 3 only after on-chain transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash && encResult) {
      onStreamCreated({
        employer: employerAddress,
        monthlyRate: parseFloat(monthlySalary),
        handle: encResult.encryptedHandle,
      });
    }
  }, [isConfirmed, hash, encResult, employerAddress, monthlySalary, onStreamCreated]);

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert("Please connect your wallet first to interact on-chain.");
      return;
    }

    try {
      const res = await noxSdk.encryptInput(monthlySalary, INCOME_STREAM_ADDRESS, userAddress);
      setEncResult(res);

      writeContract({
        address: INCOME_STREAM_ADDRESS,
        abi: INCOME_STREAM_ABI,
        functionName: "createStream",
        args: [userAddress as `0x${string}`, res.encryptedHandle as `0x${string}`],
      });
    } catch (err) {
      console.error("Stream Creation Error:", err);
    }
  };

  const isBusy = isWriting || isConfirming;
  const currentHandle = encResult?.encryptedHandle || "0x0000000000000000000000000000000000000000000000000000000000000000";

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="bg-mist-900 border border-mist-700 rounded-2xl p-6 sm:p-8 shadow-panel">
        <div className="flex items-center justify-between border-b border-mist-700 pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-patina-400">STEP 01 OF 04</span>
            <h2 className="font-display text-2xl font-bold text-halo-soft">
              Income Stream Setup
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-mist-800 border border-mist-700 text-patina-300 text-xs font-mono rounded">
            IncomeStream.sol (Sepolia)
          </span>
        </div>

        <p className="text-xs text-halo-dim mb-6 font-sans">
          Register your payroll income stream. Monthly earnings are converted into a 32-byte encrypted handle and recorded on-chain via <code className="text-patina-300 font-mono">IncomeStream.sol</code> at <code className="text-patina-300 font-mono">0x42ced2...f7cf</code>.
        </p>

        <form onSubmit={handleCreateStream} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-halo-dim mb-1.5 uppercase">
              Employer Wallet Address
            </label>
            <input
              type="text"
              value={employerAddress}
              onChange={(e) => setEmployerAddress(e.target.value)}
              required
              className="w-full bg-mist-950 border border-mist-700 focus:border-patina-400 text-halo-soft font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-halo-dim mb-1.5 uppercase">
              Monthly Salary Rate ($ USD)
            </label>
            <input
              type="number"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              required
              min="100"
              className="w-full bg-mist-950 border border-mist-700 focus:border-patina-400 text-halo-soft font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none transition-colors"
            />
          </div>

          {/* Live Sealed Ticker Preview */}
          <div className="p-4 bg-mist-950 border border-mist-700 rounded-xl space-y-2">
            <WaxSealValue
              label="Live Sealed Salary Stream Ticker"
              encryptedHandle={currentHandle}
              actualValue={`$${parseFloat(monthlySalary || "0").toLocaleString()}.00 / mo`}
              userAddress={userAddress}
            />
            <div className="flex items-center gap-2 text-[10px] font-mono text-halo-deep pt-1 border-t border-mist-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
              <span>Handle Format: 32-byte bytes32 ({encResult?.isStubbed ? "Local Demo Encryption Stub" : "Live TEE Cipher"})</span>
            </div>
          </div>

          {/* Transaction Status Alerts */}
          {isWriting && (
            <div className="p-3 bg-patina-500/10 border border-patina-400/40 rounded-lg text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the transaction in your MetaMask wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-3.5 bg-mist-950 border border-patina-400/60 rounded-lg text-xs font-mono text-halo-soft space-y-1">
              <div className="flex items-center gap-2 text-patina-300">
                <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
                Transaction submitted! Mining block on Arbitrum Sepolia...
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
              <div className="font-semibold">⚠️ Transaction Error</div>
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
              ? "Broadcasting to Arbitrum Sepolia..."
              : "Encrypt & Continue (On-Chain)"}
          </button>
        </form>
      </div>
    </div>
  );
};
