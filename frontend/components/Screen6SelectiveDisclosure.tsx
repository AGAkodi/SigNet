"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

interface AccessGrant {
  id: string;
  auditorAddress: string;
  field: string;
  grantedAt: string;
  handle: string;
}

interface Screen6SelectiveDisclosureProps {
  userAddress: string;
  streamHandle: string;
}

const NOX_COMPUTE_ADDRESS = "0x39847AeBa923Cc7367d4684194091D022B3F8548";

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
  const [auditorAddress, setAuditorAddress] = useState("0x8F9123b37A2027eE4627E5F90e66E15B17457C99");
  // Grants list starts empty for clean user session state
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [activeAction, setActiveAction] = useState<"GRANT" | "REVOKE" | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  const { writeContract, data: hash, isPending: isWriting, error: writeError, reset } = useWriteContract();

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
    if (!auditorAddress || !auditorAddress.startsWith("0x")) {
      alert("Please enter a valid auditor wallet address.");
      return;
    }

    reset();
    setActiveAction("GRANT");

    writeContract({
      address: NOX_COMPUTE_ADDRESS,
      abi: NOX_COMPUTE_ACL_ABI,
      functionName: "allow",
      args: [targetHandle as `0x${string}`, auditorAddress as `0x${string}`],
    });
  };

  const handleRevokeAccess = async (grant: AccessGrant) => {
    if (!userAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    reset();
    setActiveAction("REVOKE");
    setPendingRevokeId(grant.id);

    writeContract({
      address: NOX_COMPUTE_ADDRESS,
      abi: NOX_COMPUTE_ACL_ABI,
      functionName: "disallowTransient",
      args: [targetHandle as `0x${string}`, grant.auditorAddress as `0x${string}`],
    });
  };

  const isBusy = isWriting || isConfirming;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="bg-mist-900 border border-mist-700 rounded-2xl p-6 sm:p-8 shadow-panel">
        <div className="flex items-center justify-between border-b border-mist-700 pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-patina-400">AUDIT & COMPLIANCE</span>
            <h2 className="font-display text-2xl font-bold text-halo-soft">
              Selective Disclosure Panel
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-mist-800 border border-mist-700 text-patina-300 text-xs font-mono rounded">
            Nox ACL Management
          </span>
        </div>

        <p className="text-xs text-halo-dim mb-6 font-sans">
          Grant specific third parties (e.g. institutional auditors or landlords) ACL-scoped view permissions to decrypt specific sealed handles on-chain. You retain full control to revoke access at any time via <code className="text-patina-300 font-mono">disallowTransient</code>.
        </p>

        {/* Grant Access Form */}
        <form onSubmit={handleGrantAccess} className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-mono text-halo-dim mb-1.5 uppercase">
              Auditor / Third-Party Wallet Address
            </label>
            <input
              type="text"
              value={auditorAddress}
              onChange={(e) => setAuditorAddress(e.target.value)}
              required
              className="w-full bg-mist-950 border border-mist-700 focus:border-patina-400 text-halo-soft font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none transition-colors"
            />
          </div>

          <div className="p-3.5 bg-mist-950 border border-mist-700 rounded-lg text-xs text-halo-dim font-sans space-y-1">
            <div>
              You're giving <code className="text-patina-300 font-mono">{auditorAddress.slice(0, 10)}...</code> permission to view your <span className="text-halo-soft font-semibold">Monthly Salary Income Handle</span>.
            </div>
            <div className="text-[11px] text-halo-deep font-mono">
              Note: Access permissions are granted on-chain via <code className="text-patina-300">NoxCompute.allow</code> until explicitly revoked. (Time-boxed auto-expiry is not natively supported by the Nox compute contract).
            </div>
          </div>

          {/* Transaction Status Alerts */}
          {isWriting && (
            <div className="p-3 bg-patina-500/10 border border-patina-400/40 rounded-lg text-xs font-mono text-patina-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-patina-400 animate-ping" />
              Please confirm the {activeAction === "GRANT" ? "ACL Grant" : "ACL Revoke"} signature in your wallet...
            </div>
          )}

          {isConfirming && hash && (
            <div className="p-3.5 bg-mist-950 border border-patina-400/60 rounded-lg text-xs font-mono text-halo-soft space-y-1">
              <div className="flex items-center gap-2 text-patina-300">
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

          {(writeError || receiptError) && (
            <div className="p-3.5 bg-danger-soft border border-danger-border rounded-lg text-xs font-mono text-danger space-y-1">
              <div className="font-semibold">⚠️ ACL Transaction Error</div>
              <p className="text-[11px] opacity-90 break-words">
                {writeError?.message || receiptError?.message || "ACL contract call failed."}
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
              ? "Broadcasting ACL Grant to Sepolia..."
              : "Grant Selective View Access (Nox ACL)"}
          </button>
        </form>

        {/* Active Access List */}
        <div>
          <h3 className="font-display text-lg font-semibold text-halo-soft mb-4">
            Active Selective Disclosures
          </h3>

          {grants.length === 0 ? (
            <div className="p-4 bg-mist-950 border border-mist-700 rounded-lg text-center text-xs text-halo-deep font-mono">
              No active third-party disclosures granted in this session.
            </div>
          ) : (
            <div className="space-y-3">
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  className="p-4 bg-mist-950 border border-mist-700 rounded-xl flex items-center justify-between shadow-panel"
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
                    className="px-3 py-1.5 bg-danger-soft hover:bg-danger border border-danger-border text-danger hover:text-white font-mono text-xs rounded transition-colors disabled:opacity-50"
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
