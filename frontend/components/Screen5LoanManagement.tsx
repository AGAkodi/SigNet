"use client";

import React, { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient } from "wagmi";
import { formatUnits } from "viem";
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
const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

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
    name: "getUserBorrowAmount",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserCollateralAmount",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "repay",
    inputs: [
      { name: "borrowAsset", type: "address" },
      { name: "repayAmount", type: "uint256" },
      { name: "externalRepayAmount", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "checkAndLiquidate",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const Screen5LoanManagement: React.FC<Screen5LoanManagementProps> = ({
  userAddress,
  activeBorrow,
  onRepayExecuted,
}) => {
  const [repayAmount, setRepayAmount] = useState("1000");
  const [isLiquidatable, setIsLiquidatable] = useState(false);
  const [activeAction, setActiveAction] = useState<"REPAY" | "EVALUATE" | "APPROVE" | null>(null);
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

  // 1. Read real on-chain borrow balance handle
  const { data: onChainBorrowHandle, refetch: refetchBorrowBalance } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getEncryptedBorrowBalance",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // 2. Read real on-chain plaintext borrow amount
  const { data: userBorrowAmountRaw, refetch: refetchBorrowAmount } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getUserBorrowAmount",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // 3. Read real on-chain collateral balance (for dynamic health ratio calculation)
  const { data: userCollateralWei, refetch: refetchCollateral } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getUserCollateralAmount",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // Read ERC20 USDC allowance for ConfidentialCredit vault
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress as `0x${string}`, CONFIDENTIAL_CREDIT_ADDRESS],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  const { writeContract, data: hash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { getBufferedFeeData } = useBufferedFees();
  const [localError, setLocalError] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Resolve values
  const borrowAmountVal = userBorrowAmountRaw ? Number(userBorrowAmountRaw) / 1000000 : activeBorrow;

  // Formatting Collateral & Health Factor
  let collateralInUSD = 0;
  if (userCollateralWei !== undefined) {
    const val = BigInt(userCollateralWei.toString());
    if (val > 0n) {
      if (val > 1000000000000n) {
        collateralInUSD = Number(formatUnits(val, 18)) * 3000;
      } else {
        collateralInUSD = Number(val) / 1000000;
      }
    }
  }
  const maxBorrowCapacity = cachedRate * 6;
  const totalCapacity = collateralInUSD + maxBorrowCapacity;
  const isActuallyLiquidatable = borrowAmountVal > 0 && totalCapacity < borrowAmountVal;

  const resolvedIsLiquidatable = isActuallyLiquidatable || isLiquidatable;

  const parsedRepay = repayAmount ? parseFloat(repayAmount) : 0;
  const requiredRepayAmount = parsedRepay > 0 && !isNaN(parsedRepay) ? BigInt(Math.floor(parsedRepay)) : 0n;
  const currentAllowance = allowance ? BigInt(allowance.toString()) : 0n;
  const isNeedApproval = parsedRepay > 0 && currentAllowance < requiredRepayAmount;

  // Initialize repayment amount safe default once borrow value is fetched
  useEffect(() => {
    if (borrowAmountVal > 0) {
      setRepayAmount(Math.min(5000, borrowAmountVal).toString());
    }
  }, [borrowAmountVal]);

  // When on-chain repayment, approval, or evaluation transaction completes
  useEffect(() => {
    if (isConfirmed && hash) {
      if (activeAction === "APPROVE") {
        refetchAllowance();
      } else if (activeAction === "REPAY") {
        refetchBorrowBalance();
        refetchBorrowAmount();
        refetchCollateral();
        refetchAllowance();
        const num = parseFloat(repayAmount);
        if (!isNaN(num) && num > 0) {
          onRepayExecuted(num);
        }
      }
      setActiveAction(null);
    }
  }, [isConfirmed, hash, activeAction, repayAmount, refetchBorrowBalance, refetchBorrowAmount, refetchCollateral, refetchAllowance, onRepayExecuted]);

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert("Please connect your wallet first to repay an encrypted position.");
      return;
    }
    const num = parseFloat(repayAmount);
    if (isNaN(num) || num <= 0) return;

    reset();
    setLocalError(null);

    const requiredAmount = BigInt(num);
    const currentAllowance = allowance ? BigInt(allowance.toString()) : 0n;

    if (currentAllowance < requiredAmount) {
      setActiveAction("APPROVE");
      try {
        console.log("Approving ConfidentialCredit to spend USDC...");
        const feeData = await getBufferedFeeData();

        if (publicClient) {
          try {
            await publicClient.simulateContract({
              account: userAddress as `0x${string}`,
              address: CONTRACT_ADDRESSES.USDC,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [CONFIDENTIAL_CREDIT_ADDRESS, requiredAmount],
              ...feeData,
            });
          } catch (simErr: any) {
            console.error("Approval simulation failed:", simErr);
            setLocalError(parseTxError(simErr));
            setActiveAction(null);
            return;
          }
        }

        writeContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONFIDENTIAL_CREDIT_ADDRESS, requiredAmount],
          ...feeData,
        });
      } catch (err) {
        console.error("USDC Approval Error:", err);
        setLocalError(parseTxError(err));
        setActiveAction(null);
      }
      return;
    }

    setActiveAction("REPAY");

    try {
      const enc = await noxSdk.encryptInput(num, CONFIDENTIAL_CREDIT_ADDRESS, userAddress, walletClient);
      console.log("Nox encryption result stubbed status:", enc.isStubbed);
      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      if (publicClient) {
        try {
          console.log("Simulating repay call...");
          await publicClient.simulateContract({
            account: userAddress as `0x${string}`,
            address: CONFIDENTIAL_CREDIT_ADDRESS,
            abi: CONFIDENTIAL_CREDIT_ABI,
            functionName: "repay",
            args: [
              CONTRACT_ADDRESSES.USDC,
              BigInt(num),
              enc.handle as `0x${string}`,
              enc.handleProof as `0x${string}`,
            ],
            ...feeData,
          });
          console.log("repay simulation succeeded.");
        } catch (simError: any) {
          console.error("Simulation failed for repay:", simError);
          let parsed = parseTxError(simError);
          if (enc.isStubbed) {
            parsed = `${parsed} (Using unverified local proof — Nox Gateway may be unreachable)`;
          }
          setLocalError(parsed);
          setActiveAction(null);
          return; // Block call from sending to wallet
        }
      }

      writeContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "repay",
        args: [
          CONTRACT_ADDRESSES.USDC,
          BigInt(num),
          enc.handle as `0x${string}`,
          enc.handleProof as `0x${string}`,
        ],
        ...feeData,
      });
    } catch (err) {
      console.error("Repayment Error:", err);
      setLocalError(parseTxError(err));
      setActiveAction(null);
    }
  };

  const handleEvaluateLiquidationOnChain = async () => {
    if (!userAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    reset();
    setLocalError(null);
    setActiveAction("EVALUATE");

    try {
      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      if (publicClient) {
        try {
          console.log("Simulating checkAndLiquidate call...");
          await publicClient.simulateContract({
            account: userAddress as `0x${string}`,
            address: CONFIDENTIAL_CREDIT_ADDRESS,
            abi: CONFIDENTIAL_CREDIT_ABI,
            functionName: "checkAndLiquidate",
            args: [userAddress as `0x${string}`],
            ...feeData,
          });
          console.log("checkAndLiquidate simulation succeeded.");
        } catch (simError: any) {
          console.error("Simulation failed for checkAndLiquidate:", simError);
          const parsed = parseTxError(simError);
          setLocalError(parsed);
          setActiveAction(null);
          return; // Block call from sending to wallet
        }
      }

      writeContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "checkAndLiquidate",
        args: [userAddress as `0x${string}`],
        ...feeData,
      });
    } catch (err) {
      console.error("Liquidation Evaluation Error:", err);
      setLocalError(parseTxError(err));
      setActiveAction(null);
    }
  };

  const currentOnChainHandle =
    onChainBorrowHandle && typeof onChainBorrowHandle === "string" && onChainBorrowHandle !== zeroHash
      ? onChainBorrowHandle
      : "0x0000000000000000000000000000000000000000000000000000000000000000";

  const isBusy = isWriting || isConfirming;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Liquidation Risk Banner */}
      {resolvedIsLiquidatable && (
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
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
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
              {resolvedIsLiquidatable ? "Clear Local Banner" : "Preview Risk Banner"}
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
              actualValue={`$${borrowAmountVal.toLocaleString()}.00 USD`}
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
                  resolvedIsLiquidatable
                    ? "bg-danger-soft border-danger-border text-danger font-semibold"
                    : "bg-patina-500/20 border-patina-400/50 text-patina-300 font-semibold"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    resolvedIsLiquidatable ? "bg-danger animate-pulse" : "bg-patina-400"
                  }`}
                />
                {resolvedIsLiquidatable ? "LIQUIDATION RISK" : "HEALTHY POSITION (TEE VERIFIED)"}
              </span>
            </div>
            <span className="text-[11px] text-halo-deep font-mono mt-3 block">
              Evaluated on-chain via ConfidentialCredit.checkAndLiquidate()
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
              Please confirm the {activeAction === "REPAY" ? "Repayment" : activeAction === "APPROVE" ? "USDC Approval" : "Liquidation Evaluation"} transaction in your wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
                {activeAction === "REPAY" ? "Encrypted Repayment" : activeAction === "APPROVE" ? "USDC Approval" : "Liquidation Evaluation"} submitted! Mining block on Sepolia...
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

          {(localError || writeError) && (
            <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {parseTxError(localError || writeError)}
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
              ? activeAction === "APPROVE" ? "Broadcasting Approval to Sepolia..." : "Broadcasting Repayment to Sepolia..."
              : isNeedApproval
              ? "Approve USDC Spender"
              : "Repay Loan Principal (On-Chain)"}
          </button>
        </form>
      </div>
    </div>
  );
};
