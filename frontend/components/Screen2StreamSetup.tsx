"use client";

import React, { useState } from "react";
import { WaxSealValue } from "./WaxSealValue";
import { noxSdk } from "../lib/noxSdk";

interface Screen2StreamSetupProps {
  userAddress: string;
  onStreamCreated: (streamData: { employer: string; monthlyRate: number; handle: string }) => void;
}

export const Screen2StreamSetup: React.FC<Screen2StreamSetupProps> = ({
  userAddress,
  onStreamCreated,
}) => {
  const [employerAddress, setEmployerAddress] = useState("0x4A817942C5c106A9a3a93F877b0C019c92238472");
  const [monthlySalary, setMonthlySalary] = useState("8000");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [createdHandle, setCreatedHandle] = useState<string | null>(null);

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEncrypting(true);

    try {
      // Execute Nox SDK client-side input encryption
      const res = await noxSdk.encryptInput(
        monthlySalary,
        "0x71C941A58D8eB8dE4663c0B77443E868772aE5c9",
        userAddress
      );
      setCreatedHandle(res.encryptedHandle);
      onStreamCreated({
        employer: employerAddress,
        monthlyRate: parseFloat(monthlySalary),
        handle: res.encryptedHandle,
      });
    } catch (err) {
      console.error("Stream Creation Error:", err);
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2E3D] pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-[#B8933E]">STEP 01 OF 04</span>
            <h2 className="font-serif text-2xl font-bold text-[#F7F5F0]">
              Income Stream Setup
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-[#2E5C57]/30 border border-[#2E5C57] text-[#F7F5F0] text-xs font-mono rounded">
            Sablier/Superfluid Stream
          </span>
        </div>

        <p className="text-xs text-[#8E95A5] mb-6">
          Register your payroll income stream. Monthly earnings are encrypted client-side via Nox SDK into a sealed handle emitted directly to Arbitrum Sepolia.
        </p>

        <form onSubmit={handleCreateStream} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-[#8E95A5] mb-1.5 uppercase">
              Employer Wallet Address
            </label>
            <input
              type="text"
              value={employerAddress}
              onChange={(e) => setEmployerAddress(e.target.value)}
              required
              className="w-full bg-[#12141A] border border-[#2A2E3D] focus:border-[#B8933E] text-[#F7F5F0] font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[#8E95A5] mb-1.5 uppercase">
              Monthly Salary Rate ($ USD)
            </label>
            <input
              type="number"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              required
              min="100"
              className="w-full bg-[#12141A] border border-[#2A2E3D] focus:border-[#B8933E] text-[#F7F5F0] font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none"
            />
          </div>

          {/* Live Sealed Ticker Preview */}
          <div className="p-4 bg-[#12141A] border border-[#2E5C57]/50 rounded-xl">
            <WaxSealValue
              label="Live Sealed Salary Stream Ticker"
              encryptedHandle={createdHandle || "0x9c82f00...a4e1"}
              actualValue={`$${parseFloat(monthlySalary || "0").toLocaleString()}.00 / mo`}
              userAddress={userAddress}
            />
          </div>

          <button
            type="submit"
            disabled={isEncrypting}
            className="w-full py-3 bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-[#B8933E]/10 focus:outline-none focus:ring-2 focus:ring-[#B8933E]"
          >
            {isEncrypting ? "Sealing & Encrypting Handle..." : "Encrypt & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};
