"use client";

import React, { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient } from "wagmi";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk, EncryptedInputResult } from "../lib/noxSdk";
import { useBufferedFees, parseTxError } from "../lib/errorHelper";
import { TxHashLink } from "./TxHashLink";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

interface Screen4RequestBorrowProps {
  userAddress: string;
  monthlyIncome: number;
  onBorrowApproved: (amount: number) => void;
}

const CONFIDENTIAL_CREDIT_ADDRESS = CONTRACT_ADDRESSES.ConfidentialCredit;
const USDC_ARBITRUM_SEPOLIA = CONTRACT_ADDRESSES.USDC;
const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

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
  {
    type: "function",
    name: "getEncryptedBorrowEligibility",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

export const Screen4RequestBorrow: React.FC<Screen4RequestBorrowProps> = ({
  userAddress,
  monthlyIncome,
  onBorrowApproved,
}) => {
  const [cachedRate, setCachedRate] = useState<number>(0);

  // Load local cached plaintext rate if available
  useEffect(() => {
    if (typeof window !== "undefined" && userAddress) {
      const saved = localStorage.getItem(`signet_monthly_rate_${userAddress.toLowerCase()}`);
      if (saved) {
        setCachedRate(parseFloat(saved));
      }
    }
  }, [userAddress]);

  // 1. Read Stream ID on-chain
  const { data: streamId } = useReadContract({
    address: CONTRACT_ADDRESSES.IncomeStream,
    abi: [
      {
        type: "function",
        name: "employeeStreamId",
        inputs: [{ name: "employee", type: "address" }],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
      }
    ] as const,
    functionName: "employeeStreamId",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  const hasStream = streamId && streamId !== zeroHash;

  // 2. Read Stream details on-chain to confirm rate handle exists
  const { data: streamDetails } = useReadContract({
    address: CONTRACT_ADDRESSES.IncomeStream,
    abi: [
      {
        type: "function",
        name: "streams",
        inputs: [{ name: "streamId", type: "bytes32" }],
        outputs: [
          { name: "employer", type: "address" },
          { name: "employee", type: "address" },
          { name: "monthlyRate", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "lastClaimTime", type: "uint256" },
          { name: "isActive", type: "bool" },
        ],
        stateMutability: "view",
      }
    ] as const,
    functionName: "streams",
    args: [streamId as `0x${string}`],
    query: { enabled: !!hasStream },
  });

  const isStreamActive = streamDetails ? (streamDetails as any)[5] || (streamDetails as any).isActive : false;

  // Derive maximum limit
  const monthlyIncomeVal = cachedRate > 0 ? cachedRate : (isStreamActive ? monthlyIncome : 8000);
  const maxLimit = monthlyIncomeVal * 6;

  const [requestedAmount, setRequestedAmount] = useState(Math.min(15000, maxLimit));
  const [encResult, setEncResult] = useState<EncryptedInputResult | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [localErrorEval, setLocalErrorEval] = useState<string | null>(null);
  const [localErrorBorrow, setLocalErrorBorrow] = useState<string | null>(null);
  const [txHashEval, setTxHashEval] = useState<string | null>(null);
  const [txHashBorrow, setTxHashBorrow] = useState<string | null>(null);

  const { writeContract: writeEval, data: hashEval, isPending: isWritingEval, error: writeErrorEval } = useWriteContract();
  const { isLoading: isConfirmingEval, isSuccess: isConfirmedEval } = useWaitForTransactionReceipt({ hash: hashEval });

  const { writeContract: writeBorrow, data: hashBorrow, isPending: isWritingBorrow, error: writeErrorBorrow } = useWriteContract();
  const { isLoading: isConfirmingBorrow, isSuccess: isConfirmedBorrow } = useWaitForTransactionReceipt({ hash: hashBorrow });
  const { getBufferedFeeData } = useBufferedFees();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (hashEval) {
      setTxHashEval(hashEval);
    }
  }, [hashEval]);

  useEffect(() => {
    if (hashBorrow) {
      setTxHashBorrow(hashBorrow);
    }
  }, [hashBorrow]);

  // Clamp selected borrow amount if max limit dynamically scales down
  useEffect(() => {
    if (requestedAmount > maxLimit) {
      setRequestedAmount(maxLimit);
    }
  }, [maxLimit, requestedAmount]);

  // Re-encrypt handle whenever slider amount updates
  useEffect(() => {
    let isMounted = true;
    const updateEncryption = async () => {
      if (!requestedAmount || requestedAmount <= 0) return;
      if (!walletClient) return;
      try {
        const res = await noxSdk.encryptInput(
          requestedAmount,
          CONFIDENTIAL_CREDIT_ADDRESS,
          userAddress || "0x0000000000000000000000000000000000000000",
          walletClient
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
  }, [requestedAmount, userAddress, walletClient]);

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
    if (requestedAmount > maxLimit) {
      alert("Requested amount exceeds maximum borrowing capacity.");
      return;
    }
    setLocalErrorEval(null);
    setLocalErrorBorrow(null);
    setTxHashEval(null);
    try {
      const res = await noxSdk.encryptInput(requestedAmount, CONFIDENTIAL_CREDIT_ADDRESS, userAddress, walletClient);
      setEncResult(res);
      console.log("Nox encryption result stubbed status:", res.isStubbed);

      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      if (publicClient) {
        try {
          console.log("Simulating evaluateBorrowEligibility call...");
          await publicClient.simulateContract({
            account: userAddress as `0x${string}`,
            address: CONFIDENTIAL_CREDIT_ADDRESS,
            abi: CONFIDENTIAL_CREDIT_ABI,
            functionName: "evaluateBorrowEligibility",
            args: [
              USDC_ARBITRUM_SEPOLIA,
              BigInt(requestedAmount),
              res.handle as `0x${string}`,
              res.handleProof as `0x${string}`,
            ],
            ...feeData,
          });
          console.log("evaluateBorrowEligibility simulation succeeded.");
        } catch (simError: any) {
          console.error("Simulation failed for evaluateBorrowEligibility:", simError);
          let parsed = parseTxError(simError);
          if (res.isStubbed) {
            parsed = `${parsed} (Using unverified local proof — Nox Gateway may be unreachable)`;
          }
          setLocalErrorEval(parsed);
          return;
        }
      }

      writeEval({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "evaluateBorrowEligibility",
        args: [
          USDC_ARBITRUM_SEPOLIA,
          BigInt(requestedAmount),
          res.handle as `0x${string}`,
          res.handleProof as `0x${string}`,
        ],
        ...feeData,
      });
    } catch (err) {
      console.error("Evaluation Error:", err);
      setLocalErrorEval(parseTxError(err));
    }
  };

  const handleStep2ExecuteBorrow = async () => {
    setLocalErrorEval(null);
    setLocalErrorBorrow(null);
    setTxHashBorrow(null);
    try {
      if (!publicClient || !userAddress || !walletClient) return;

      // 1. Read stored eligibility handle from the contract
      const eligibilityHandle = await publicClient.readContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "getEncryptedBorrowEligibility",
        args: [userAddress as `0x${string}`],
      }) as string;

      console.log("On-chain Eligibility Handle:", eligibilityHandle);

      // 2. Fetch public decryption proof from Nox Gateway
      const eligibilityProof = await noxSdk.getPublicDecryptionProof(eligibilityHandle, walletClient);
      console.log("Fetched Decryption Proof:", eligibilityProof);

      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      try {
        console.log("Simulating requestBorrow call...");
        await publicClient.simulateContract({
          account: userAddress as `0x${string}`,
          address: CONFIDENTIAL_CREDIT_ADDRESS,
          abi: CONFIDENTIAL_CREDIT_ABI,
          functionName: "requestBorrow",
          args: [
            USDC_ARBITRUM_SEPOLIA,
            BigInt(requestedAmount),
            eligibilityProof as `0x${string}`,
          ],
          ...feeData,
        });
        console.log("requestBorrow simulation succeeded.");
      } catch (simError: any) {
        console.error("Simulation failed for requestBorrow:", simError);
        const parsed = parseTxError(simError);
        setLocalErrorBorrow(parsed);
        return;
      }

      writeBorrow({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "requestBorrow",
        args: [
          USDC_ARBITRUM_SEPOLIA,
          BigInt(requestedAmount),
          eligibilityProof as `0x${string}`,
        ],
        ...feeData,
      });
    } catch (err) {
      console.error("Borrow Execution Error:", err);
      setLocalErrorBorrow(parseTxError(err));
    }
  };

  const isBusy = isWritingEval || isConfirmingEval || isWritingBorrow || isConfirmingBorrow;
  const isOverLimit = requestedAmount > maxLimit;
  const currentHandle = encResult?.handle || "0x0000000000000000000000000000000000000000000000000000000000000000";

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
              max={maxLimit}
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

          {txHashEval && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
                <span className={`w-2 h-2 rounded-full ${isConfirmedEval ? "bg-patina-400" : "bg-patina-400 animate-pulse"}`} />
                {isConfirmedEval ? "Step 1 TEE Eligibility confirmed!" : "Mining Step 1 (TEE Eligibility Evaluation)..."}
              </div>
              <TxHashLink hash={txHashEval} />
            </div>
          )}

          {txHashBorrow && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
                <span className={`w-2 h-2 rounded-full ${isConfirmedBorrow ? "bg-patina-400" : "bg-patina-400 animate-pulse"}`} />
                {isConfirmedBorrow ? "Step 2 Aave Borrow execution confirmed!" : "Mining Step 2 (Aave Borrow Execution)..."}
              </div>
              <TxHashLink hash={txHashBorrow} />
            </div>
          )}

          {isOverLimit && (
            <div className="p-4 bg-red-950/80 border border-red-700/80 text-red-200 text-xs font-mono rounded-xl">
              ⚠️ Requested amount exceeds maximum borrowing capacity limit of ${maxLimit.toLocaleString()}.
            </div>
          )}

          {(localErrorEval || localErrorBorrow || writeErrorEval || writeErrorBorrow) && (
            <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {parseTxError(localErrorEval || localErrorBorrow || writeErrorEval || writeErrorBorrow)}
              </p>
            </div>
          )}

          {/* Action Buttons for 2-Step UX */}
          {step === 1 ? (
            <button
              type="button"
              onClick={handleStep1Evaluate}
              disabled={isBusy || isOverLimit}
              className={`w-full ${(isBusy || isOverLimit) ? "btn-outline opacity-60" : "btn-primary"}`}
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
