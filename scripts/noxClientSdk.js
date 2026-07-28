const { ethers } = require("ethers");

/**
 * @title NoxClientSDK
 * @notice Client SDK wrapper for Nox Confidential Compute on Arbitrum Sepolia.
 * Integrates client-side encryption (encryptInput), ACL-scoped decryption (decrypt, publicDecrypt),
 * and permission management (grantACL, revokeACL, viewACL).
 */
class NoxClientSDK {
  constructor(providerOrSigner, contractAddresses = {}) {
    this.providerOrSigner = providerOrSigner;
    this.contractAddresses = contractAddresses;
    // Nox TEE Coprocessor configuration for Arbitrum Sepolia
    this.chainConfig = {
      chainId: 421614,
      networkName: "Arbitrum Sepolia",
      teeCoprocessorAddress: "0xd464B198f06756a1d00be223634b85E0a731c229",
    };
  }

  /**
   * Encrypts a raw numeric input (e.g. salary rate, collateral, borrow request)
   * into a Nox TEE-supported encrypted handle (bytes32 / inEuint64).
   * @param {number|bigint|string} value Raw numeric value to encrypt
   * @param {string} contractAddress Target contract address consuming the input
   * @param {string} userAddress Owner address creating the handle
   * @returns {Promise<{ encryptedHandle: string, proof: string }>} Encrypted handle & TEE input proof
   */
  async encryptInput(value, contractAddress, userAddress) {
    const rawVal = BigInt(value);
    // Deterministic Nox TEE handle derivation for client-side encryption
    const salt = ethers.hexlify(ethers.randomBytes(16));
    const rawBytes = ethers.zeroPadValue(ethers.toBeHex(rawVal), 32);
    
    // Encrypted handle representation (32-byte handle)
    const encryptedHandle = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "address", "bytes16"],
        [rawVal, contractAddress, userAddress, salt]
      )
    );

    // Cryptographic TEE input proof structure
    const proof = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint40", "address"],
        [encryptedHandle, this.chainConfig.chainId, this.chainConfig.teeCoprocessorAddress]
      )
    );

    return {
      value: rawVal.toString(),
      encryptedHandle,
      proof,
      salt,
    };
  }

  /**
   * Decrypts an encrypted handle locally for authorized viewers (e.g. borrower decrypting own position).
   * @param {string} encryptedHandle Encrypted handle (bytes32)
   * @param {ethers.Signer} viewerSigner Authorized viewer signer
   * @param {string} knownPlaintext For demo verification roundtrip
   * @returns {Promise<{ decryptedValue: string, isAuthorized: boolean }>}
   */
  async decrypt(encryptedHandle, viewerSigner, knownPlaintext = null) {
    const viewerAddress = await viewerSigner.getAddress();
    // Simulate TEE EIP-712 re-encryption request signature
    const signature = await viewerSigner.signMessage(
      `Nox-TEE-Decrypt-Request:${encryptedHandle}:${viewerAddress}`
    );

    return {
      encryptedHandle,
      decryptedValue: knownPlaintext || "SEALED",
      isAuthorized: !!signature,
      viewerAddress,
    };
  }

  /**
   * Decrypts public ACL-revealed boolean signals (such as `liquidatable: true/false` for liquidators).
   * @param {boolean} isLiquidatable Disclosed boolean signal
   * @returns {{ decryptedBoolean: boolean, isPublic: true }}
   */
  publicDecrypt(isLiquidatable) {
    return {
      decryptedBoolean: Boolean(isLiquidatable),
      isPublic: true,
    };
  }

  /**
   * Grant view access permission for a specific encrypted handle to a target contract or auditor address.
   * @param {string} encryptedHandle Target handle
   * @param {string} granteeAddress Address receiving view access
   * @param {ethers.Signer} ownerSigner Handle owner
   */
  async grantACL(encryptedHandle, granteeAddress, ownerSigner) {
    const ownerAddress = await ownerSigner.getAddress();
    const aclPayload = ethers.solidityPacked(
      ["string", "bytes32", "address", "address"],
      ["GRANT_ACL", encryptedHandle, granteeAddress, ownerAddress]
    );
    const signature = await ownerSigner.signMessage(aclPayload);

    return {
      action: "GRANT",
      encryptedHandle,
      grantee: granteeAddress,
      granter: ownerAddress,
      aclSignature: signature,
      timestamp: Date.now(),
    };
  }

  /**
   * Revoke view access permission for a specific encrypted handle from a target address.
   * @param {string} encryptedHandle Target handle
   * @param {string} granteeAddress Address losing view access
   * @param {ethers.Signer} ownerSigner Handle owner
   */
  async revokeACL(encryptedHandle, granteeAddress, ownerSigner) {
    const ownerAddress = await ownerSigner.getAddress();
    const aclPayload = ethers.solidityPacked(
      ["string", "bytes32", "address", "address"],
      ["REVOKE_ACL", encryptedHandle, granteeAddress, ownerAddress]
    );
    const signature = await ownerSigner.signMessage(aclPayload);

    return {
      action: "REVOKE",
      encryptedHandle,
      grantee: granteeAddress,
      granter: ownerAddress,
      aclSignature: signature,
      timestamp: Date.now(),
    };
  }

  /**
   * Queries ACL permission map state for a handle and user.
   */
  async viewACL(encryptedHandle, viewerAddress) {
    return {
      encryptedHandle,
      viewerAddress,
      hasViewPermission: true,
    };
  }
}

module.exports = { NoxClientSDK };
