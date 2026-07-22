import { ethers } = require("ethers");

/**
 * Nox Client SDK for frontend interaction
 */
export interface EncryptedInputResult {
  value: string;
  encryptedHandle: string;
  proof: string;
  salt: string;
}

export interface DecryptResult {
  encryptedHandle: string;
  decryptedValue: string;
  isAuthorized: boolean;
  viewerAddress: string;
}

export interface PublicDecryptResult {
  decryptedBoolean: boolean;
  isPublic: boolean;
}

export class NoxFrontendSDK {
  private chainId = 421614;

  async encryptInput(
    value: number | bigint | string,
    contractAddress: string,
    userAddress: string
  ): Promise<EncryptedInputResult> {
    const rawVal = BigInt(value);
    const salt = ethers.hexlify(ethers.randomBytes(16));
    
    const encryptedHandle = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "address", "bytes16"],
        [rawVal, contractAddress, userAddress, salt]
      )
    );

    const proof = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint40", "address"],
        [encryptedHandle, this.chainId, "0x1ExEC000000000000000000000000000000000FF"]
      )
    );

    return {
      value: rawVal.toString(),
      encryptedHandle,
      proof,
      salt,
    };
  }

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
    };
  }

  publicDecrypt(isLiquidatable: boolean): PublicDecryptResult {
    return {
      decryptedBoolean: Boolean(isLiquidatable),
      isPublic: true,
    };
  }

  async grantACL(encryptedHandle: string, granteeAddress: string, granterAddress: string) {
    return {
      action: "GRANT",
      encryptedHandle,
      grantee: granteeAddress,
      granter: granterAddress,
      timestamp: Date.now(),
    };
  }

  async revokeACL(encryptedHandle: string, granteeAddress: string, granterAddress: string) {
    return {
      action: "REVOKE",
      encryptedHandle,
      grantee: granteeAddress,
      granter: granterAddress,
      timestamp: Date.now(),
    };
  }
}

export const noxSdk = new NoxFrontendSDK();
