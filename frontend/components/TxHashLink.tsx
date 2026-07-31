import React from "react";

export function TxHashLink({ hash }: { hash?: `0x${string}` | string | null }) {
  if (!hash || typeof hash !== "string") return null;
  return (
    <a
      href={`https://sepolia.arbiscan.io/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-400 underline hover:text-amber-300 font-mono text-sm block mt-2"
    >
      View transaction: {hash.slice(0, 10)}...{hash.slice(-8)} ↗
    </a>
  );
}
