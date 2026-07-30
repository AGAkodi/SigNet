"use client";

import React, { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient } from "wagmi";
import { formatEther, parseUnits, formatUnits } from "viem";
import { SealedStatCard } from "./SealedStatCard";
import { noxSdk } from "../lib/noxSdk";
import { useBufferedFees, parseTxError } from "../lib/errorHelper";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

interface Screen3CreditDashboardProps {
  userAddress: string;
  streamData: { employer: string; monthlyRate: number; handle: string } | null;
  activeBorrow: number;
  collateral: number;
  onNavigateBorrow: () => void;
  onNavigateStream: () => void;
}

const CONFIDENTIAL_CREDIT_ADDRESS = CONTRACT_ADDRESSES.ConfidentialCredit;
const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

const CONFIDENTIAL_CREDIT_ABI = [
  {
    type: "function",
    name: "getUserCollateralAmount",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
    name: "getEncryptedBorrowBalance",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEncryptedLiquidationSignal",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "depositCollateral",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "externalAmount", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
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

export const Screen3CreditDashboard: React.FC<Screen3CreditDashboardProps> = ({
  userAddress,
  streamData,
  activeBorrow,
  collateral,
  onNavigateBorrow,
  onNavigateStream,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<string>(CONTRACT_ADDRESSES.WETH);
  const [amount, setAmount] = useState<string>("");
  const [activeAction, setActiveAction] = useState<"APPROVE" | "DEPOSIT" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cachedRate, setCachedRate] = useState<number>(0);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Load local cached plaintext rate if available
  useEffect(() => {
    if (typeof window !== "undefined" && userAddress) {
      const saved = localStorage.getItem(`signet_monthly_rate_${userAddress.toLowerCase()}`);
      if (saved) {
        setCachedRate(parseFloat(saved));
      }
    }
  }, [userAddress]);

  // 1. Read on-chain Stream ID for employee
  const { data: streamId, isLoading: isLoadingStreamId } = useReadContract({
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

  // 2. Read on-chain Stream details if stream ID exists
  const { data: streamDetails, isLoading: isLoadingStreamDetails } = useReadContract({
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

  const employer = streamDetails ? (streamDetails as any)[0] || (streamDetails as any).employer : "";
  const rateHandle = streamDetails ? (streamDetails as any)[2] || (streamDetails as any).monthlyRate : "";
  const isStreamActive = streamDetails ? (streamDetails as any)[5] || (streamDetails as any).isActive : false;

  // 3. Read real on-chain collateral balance
  const { data: userCollateralWei, refetch: refetchCollateral } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getUserCollateralAmount",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // 4. Read real on-chain borrow balance
  const { data: userBorrowAmountRaw, refetch: refetchBorrowAmount } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getUserBorrowAmount",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // 5. Read real on-chain encrypted borrow balance handle
  const { data: encryptedBorrowBalanceHandle } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getEncryptedBorrowBalance",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // 6. Read real on-chain encrypted liquidation signal
  const { data: encryptedLiquidationSignalHandle } = useReadContract({
    address: CONFIDENTIAL_CREDIT_ADDRESS,
    abi: CONFIDENTIAL_CREDIT_ABI,
    functionName: "getEncryptedLiquidationSignal",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") },
  });

  // 7. Read ERC20 allowance for ConfidentialCredit vault
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedAsset as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userAddress as `0x${string}`, CONFIDENTIAL_CREDIT_ADDRESS],
    query: { enabled: !!userAddress && userAddress.startsWith("0x") && !!selectedAsset },
  });

  const { writeContract, data: hash, isPending: isWriting, reset } = useWriteContract();
  const { getBufferedFeeData } = useBufferedFees();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Trigger refetches when transactions complete
  useEffect(() => {
    if (isConfirmed && hash) {
      if (activeAction === "APPROVE") {
        refetchAllowance();
      } else if (activeAction === "DEPOSIT") {
        refetchCollateral();
        refetchAllowance();
        refetchBorrowAmount();
        setAmount("");
      }
      setActiveAction(null);
    }
  }, [isConfirmed, hash, activeAction, refetchCollateral, refetchAllowance, refetchBorrowAmount]);

  const isLoading = isLoadingStreamId || (hasStream && isLoadingStreamDetails);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-patina-400 border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-patina-300">
          Loading on-chain ledger state...
        </p>
      </div>
    );
  }

  if (!hasStream || !isStreamActive) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="card text-center space-y-6">
          <div className="eyebrow-tag mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
            <span>[ 02. VAULT LEDGER ]</span>
          </div>

          <div className="w-full h-40 bg-mist-950/80 rounded-xl border border-mist-700/80 flex items-center justify-center p-4 shadow-inner">
            <svg viewBox="0 0 320 120" className="w-full h-full max-w-[280px]" fill="none">
              <rect x="20" y="20" width="280" height="80" rx="8" stroke="#3B382D" strokeWidth="1.5" fill="#16150F" strokeDasharray="6 6" />
              <path d="M 60 60 H 260" stroke="#565243" strokeWidth="1" />
              <circle cx="60" cy="60" r="8" fill="#1C1A14" stroke="#BFA24C" strokeWidth="2" />
              <circle cx="160" cy="60" r="8" fill="#1C1A14" stroke="#565243" strokeWidth="1.5" />
              <circle cx="260" cy="60" r="8" fill="#1C1A14" stroke="#565243" strokeWidth="1.5" />
              <text x="160" y="92" textAnchor="middle" className="font-mono text-[10px] fill-halo-deep tracking-wider">
                WAITING FOR ON-CHAIN INCOME STREAM
              </text>
            </svg>
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold text-halo-soft mb-2">
              Vault Ledger Empty
            </h2>
            <p className="text-xs sm:text-sm text-halo-dim max-w-md mx-auto font-sans leading-relaxed">
              No active salary stream registered on-chain yet. Register an encrypted income stream to calculate your confidential borrowing capacity.
            </p>
          </div>

          <button
            onClick={onNavigateStream}
            className="btn-primary w-full sm:w-auto"
          >
            + Register Salary Stream (Step 01)
          </button>
        </div>
      </div>
    );
  }

  // Resolve values
  const monthlyRateVal = cachedRate > 0 ? cachedRate : (streamData ? streamData.monthlyRate : 8000);
  const borrowVal = userBorrowAmountRaw ? Number(userBorrowAmountRaw) / 1000000 : 0;
  const decimals = selectedAsset === CONTRACT_ADDRESSES.USDC ? 6 : 18;

  // Formatting Collateral
  let formattedCollateral = `$${collateral.toLocaleString()}`;
  let collateralInUSD = collateral;

  if (userCollateralWei !== undefined) {
    const val = BigInt(userCollateralWei.toString());
    if (val > 0n) {
      if (val > 1000000000000n) { // WETH
        formattedCollateral = `${parseFloat(formatEther(val)).toFixed(4)} WETH`;
        // Use a standard mock price of $3000/WETH for capacity estimation in USD
        collateralInUSD = Number(formatUnits(val, 18)) * 3000;
      } else { // USDC
        formattedCollateral = `$${(Number(val) / 1000000).toLocaleString()}`;
        collateralInUSD = Number(val) / 1000000;
      }
    } else {
      formattedCollateral = "$0";
      collateralInUSD = 0;
    }
  }

  const maxBorrowCapacity = monthlyRateVal * 6;
  const availableBorrow = Math.max(0, maxBorrowCapacity - borrowVal);

  // Compute real Health Factor (capacity / borrow)
  const capacity = collateralInUSD + maxBorrowCapacity;
  const hf = borrowVal > 0 ? (capacity / borrowVal) : 99.9;
  const hfText = hf >= 99.9 ? "∞ (HEALTHY)" : `${hf.toFixed(2)} (${hf >= 1.067 ? "HEALTHY" : hf >= 1.0 ? "WARNING" : "UNDERWATER"})`;

  const parsedAmount = amount ? parseFloat(amount) : 0;
  const requiredAmount = parsedAmount > 0 ? parseUnits(amount, decimals) : 0n;
  const currentAllowance = allowance ? BigInt(allowance.toString()) : 0n;
  const isNeedApproval = parsedAmount > 0 && currentAllowance < requiredAmount;

  // Resolve handles
  const resolvedRateHandle = rateHandle && rateHandle !== zeroHash
    ? (rateHandle as string)
    : (streamData ? streamData.handle : "0x0000000000000000000000000000000000000000000000000000000000000000");

  const borrowHandle = encryptedBorrowBalanceHandle && encryptedBorrowBalanceHandle !== zeroHash
    ? (encryptedBorrowBalanceHandle as string)
    : "0x0000000000000000000000000000000000000000000000000000000000000000";

  const healthSignalHandle = encryptedLiquidationSignalHandle && encryptedLiquidationSignalHandle !== zeroHash
    ? (encryptedLiquidationSignalHandle as string)
    : "0x0000000000000000000000000000000000000000000000000000000000000000";

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert("Please connect your wallet first to deposit collateral.");
      return;
    }
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;

    reset();
    setLocalError(null);

    if (currentAllowance < requiredAmount) {
      setActiveAction("APPROVE");
      try {
        console.log("Approving ConfidentialCredit to spend selected asset...");
        const feeData = await getBufferedFeeData();

        if (publicClient) {
          try {
            await publicClient.simulateContract({
              account: userAddress as `0x${string}`,
              address: selectedAsset as `0x${string}`,
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
          address: selectedAsset as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONFIDENTIAL_CREDIT_ADDRESS, requiredAmount],
          ...feeData,
        });
      } catch (err) {
        console.error("Asset Approval Error:", err);
        setLocalError(parseTxError(err));
        setActiveAction(null);
      }
      return;
    }

    setActiveAction("DEPOSIT");

    try {
      const enc = await noxSdk.encryptInput(requiredAmount.toString(), CONFIDENTIAL_CREDIT_ADDRESS, userAddress, walletClient);
      console.log("Nox encryption result stubbed status:", enc.isStubbed);
      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      if (publicClient) {
        try {
          console.log("Simulating depositCollateral call...");
          await publicClient.simulateContract({
            account: userAddress as `0x${string}`,
            address: CONFIDENTIAL_CREDIT_ADDRESS,
            abi: CONFIDENTIAL_CREDIT_ABI,
            functionName: "depositCollateral",
            args: [
              selectedAsset as `0x${string}`,
              requiredAmount,
              enc.handle as `0x${string}`,
              enc.handleProof as `0x${string}`,
            ],
            ...feeData,
          });
          console.log("depositCollateral simulation succeeded.");
        } catch (simError: any) {
          console.error("Simulation failed for depositCollateral:", simError);
          let parsed = parseTxError(simError);
          if (enc.isStubbed) {
            parsed = `${parsed} (Using unverified local proof — Nox Gateway may be unreachable)`;
          }
          setLocalError(parsed);
          setActiveAction(null);
          return;
        }
      }

      writeContract({
        address: CONFIDENTIAL_CREDIT_ADDRESS,
        abi: CONFIDENTIAL_CREDIT_ABI,
        functionName: "depositCollateral",
        args: [
          selectedAsset as `0x${string}`,
          requiredAmount,
          enc.handle as `0x${string}`,
          enc.handleProof as `0x${string}`,
        ],
        ...feeData,
      });
    } catch (err) {
      console.error("Deposit Error:", err);
      setLocalError(parseTxError(err));
      setActiveAction(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2">
      {/* Header Ledger Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-mist-700 pb-6">
        <div>
          <div className="eyebrow-tag">
            <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
            <span>[ 02. VAULT LEDGER ]</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft">
            Confidential Credit Ledger
          </h2>
        </div>
        <button
          onClick={onNavigateBorrow}
          className="mt-4 sm:mt-0 btn-primary"
        >
          + Request Borrow
        </button>
      </div>

      {/* 3 Sealed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Available to Borrow */}
        <SealedStatCard
          label="Available to Borrow"
          encryptedHandle={resolvedRateHandle}
          actualValue={`$${availableBorrow.toLocaleString()}.00 USD`}
          userAddress={userAddress}
          footnote="Limit: 6x Monthly Salary"
        />

        {/* Card 2: Current Health Factor */}
        <SealedStatCard
          label="Current Health Factor"
          encryptedHandle={healthSignalHandle}
          actualValue={hfText}
          userAddress={userAddress}
          footnote="Magnitude hidden from public view"
          statusBadge={{
            text: hf >= 1.0 ? "HEALTHY (TEE VERIFIED)" : "LIQUIDATABLE (TEE VERIFIED)",
            isHealthy: hf >= 1.0,
          }}
        />

        {/* Card 3: Active Loan Balance */}
        <SealedStatCard
          label="Active Loan Balance"
          encryptedHandle={borrowHandle}
          actualValue={`$${borrowVal.toLocaleString()}.00 USD`}
          userAddress={userAddress}
          footnote={`Collateral Deposited: ${formattedCollateral}`}
        />
      </div>

      {/* Deposit Collateral Section */}
      <div className="card space-y-6">
        <div>
          <h3 className="font-display text-xl font-bold text-halo-soft">
            Deposit Collateral to Vault
          </h3>
          <p className="text-xs text-halo-dim mt-1 font-sans leading-relaxed">
            Secure your borrowing capacity by depositing WETH or USDC as collateral. This will register your encrypted collateral handle on-chain.
          </p>
        </div>

        <form onSubmit={handleDeposit} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] tracking-wider uppercase font-semibold text-halo-deep">
                Select Asset
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => {
                  setSelectedAsset(e.target.value);
                  setAmount("");
                  setLocalError(null);
                }}
                disabled={activeAction !== null}
                className="w-full bg-mist-950 border border-mist-700 rounded-xl py-3 px-4 text-sm text-halo-soft focus:outline-none focus:border-patina-500 disabled:opacity-50 font-medium"
              >
                <option value={CONTRACT_ADDRESSES.WETH}>WETH (Wrapped Ether)</option>
                <option value={CONTRACT_ADDRESSES.USDC}>USDC (USD Coin)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] tracking-wider uppercase font-semibold text-halo-deep">
                Deposit Amount
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setLocalError(null);
                }}
                disabled={activeAction !== null}
                className="w-full bg-mist-950 border border-mist-700 rounded-xl py-3 px-4 text-sm text-halo-soft focus:outline-none focus:border-patina-500 disabled:opacity-50"
                placeholder="0.00"
              />
            </div>
          </div>

          {localError && (
            <div className="p-3 bg-red-950/80 border border-red-700/80 text-red-200 rounded-xl">
              {localError}
            </div>
          )}

          {activeAction && isWriting && (
            <div className="p-3 bg-mist-950/80 border border-mist-700/80 text-patina-300 rounded-xl animate-pulse">
              Prompting wallet signature for {activeAction}...
            </div>
          )}

          {activeAction && isConfirming && (
            <div className="p-3 bg-mist-950/80 border border-mist-700/80 text-patina-300 rounded-xl">
              Confirming {activeAction} transaction on-chain (waiting for receipt)...
            </div>
          )}

          <button
            type="submit"
            disabled={activeAction !== null || !amount || parseFloat(amount) <= 0}
            className="btn-primary w-full text-center"
          >
            {activeAction === "APPROVE"
              ? "Approving Asset..."
              : activeAction === "DEPOSIT"
              ? "Depositing..."
              : isNeedApproval
              ? "Approve Asset"
              : "Deposit Collateral"}
          </button>
        </form>
      </div>

      {/* Underwriting Stream Details Panel */}
      <div className="card space-y-4">
        <h3 className="font-display text-xl font-bold text-halo-soft">
          Underwriting Income Stream Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 bg-mist-950/80 rounded-xl border border-mist-700/80 shadow-panel space-y-1">
            <span className="text-halo-deep block text-[10px] tracking-wider uppercase font-semibold">EMPLOYER ADDRESS</span>
            <span className="text-halo-soft truncate block font-medium">{employer}</span>
          </div>
          <div className="p-4 bg-mist-950/80 rounded-xl border border-mist-700/80 shadow-panel space-y-1">
            <span className="text-halo-deep block text-[10px] tracking-wider uppercase font-semibold">ENCRYPTED CIPHER HANDLE</span>
            <span className="text-patina-300 truncate block font-semibold">{resolvedRateHandle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
