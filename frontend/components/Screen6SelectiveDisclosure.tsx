"use client";

import React, { useState } from "react";
import { noxSdk } from "../lib/noxSdk";

interface AccessGrant {
  id: string;
  auditorAddress: string;
  field: string;
  grantedAt: string;
}

interface Screen6SelectiveDisclosureProps {
  userAddress: string;
  streamHandle: string;
}

export const Screen6SelectiveDisclosure: React.FC<Screen6SelectiveDisclosureProps> = ({
  userAddress,
  streamHandle,
}) => {
  const [auditorAddress, setAuditorAddress] = useState("0x8F9123b37A2027eE4627E5F90e66E15B17457C99");
  const [grants, setGrants] = useState<AccessGrant[]>([
    {
      id: "grant-1",
      auditorAddress: "0x8F9123b37A2027eE4627E5F90e66E15B17457C99",
      field: "Monthly Salary Income",
      grantedAt: "2026-07-22 14:30 UTC",
    },
  ]);
  const [isGranting, setIsGranting] = useState(false);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditorAddress) return;

    setIsGranting(true);
    try {
      // Execute Nox SDK grantACL permission call
      await noxSdk.grantACL(streamHandle, auditorAddress, userAddress);
      const newGrant: AccessGrant = {
        id: `grant-${Date.now()}`,
        auditorAddress,
        field: "Monthly Salary Income",
        grantedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      };
      setGrants((prev) => [...prev, newGrant]);
    } catch (err) {
      console.error("Grant ACL Error:", err);
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeAccess = async (grantId: string, grantee: string) => {
    try {
      // Execute Nox SDK revokeACL permission call
      await noxSdk.revokeACL(streamHandle, grantee, userAddress);
      setGrants((prev) => prev.filter((g) => g.id !== grantId));
    } catch (err) {
      console.error("Revoke ACL Error:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="bg-[#1A1D26] border border-[#2A2E3D] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2E3D] pb-4 mb-6">
          <div>
            <span className="text-xs font-mono text-[#B8933E]">AUDIT & COMPLIANCE</span>
            <h2 className="font-serif text-2xl font-bold text-[#F7F5F0]">
              Selective Disclosure Panel
            </h2>
          </div>
          <span className="px-2.5 py-1 bg-[#2E5C57]/30 border border-[#2E5C57] text-[#F7F5F0] text-xs font-mono rounded">
            Nox ACL Management
          </span>
        </div>

        <p className="text-xs text-[#8E95A5] mb-6">
          Grant specific third parties (e.g. institutional auditors or landlords) time-boxed, ACL-scoped view permissions to decrypt specific sealed values. You retain full control to revoke access at any time.
        </p>

        {/* Grant Access Form */}
        <form onSubmit={handleGrantAccess} className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-mono text-[#8E95A5] mb-1.5 uppercase">
              Auditor / Third-Party Wallet Address
            </label>
            <input
              type="text"
              value={auditorAddress}
              onChange={(e) => setAuditorAddress(e.target.value)}
              required
              className="w-full bg-[#12141A] border border-[#2A2E3D] focus:border-[#B8933E] text-[#F7F5F0] font-mono text-sm px-3.5 py-2.5 rounded-lg focus:outline-none"
            />
          </div>

          <div className="p-3.5 bg-[#12141A] border border-[#2A2E3D] rounded-lg text-xs text-[#8E95A5] font-sans">
            "You're giving <code className="text-[#B8933E] font-mono">{auditorAddress.slice(0, 10)}...</code> permission to view your <span className="text-[#F7F5F0] font-semibold">Monthly Salary Income</span>. You can revoke this anytime."
          </div>

          <button
            type="submit"
            disabled={isGranting}
            className="w-full py-3 bg-[#B8933E] hover:bg-[#a07f33] text-[#12141A] font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-[#B8933E]/10"
          >
            {isGranting ? "Granting TEE ACL Permission..." : "Grant Time-Boxed View Access"}
          </button>
        </form>

        {/* Active Access List */}
        <div>
          <h3 className="font-serif text-lg font-semibold text-[#F7F5F0] mb-4">
            Active Selective Disclosures
          </h3>

          {grants.length === 0 ? (
            <div className="p-4 bg-[#12141A] border border-[#2A2E3D] rounded-lg text-center text-xs text-[#8E95A5] font-mono">
              No active third-party disclosures granted.
            </div>
          ) : (
            <div className="space-y-3">
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  className="p-4 bg-[#12141A] border border-[#2E5C57]/50 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-mono text-[#F7F5F0] block font-semibold">
                      {grant.auditorAddress}
                    </span>
                    <span className="text-[11px] text-[#8E95A5] font-mono">
                      Target: {grant.field} • Granted: {grant.grantedAt}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevokeAccess(grant.id, grant.auditorAddress)}
                    className="px-3 py-1.5 bg-[#B84A3E]/20 hover:bg-[#B84A3E] border border-[#B84A3E] text-[#B84A3E] hover:text-white font-mono text-xs rounded transition-colors"
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
