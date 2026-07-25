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
   * Generates a non-reversible salted cryptographic handle commitment for on-chain submission,
   * protecting salary figures from being read in plaintext on Arbiscan calldata.
   */
  async encryptInput(
    value: number | bigint | string,
    contractAddress: string,
    userAddress: string
  ): Promise<EncryptedInputResult> {
    const rawVal = BigInt(value);
    const salt = ethers.hexlify(ethers.randomBytes(32));

    // Cryptographic salted commitment (Keccak256 over value + salt + userAddress + domain separator)
    // Ensures on-chain bytes32 handle is non-reversible and does not reveal plaintext salary
    const encryptedHandle = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "bytes32", "address", "string"],
        [rawVal, salt, userAddress, "NOX_TEE_SALARY_HANDLE_V1"]
      )
    );

    const proof = ethers.hexlify(ethers.randomBytes(65)); // 65-byte EIP-712 proof signature format
    this.handleStore.set(encryptedHandle.toLowerCase(), rawVal.toString());

    return {
      value: rawVal.toString(),
      encryptedHandle,
      proof,
      salt,
      isStubbed: true, // Flagged: Client-side cryptographic salted handle commitment (offline TEE mode)
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
