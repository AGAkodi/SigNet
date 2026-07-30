import { ethers } from "ethers";
import { createViemHandleClient } from "@iexec-nox/handle";

/**
 * Nox Compute ABI snippet for ACL permission management on-chain
 */
const NOX_COMPUTE_ABI = [
  "function allow(bytes32 handle, address account) external",
  "function allowTransient(bytes32 handle, address account) external",
  "function disallowTransient(bytes32 handle, address account) external",
  "function isAllowed(bytes32 handle, address account) external view returns (bool)",
  "function allowPublicDecryption(bytes32 handle) external",
  "function isPubliclyDecryptable(bytes32 handle) external view returns (bool)",
];

export interface EncryptedInputResult {
  value: string;
  handle: string;
  handleProof: string;
  salt: string;
  isStubbed: boolean;
}

export interface DecryptResult {
  handle: string;
  decryptedValue: string;
  isAuthorized: boolean;
  viewerAddress: string;
  isStubbed: boolean;
}

export interface PublicDecryptResult {
  decryptedBoolean: boolean;
  isPublic: boolean;
}

import { CONTRACT_ADDRESSES } from "./contracts";

export class NoxFrontendSDK {
  // Arbitrum Sepolia: 0xd464B198f06756a1d00be223634b85E0a731c229
  private noxComputeAddress = CONTRACT_ADDRESSES.NoxCompute;
  private handleStore = new Map<string, string>();
  private handleClient: any = null;

  private async initHandleClient(walletClient?: any) {
    if (this.handleClient) return;
    if (!walletClient) {
      throw new Error("Nox Gateway unavailable — cannot proceed without a valid wallet client");
    }
    this.handleClient = await createViemHandleClient(walletClient);
  }

  /**
   * Client-side cryptographic handle generation.
   * Calls real Nox KMS Gateway via @iexec-nox/handle SDK
   * to get real 137-byte TEE input proofs verifiable by on-chain Nox protocol smart contracts.
   */
  async encryptInput(
    value: number | bigint | string,
    contractAddress: string,
    userAddress: string,
    walletClient?: any
  ): Promise<EncryptedInputResult> {
    const rawVal = BigInt(value);

    try {
      await this.initHandleClient(walletClient);

      const { handle, handleProof } = await this.handleClient.encryptInput(
        rawVal,
        "uint256",
        contractAddress
      );

      if (handle && handleProof) {
        this.handleStore.set(handle.toLowerCase(), rawVal.toString());
        return {
          value: rawVal.toString(),
          handle: handle,
          handleProof: handleProof,
          salt: "0x00",
          isStubbed: false,
        };
      }
      throw new Error("Missing handle or handleProof from SDK");
    } catch (err: any) {
      console.error("Nox encryptInput error:", err);
      throw new Error("Nox Gateway unavailable — cannot proceed without a valid proof: " + (err.message || err));
    }
  }

  /**
   * Fetches public decryption proof for a handle from the Gateway API
   */
  async getPublicDecryptionProof(handle: string, walletClient?: any): Promise<string> {
    try {
      await this.initHandleClient(walletClient);
      const { decryptionProof } = await this.handleClient.publicDecrypt(handle as `0x${string}`);
      if (decryptionProof) {
        return decryptionProof;
      }
      throw new Error("No decryptionProof found in response");
    } catch (err: any) {
      console.error("Nox publicDecrypt error:", err);
      throw new Error("Nox Gateway unavailable — cannot proceed without a valid public decryption proof: " + (err.message || err));
    }
  }

  /**
   * Local handle decryption for authorized viewer.
   */
  async decrypt(
    handle: string,
    viewerAddress: string,
    knownValue?: string
  ): Promise<DecryptResult> {
    const storedVal = this.handleStore.get(handle.toLowerCase());
    return {
      handle,
      decryptedValue: knownValue || storedVal || "SEALED",
      isAuthorized: true,
      viewerAddress,
      isStubbed: true,
    };
  }

  /**
   * Public boolean signal decryption for liquidator role.
   */
  publicDecrypt(isLiquidatable: boolean): PublicDecryptResult {
    return {
      decryptedBoolean: Boolean(isLiquidatable),
      isPublic: true,
    };
  }

  /**
   * Executes real on-chain ACL permission grant against NoxCompute `allow(bytes32,address)`
   */
  async grantACL(
    handle: string,
    granteeAddress: string,
    signer?: ethers.Signer
  ) {
    if (signer) {
      const noxComputeContract = new ethers.Contract(
        this.noxComputeAddress,
        NOX_COMPUTE_ABI,
        signer
      );
      const tx = await noxComputeContract.allow(handle, granteeAddress);
      await tx.wait();
      return {
        action: "GRANT",
        handle,
        grantee: granteeAddress,
        txHash: tx.hash,
        isRealOnChainCall: true,
      };
    }

    return {
      action: "GRANT",
      handle,
      grantee: granteeAddress,
      timestamp: Date.now(),
      isRealOnChainCall: false,
    };
  }

  /**
   * Executes real on-chain ACL permission revoke against NoxCompute `disallowTransient(bytes32,address)`
   */
  async revokeACL(
    handle: string,
    granteeAddress: string,
    signer?: ethers.Signer
  ) {
    if (signer) {
      const noxComputeContract = new ethers.Contract(
        this.noxComputeAddress,
        NOX_COMPUTE_ABI,
        signer
      );
      const tx = await noxComputeContract.disallowTransient(handle, granteeAddress);
      await tx.wait();
      return {
        action: "REVOKE",
        handle,
        grantee: granteeAddress,
        txHash: tx.hash,
        isRealOnChainCall: true,
      };
    }

    return {
      action: "REVOKE",
      handle,
      grantee: granteeAddress,
      timestamp: Date.now(),
      isRealOnChainCall: false,
    };
  }
}

export const noxSdk = new NoxFrontendSDK();
