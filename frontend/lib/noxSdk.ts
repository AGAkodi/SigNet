import { ethers } from "ethers";

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
  encryptedHandle: string;
  proof: string;
  salt: string;
  isStubbed: boolean;
}

export interface DecryptResult {
  encryptedHandle: string;
  decryptedValue: string;
  isAuthorized: boolean;
  viewerAddress: string;
  isStubbed: boolean;
}

export interface PublicDecryptResult {
  decryptedBoolean: boolean;
  isPublic: boolean;
}

export class NoxFrontendSDK {
  // Arbitrum Sepolia: 0xd464B198f06756a1d00be223634b85E0a731c229 | Local 31337: 0x39847AeBa923Cc7367d4684194091D022B3F8548
  private noxComputeAddress = "0x39847AeBa923Cc7367d4684194091D022B3F8548";
  private handleStore = new Map<string, string>();

  /**
   * Client-side cryptographic handle generation.
   * Calls real Nox KMS Gateway (https://gateway-testnets.noxprotocol.dev) via @iexec-nox/handle SDK
   * to get real 137-byte TEE input proofs verifiable by on-chain Nox protocol smart contracts.
   */
  async encryptInput(
    value: number | bigint | string,
    contractAddress: string,
    userAddress: string,
    signer?: ethers.Signer
  ): Promise<EncryptedInputResult> {
    const rawVal = BigInt(value);

    if (signer) {
      try {
        const { createEthersHandleClient } = await import("@iexec-nox/handle");
        const handleClient = await createEthersHandleClient(signer as any);
        const { handle, handleProof } = await handleClient.encryptInput(
          rawVal,
          "uint256",
          contractAddress
        );
        this.handleStore.set(handle.toLowerCase(), rawVal.toString());

        return {
          value: rawVal.toString(),
          encryptedHandle: handle,
          proof: handleProof,
          salt: "0x00",
          isStubbed: false, // Live iExec Nox TEE KMS Gateway Proof
        };
      } catch (err) {
        console.warn("Live Nox Gateway request failed, using cryptographic fallback:", err);
      }
    }

    const salt = ethers.hexlify(ethers.randomBytes(32));
    const encryptedHandle = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "bytes32", "address", "string"],
        [rawVal, salt, userAddress, "NOX_TEE_SALARY_HANDLE_V1"]
      )
    );

    const proof = ethers.hexlify(ethers.randomBytes(65));
    this.handleStore.set(encryptedHandle.toLowerCase(), rawVal.toString());

    return {
      value: rawVal.toString(),
      encryptedHandle,
      proof,
      salt,
      isStubbed: true,
    };
  }

  /**
   * Local handle decryption for authorized viewer.
   */
  async decrypt(
    encryptedHandle: string,
    viewerAddress: string,
    knownValue?: string
  ): Promise<DecryptResult> {
    const storedVal = this.handleStore.get(encryptedHandle.toLowerCase());
    return {
      encryptedHandle,
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
    encryptedHandle: string,
    granteeAddress: string,
    signer?: ethers.Signer
  ) {
    if (signer) {
      const noxComputeContract = new ethers.Contract(
        this.noxComputeAddress,
        NOX_COMPUTE_ABI,
        signer
      );
      const tx = await noxComputeContract.allow(encryptedHandle, granteeAddress);
      await tx.wait();
      return {
        action: "GRANT",
        encryptedHandle,
        grantee: granteeAddress,
        txHash: tx.hash,
        isRealOnChainCall: true,
      };
    }

    return {
      action: "GRANT",
      encryptedHandle,
      grantee: granteeAddress,
      timestamp: Date.now(),
      isRealOnChainCall: false,
    };
  }

  /**
   * Executes real on-chain ACL permission revoke against NoxCompute `disallowTransient(bytes32,address)`
   */
  async revokeACL(
    encryptedHandle: string,
    granteeAddress: string,
    signer?: ethers.Signer
  ) {
    if (signer) {
      const noxComputeContract = new ethers.Contract(
        this.noxComputeAddress,
        NOX_COMPUTE_ABI,
        signer
      );
      const tx = await noxComputeContract.disallowTransient(encryptedHandle, granteeAddress);
      await tx.wait();
      return {
        action: "REVOKE",
        encryptedHandle,
        grantee: granteeAddress,
        txHash: tx.hash,
        isRealOnChainCall: true,
      };
    }

    return {
      action: "REVOKE",
      encryptedHandle,
      grantee: granteeAddress,
      timestamp: Date.now(),
      isRealOnChainCall: false,
    };
  }
}

export const noxSdk = new NoxFrontendSDK();
