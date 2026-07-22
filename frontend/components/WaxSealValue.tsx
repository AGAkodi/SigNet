"use client";

import React, { useState } from "react";
import { noxSdk } from "../lib/noxSdk";

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
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[#8E95A5] font-mono">
        {label}
      </span>

      <div className="flex items-center gap-3">
        {isUnsealed ? (
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl font-semibold text-[#F7F5F0]">
              {actualValue}
            </span>
            <button
              onClick={handleToggleSeal}
              onKeyDown={handleKeyDown}
              tabIndex={0}
              title="Click to Seal"
              className="text-xs font-mono px-2 py-1 bg-[#1A1D26] hover:bg-[#2A2E3D] border border-[#B8933E]/40 text-[#B8933E] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#B8933E]"
            >
              🔒 Seal Value
            </button>
          </div>
        ) : (
          <button
            onClick={handleToggleSeal}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label={`Unseal ${label}`}
            className="wax-seal-badge focus:outline-none focus:ring-2 focus:ring-[#B8933E]"
          >
            <span className="wax-seal-icon" />
            <span>
              {isDecrypting ? "Decrypting TEE..." : "SEALED"}
            </span>
            <span className="text-[11px] text-[#8E95A5] font-mono">
              ({encryptedHandle.slice(0, 6)}...{encryptedHandle.slice(-4)})
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
