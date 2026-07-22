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

  /**
   * Client-side handle preparation.
   * NOTE / TODO: Off-chain ECIES encryption of input handles via Nox KMS gateway SDK (nox-handle-sdk)
   * requires live gateway KMS public key exchange. In local offline dev mode, we convert plaintext to
   * public Nox handle bytes32 format (matching Nox.toEuint256 on-chain wrapper).
   */
  async encryptInput(
    value: number | bigint | string,
    contractAddress: string,
    userAddress: string
  ): Promise<EncryptedInputResult> {
    const rawVal = BigInt(value);
    const salt = ethers.hexlify(ethers.randomBytes(16));

    // Convert to 32-byte handle matching Nox public handle representation
    const encryptedHandle = ethers.zeroPadValue(ethers.toBeHex(rawVal), 32);
    const proof = ethers.hexlify(ethers.randomBytes(65)); // 65-byte mock EIP-712 proof

    return {
      value: rawVal.toString(),
      encryptedHandle,
      proof,
      salt,
      isStubbed: true, // Clearly flagged: off-chain KMS ECIES encryption stubbed locally
    };
  }

  /**
   * Local handle decryption.
   * NOTE / TODO: Real client decryption requires requesting a gateway decryption proof signed by the KMS gateway
   * (`validateDecryptionProof`). In local offline mode without live KMS gateway, local decryption echoes known plaintext.
   */
  async decrypt(
    encryptedHandle: string,
    viewerAddress: string,
    knownValue?: string
  ): Promise<DecryptResult> {
    return {
      encryptedHandle,
      decryptedValue: knownValue || "SEALED",
      isAuthorized: true,
      viewerAddress,
      isStubbed: true, // Clearly flagged: off-chain KMS proof signature decryption stubbed locally
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
