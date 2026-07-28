"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk, EncryptedInputResult } from "../lib/noxSdk";

import { CONTRACT_ADDRESSES } from "../lib/contracts";

interface Screen2StreamSetupProps {
  userAddress: string;
  onStreamCreated: (streamData: { employer: string; monthlyRate: number; handle: string }) => void;
}

const INCOME_STREAM_ADDRESS = CONTRACT_ADDRESSES.IncomeStream;

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
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="card">
        {/* Header with Consistent Eyebrow Tag */}
        <div className="flex items-start justify-between border-b border-mist-700 pb-5 mb-6">
          <div>
            <div className="eyebrow-tag">
              <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
              <span>[ 01. STREAM SETUP ]</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft">
              Income Stream Setup
            </h2>
          </div>
          <span className="px-3 py-1 bg-mist-800 border border-mist-700 text-patina-300 text-xs font-mono rounded-lg shadow-panel shrink-0 mt-1">
            IncomeStream.sol
          </span>
        </div>

        <p className="text-xs sm:text-sm text-halo-dim mb-8 font-sans leading-relaxed">
          Register your payroll income stream. Monthly earnings are converted into a 32-byte encrypted handle and recorded on-chain via <code className="text-patina-300 font-mono">IncomeStream.sol</code> at <code className="text-patina-300 font-mono">0x42ced2...f7cf</code>.
        </p>

        <form onSubmit={handleCreateStream} className="space-y-6">
          <div>
            <label className="block text-xs font-mono text-halo-dim mb-2 uppercase tracking-wider">
              Employer Wallet Address
            </label>
            <input
              type="text"
              value={employerAddress}
              onChange={(e) => setEmployerAddress(e.target.value)}
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-halo-dim mb-2 uppercase tracking-wider">
              Monthly Salary Rate ($ USD)
            </label>
            <input
              type="number"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              required
              min="100"
              className="input-field"
            />
          </div>

          {/* Live Sealed Ticker Preview */}
          <div className="p-5 bg-mist-950/80 border border-mist-700 rounded-xl space-y-3 shadow-panel">
            <WaxSealValue
              label="Live Sealed Salary Stream Ticker"
              encryptedHandle={currentHandle}
              actualValue={`$${parseFloat(monthlySalary || "0").toLocaleString()}.00 / mo`}
              userAddress={userAddress}
            />
            <div className="flex items-center gap-2 text-[11px] font-mono text-halo-deep pt-2 border-t border-mist-700/60">
              <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
              <span>Handle Format: 32-byte bytes32 (Salted Keccak-256 TEE Handle Commitment)</span>
            </div>
          </div>

          {/* Transaction Status Alerts */}
          {isWriting && (
            <div className="p-4 bg-patina-500/10 border border-patina-400/40 rounded-xl text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the transaction in your MetaMask wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
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
            <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {writeError?.message || receiptError?.message || "Contract call failed."}
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
              ? "Broadcasting to Arbitrum Sepolia..."
              : "Encrypt & Continue (On-Chain)"}
          </button>
        </form>
      </div>
    </div>
  );
};
