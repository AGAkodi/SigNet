"use client";

import React, { useState } from "react";
import { noxSdk } from "../lib/noxSdk";
import { ScrambleNumber } from "./ScrambleNumber";

interface SealedStatCardProps {
  label: string;
  encryptedHandle?: string;
  actualValue?: string;
  userAddress?: string;
  footnote: string;
  statusBadge?: {
    text: string;
    isHealthy: boolean;
  };
}

export const SealedStatCard: React.FC<SealedStatCardProps> = ({
  label,
  encryptedHandle = "0x9c82f00...a4e1",
  actualValue = "$0.00 USD",
  userAddress = "0xUser...",
  footnote,
  statusBadge,
}) => {
  const [isUnsealed, setIsUnsealed] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleToggleSeal = async () => {
    if (isUnsealed) {
      setIsUnsealed(false);
      return;
    }

    setIsDecrypting(true);
    try {
      const res = await noxSdk.decrypt(encryptedHandle, userAddress, actualValue);
      if (res.isAuthorized) {
        setIsUnsealed(true);
      }
    } catch (err) {
      console.error("Nox Decryption Error:", err);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="bg-mist-900 border border-mist-700 rounded-xl p-5 shadow-panel flex flex-col justify-between h-full min-h-[160px]">
      {/* Top Header & Main Value Display */}
      <div>
        <span className="text-xs uppercase tracking-wider text-halo-dim font-mono mb-3 block">
          {label}
        </span>

        <button
          onClick={handleToggleSeal}
          tabIndex={0}
          aria-label={`${isUnsealed ? "Seal" : "Unseal"} ${label}`}
          className={`w-full group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border transition-all text-left focus:outline-none focus:ring-1 focus:ring-patina-400 ${
            isUnsealed
              ? "bg-mist-950 border-patina-400/50 hover:border-patina-400 text-halo-soft"
              : "bg-mist-950 border-mist-700 hover:border-patina-400/80 text-halo-DEFAULT"
          }`}
        >
          {/* Dot Status Indicator */}
          <span
            className={`w-2 h-2 shrink-0 rounded-full transition-colors ${
              isUnsealed
                ? "bg-patina-400 shadow-[0_0_6px_#BFA24C]"
                : "bg-mist-500 group-hover:bg-patina-400"
            }`}
          />

          {/* Cipher / Value / Badge Content */}
          <div className="flex flex-col flex-1 min-w-0">
            {isUnsealed && statusBadge ? (
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-patina-500/20 text-patina-300 text-xs font-mono rounded-full border border-patina-400/50 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-patina-400 animate-pulse" />
                {statusBadge.text}
              </span>
            ) : (
              <ScrambleNumber
                value={actualValue}
                revealed={isUnsealed}
                className={`font-mono font-bold text-base sm:text-lg ${
                  isUnsealed ? "text-halo-soft" : "text-patina-300"
                }`}
              />
            )}

            {!isUnsealed && (
              <span className="text-[10px] text-halo-deep font-mono tracking-tight truncate mt-0.5">
                {isDecrypting
                  ? "DECRYPTING TEE..."
                  : `ENCRYPTED (${String(encryptedHandle).slice(0, 6)}...${String(encryptedHandle).slice(-4)})`}
              </span>
            )}
          </div>

          {/* Seal / Unseal Action Pill */}
          <span className="shrink-0 text-[11px] font-mono px-2 py-0.5 rounded bg-mist-800 text-halo-dim border border-mist-700 group-hover:text-halo-soft group-hover:border-mist-600 transition-colors">
            {isUnsealed ? "🔒 Seal" : "🔓 Unseal"}
          </span>
        </button>
      </div>

      {/* Footer Hairline & Note */}
      <div className="mt-4 pt-3 border-t border-mist-700 text-[11px] font-mono text-halo-deep">
        {footnote}
      </div>
    </div>
  );
};
