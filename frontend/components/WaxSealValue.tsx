"use client";

import React, { useState } from "react";
import { noxSdk } from "../lib/noxSdk";
import { ScrambleNumber } from "./ScrambleNumber";

interface WaxSealValueProps {
  label: string;
  encryptedHandle: string;
  actualValue: string;
  userAddress?: string;
  size?: "sm" | "md" | "lg";
}

export const WaxSealValue: React.FC<WaxSealValueProps> = ({
  label,
  encryptedHandle,
  actualValue,
  userAddress = "0xUser...",
  size = "md",
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
      // Execute Nox SDK client-side local EIP-712 decryption
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggleSeal();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-halo-dim font-mono">
        {label}
      </span>

      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleSeal}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label={`${isUnsealed ? "Seal" : "Unseal"} ${label}`}
          className={`group flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg border transition-all text-left focus:outline-none focus:ring-1 focus:ring-patina-400 ${
            isUnsealed
              ? "bg-mist-900 border-patina-400/50 hover:border-patina-400 text-halo-soft"
              : "bg-mist-900/90 border-mist-700 hover:border-patina-400/80 text-halo-DEFAULT"
          }`}
        >
          {/* Status Cipher Indicator Dot */}
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isUnsealed ? "bg-patina-400 shadow-[0_0_6px_#BFA24C]" : "bg-mist-500 group-hover:bg-patina-400"
            }`}
          />

          {/* Living Cipher Scramble Number */}
          <div className="flex flex-col">
            <ScrambleNumber
              value={actualValue}
              revealed={isUnsealed}
              className={`font-mono font-bold ${
                size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg"
              } ${isUnsealed ? "text-halo-soft" : "text-patina-300"}`}
            />
            {!isUnsealed && (
              <span className="text-[10px] text-halo-deep font-mono tracking-tight">
                {isDecrypting ? "DECRYPTING TEE..." : `ENCRYPTED (${String(encryptedHandle).slice(0, 6)}...${String(encryptedHandle).slice(-4)})`}
              </span>
            )}
          </div>

          {/* Seal / Unseal Action Label */}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-mist-800 text-halo-dim border border-mist-700 group-hover:text-halo-soft group-hover:border-mist-600 transition-colors ml-2">
            {isUnsealed ? "🔒 Seal" : "🔓 Unseal"}
          </span>
        </button>
      </div>
    </div>
  );
};
