"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { useBufferedFees, parseTxError } from "../lib/errorHelper";
import { isAddress, getAddress } from "viem";

interface AccessGrant {
  id: string;
  auditorAddress: string;
  field: string;
  grantedAt: string;
  handle: string;
}

import { CONTRACT_ADDRESSES } from "../lib/contracts";

interface Screen6SelectiveDisclosureProps {
  userAddress: string;
  streamHandle: string;
}

const NOX_COMPUTE_ADDRESS = CONTRACT_ADDRESSES.NoxCompute;

const NOX_COMPUTE_ACL_ABI = [
  {
    type: "function",
    name: "allow",
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "disallowTransient",
    inputs: [
      { name: "handle", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const Screen6SelectiveDisclosure: React.FC<Screen6SelectiveDisclosureProps> = ({
  userAddress,
  streamHandle,
}) => {
  const [auditorAddress, setAuditorAddress] = useState("");
  // Grants list starts empty for clean user session state
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [activeAction, setActiveAction] = useState<"GRANT" | "REVOKE" | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  const { writeContract, data: hash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { getBufferedFeeData } = useBufferedFees();
  const [localError, setLocalError] = useState<string | null>(null);
  const publicClient = usePublicClient();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({
      hash,
    });

  const targetHandle =
    streamHandle && streamHandle.startsWith("0x") && streamHandle.length === 66
      ? streamHandle
      : "0x0000000000000000000000000000000000000000000000000000000000000000";

  // When grant or revoke transaction confirms on-chain
  useEffect(() => {
    if (isConfirmed && hash && activeAction) {
      if (activeAction === "GRANT") {
        const newGrant: AccessGrant = {
          id: `grant-${Date.now()}`,
          auditorAddress,
          field: "Monthly Salary Income Stream",
          grantedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
          handle: targetHandle,
        };
        setGrants((prev) => [...prev.filter((g) => g.auditorAddress !== auditorAddress), newGrant]);
      } else if (activeAction === "REVOKE" && pendingRevokeId) {
        setGrants((prev) => prev.filter((g) => g.id !== pendingRevokeId));
        setPendingRevokeId(null);
      }
      setActiveAction(null);
    }
  }, [isConfirmed, hash, activeAction, auditorAddress, targetHandle, pendingRevokeId]);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      alert("Please connect your wallet first to manage ACL permissions.");
      return;
    }
    
    const trimmed = auditorAddress.trim();
    if (!isAddress(trimmed)) {
      setLocalError("Invalid wallet address. Please check the hex format.");
      return;
    }

    let normalizedAuditor = "";
    try {
      normalizedAuditor = getAddress(trimmed);
      setAuditorAddress(normalizedAuditor);
    } catch (err) {
      setLocalError("Invalid wallet address checksum.");
      return;
    }

    reset();
    setLocalError(null);
    setActiveAction("GRANT");

    try {
      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      if (publicClient) {
        try {
          console.log("Simulating allow call on NoxCompute...");
          await publicClient.simulateContract({
            account: userAddress as `0x${string}`,
            address: NOX_COMPUTE_ADDRESS,
            abi: NOX_COMPUTE_ACL_ABI,
            functionName: "allow",
            args: [targetHandle as `0x${string}`, normalizedAuditor as `0x${string}`],
            ...feeData,
          });
          console.log("allow simulation succeeded.");
        } catch (simError: any) {
          console.error("Simulation failed for allow:", simError);
          const parsed = parseTxError(simError);
          setLocalError(parsed);
          setActiveAction(null);
          return; // Block call from sending to wallet
        }
      }

      writeContract({
        address: NOX_COMPUTE_ADDRESS,
        abi: NOX_COMPUTE_ACL_ABI,
        functionName: "allow",
        args: [targetHandle as `0x${string}`, normalizedAuditor as `0x${string}`],
        ...feeData,
      });
    } catch (err) {
      console.error("Grant Access Error:", err);
      setLocalError(parseTxError(err));
      setActiveAction(null);
    }
  };

  const handleRevokeAccess = async (grant: AccessGrant) => {
    if (!userAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    reset();
    setLocalError(null);
    setActiveAction("REVOKE");
    setPendingRevokeId(grant.id);

    try {
      const feeData = await getBufferedFeeData();

      // Pre-flight contract simulation
      if (publicClient) {
        try {
          console.log("Simulating disallowTransient call on NoxCompute...");
          await publicClient.simulateContract({
            account: userAddress as `0x${string}`,
            address: NOX_COMPUTE_ADDRESS,
            abi: NOX_COMPUTE_ACL_ABI,
            functionName: "disallowTransient",
            args: [targetHandle as `0x${string}`, grant.auditorAddress as `0x${string}`],
            ...feeData,
          });
          console.log("disallowTransient simulation succeeded.");
        } catch (simError: any) {
          console.error("Simulation failed for disallowTransient:", simError);
          const parsed = parseTxError(simError);
          setLocalError(parsed);
          return; // Block call from sending to wallet
        }
      }

      writeContract({
        address: NOX_COMPUTE_ADDRESS,
        abi: NOX_COMPUTE_ACL_ABI,
        functionName: "disallowTransient",
        args: [targetHandle as `0x${string}`, grant.auditorAddress as `0x${string}`],
        ...feeData,
      });
    } catch (err) {
      console.error("Revoke Access Error:", err);
      setLocalError(parseTxError(err));
    }
  };

  const isBusy = isWriting || isConfirming;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div className="card">
        {/* Header with Consistent Eyebrow Tag */}
        <div className="flex items-start justify-between border-b border-mist-700 pb-5 mb-6">
          <div>
            <div className="eyebrow-tag">
              <span className="w-1.5 h-1.5 rounded-full bg-patina-400" />
              <span>[ 05. AUDIT VIEW ]</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-halo-soft">
              Selective Disclosure & ACL
            </h2>
          </div>
          <span className="px-3 py-1 bg-mist-800 border border-mist-700 text-patina-300 text-xs font-mono rounded-lg shadow-panel shrink-0 mt-1">
            Nox ACL
          </span>
        </div>

        <p className="text-xs sm:text-sm text-halo-dim mb-6 font-sans leading-relaxed">
          Grant specific third parties (e.g. institutional auditors or landlords) ACL-scoped view permissions to decrypt specific sealed handles on-chain. You retain full control to revoke access at any time via <code className="text-patina-300 font-mono">disallowTransient</code>.
        </p>

        {/* House Line-Art SVG Diagram for TEE Access Control */}
        <div className="w-full h-36 bg-mist-950/80 rounded-xl border border-mist-700/80 flex items-center justify-center p-4 mb-6 shadow-inner">
          <svg viewBox="0 0 360 100" className="w-full h-full max-w-[320px]" fill="none">
            <rect x="20" y="20" width="80" height="60" rx="8" fill="#16150F" stroke="#3B382D" strokeWidth="1.5" />
            <text x="60" y="54" textAnchor="middle" className="font-mono text-[10px] fill-halo-soft font-semibold">OWNER</text>

            <path d="M 100 50 H 150" stroke="#BFA24C" strokeWidth="2" strokeDasharray="4 4" />

            <rect x="150" y="20" width="80" height="60" rx="8" fill="#1C1A14" stroke="#BFA24C" strokeWidth="1.5" />
            <text x="190" y="54" textAnchor="middle" className="font-mono text-[10px] fill-patina-300 font-bold">NOX ACL</text>

            <path d="M 230 50 H 280" stroke="#BFA24C" strokeWidth="2" strokeDasharray="4 4" />

            <rect x="280" y="20" width="60" height="60" rx="8" fill="#16150F" stroke="#3B382D" strokeWidth="1.5" />
            <text x="310" y="54" textAnchor="middle" className="font-mono text-[10px] fill-halo-dim font-medium">AUDITOR</text>
          </svg>
        </div>

        {/* Grant Access Form */}
        <form onSubmit={handleGrantAccess} className="space-y-5 mb-8">
          <div>
            <label className="block text-xs font-mono text-halo-dim mb-2 uppercase tracking-wider font-medium">
              Auditor / Third-Party Wallet Address
            </label>
            <input
              type="text"
              value={auditorAddress}
              onChange={(e) => setAuditorAddress(e.target.value)}
              onBlur={() => {
                const trimmed = auditorAddress.trim();
                if (trimmed) {
                  if (!isAddress(trimmed)) {
                    setLocalError("Invalid wallet address. Please check the hex format.");
                  } else {
                    try {
                      const normalized = getAddress(trimmed);
                      setAuditorAddress(normalized);
                      setLocalError(null);
                    } catch (e) {
                      setLocalError("Invalid wallet address checksum.");
                    }
                  }
                }
              }}
              required
              className="input-field"
              placeholder="0x..."
            />
          </div>

          <div className="p-4 bg-mist-950/80 border border-mist-700/80 rounded-xl text-xs text-halo-dim font-sans space-y-1.5 shadow-panel">
            <div>
              You're giving <code className="text-patina-300 font-mono">{auditorAddress.slice(0, 10)}...</code> permission to view your <span className="text-halo-soft font-semibold">Monthly Salary Income Handle</span>.
            </div>
            <div className="text-[11px] text-halo-deep font-mono leading-relaxed">
              Note: Access permissions are granted on-chain via <code className="text-patina-300">NoxCompute.allow</code> until explicitly revoked via <code className="text-patina-300">disallowTransient</code>.
            </div>
          </div>

          {/* Transaction Status Alerts */}
          {isWriting && (
            <div className="p-4 bg-patina-500/10 border border-patina-400/40 rounded-xl text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the {activeAction === "GRANT" ? "ACL Grant" : "ACL Revoke"} signature in your wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-4 bg-mist-950 border border-patina-400/60 rounded-xl text-xs font-mono text-halo-soft space-y-1.5">
              <div className="flex items-center gap-2 text-patina-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-patina-400 animate-pulse" />
                {activeAction === "GRANT" ? "ACL Grant" : "ACL Revoke"} transaction submitted! Mining block on Sepolia...
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

          {(localError || writeError || receiptError) && (
            <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ ACL Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {parseTxError(localError || writeError || receiptError)}
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
              ? "Broadcasting ACL Grant to Sepolia..."
              : "Grant Selective View Access (Nox ACL)"}
          </button>
        </form>

        {/* Active Access List */}
        <div className="pt-2">
          <h3 className="font-display text-xl font-bold text-halo-soft mb-4">
            Active Selective Disclosures
          </h3>

          {grants.length === 0 ? (
            <div className="p-5 bg-mist-950/80 border border-mist-700/80 rounded-xl text-center text-xs text-halo-deep font-mono shadow-inner">
              No active third-party disclosures granted in this session.
            </div>
          ) : (
            <div className="space-y-3">
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  className="p-4 bg-mist-950/90 border border-mist-700 rounded-xl flex items-center justify-between shadow-panel"
                >
                  <div>
                    <span className="text-xs font-mono text-halo-soft block font-semibold">
                      {grant.auditorAddress}
                    </span>
                    <span className="text-[11px] text-halo-dim font-mono">
                      Target: {grant.field} • Granted: {grant.grantedAt}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevokeAccess(grant)}
                    disabled={isBusy}
                    className="btn-danger !px-3.5 !py-1.5"
                  >
                    Revoke Access
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
