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
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);

  const cleanVal = (val: string) => {
    const matches = val.replace(/,/g, "").match(/[\d.]+/);
    if (!matches) return 0;
    return parseFloat(matches[0]);
  };

  const formatValue = (val: string, template: string) => {
    // If it's not a numeric string (like if it's already formatted), return it
    if (!/^\d+(\.\d+)?$/.test(val)) {
      return val;
    }
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    
    // Check if it's USDC raw value (needs decimal adjustment)
    if (label.toLowerCase().includes("balance") || label.toLowerCase().includes("debt")) {
      if (num > 1000 && !template.includes(num.toString())) {
        const adjusted = num / 1000000;
        return `$${adjusted.toFixed(2)} USD`;
      }
    }
    if (template.includes("/ mo")) {
      return `$${num.toLocaleString()}.00 / mo`;
    }
    return `$${num.toLocaleString()}.00 USD`;
  };

  const handleToggleSeal = async () => {
    if (isUnsealed) {
      setIsUnsealed(false);
      setDecryptedValue(null);
      return;
    }

    setIsDecrypting(true);
    try {
      // Execute Nox SDK client-side local EIP-712 decryption
      const res = await noxSdk.decrypt(encryptedHandle, userAddress, actualValue);
      if (res.isAuthorized) {
        const rawDecrypted = res.decryptedValue;
        const formattedDecrypted = formatValue(rawDecrypted, actualValue);

        // Numeric comparison for mismatch checks
        const decryptedNum = cleanVal(rawDecrypted);
        const actualNum = cleanVal(actualValue);
        const adjustedDecryptedNum = (label.toLowerCase().includes("balance") || label.toLowerCase().includes("debt")) && rawDecrypted !== actualValue && parseFloat(rawDecrypted) > 1000
          ? parseFloat(rawDecrypted) / 1000000
          : decryptedNum;

        const isMatch = Math.abs(adjustedDecryptedNum - actualNum) < 0.0001;

        console.log(`[WaxSealValue] Decryption verified for "${label}":`);
        console.log(" - Raw Encrypted Handle:", encryptedHandle);
        console.log(" - Decrypted Result (Raw):", rawDecrypted);
        console.log(" - Decrypted Result (Numeric):", adjustedDecryptedNum);
        console.log(" - Plaintext value:", actualValue);
        console.log(" - Plaintext value (Numeric):", actualNum);
        console.log(" - Did TEE decrypted value match plaintext?", isMatch);

        setDecryptedValue(formattedDecrypted);
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

  const rawDecrypted = decryptedValue || actualValue;
  const decryptedNum = cleanVal(rawDecrypted);
  const actualNum = cleanVal(actualValue);
  const adjustedDecryptedNum = (label.toLowerCase().includes("balance") || label.toLowerCase().includes("debt")) && rawDecrypted !== actualValue && parseFloat(rawDecrypted) > 1000
    ? parseFloat(rawDecrypted) / 1000000
    : decryptedNum;
  
  const hasMismatch = decryptedValue !== null && Math.abs(adjustedDecryptedNum - actualNum) > 0.0001;

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
              value={hasMismatch ? rawDecrypted : actualValue}
              revealed={isUnsealed}
              className={`font-mono font-bold ${
                size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg"
              } ${isUnsealed ? "text-halo-soft" : "text-patina-300"}`}
            />
            {isUnsealed && hasMismatch && (
              <span className="text-[10px] text-danger font-mono tracking-tight leading-relaxed mt-1 block">
                Decrypted (confidential): {rawDecrypted}
                <br />
                On-chain (plaintext): {actualValue} — decrypted value may take a moment to catch up after a transaction
              </span>
            )}
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
