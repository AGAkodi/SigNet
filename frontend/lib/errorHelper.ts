import { usePublicClient } from 'wagmi';
import { ContractFunctionRevertedError } from 'viem';

export interface BufferedFees {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

// 10 Gwei max fee safety clamp as a secondary backstop
const MAX_SANE_FEE_PER_GAS = 10000000000n;

export function useBufferedFees() {
  const publicClient = usePublicClient();

  const getBufferedFeeData = async (): Promise<any> => {
    try {
      if (!publicClient) return {};
      const fees = await publicClient.estimateFeesPerGas();
      if (!fees) return {};

      // If maxFeePerGas is missing/undefined, we fall back to buffered legacy gasPrice
      if (fees.maxFeePerGas === undefined || fees.maxFeePerGas === null) {
        if (fees.gasPrice !== undefined && fees.gasPrice !== null) {
          let legacyGas = (fees.gasPrice * 120n) / 100n;
          if (legacyGas > MAX_SANE_FEE_PER_GAS) {
            legacyGas = MAX_SANE_FEE_PER_GAS;
          }
          return {
            gasPrice: legacyGas,
          };
        }
        return {};
      }

      const result: BufferedFees = {};
      
      let maxFee = (fees.maxFeePerGas * 120n) / 100n;
      if (maxFee > MAX_SANE_FEE_PER_GAS) {
        maxFee = MAX_SANE_FEE_PER_GAS;
      }
      result.maxFeePerGas = maxFee;
      
      let maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      if (maxPriorityFeePerGas === undefined || maxPriorityFeePerGas === null) {
        try {
          maxPriorityFeePerGas = await publicClient.estimateMaxPriorityFeePerGas();
        } catch {
          maxPriorityFeePerGas = 0n;
        }
      }

      // Enforce a safe minimum for maxPriorityFeePerGas (1 Mwei / 0.001 Gwei)
      // to prevent MetaMask Mobile from interpreting 0 as zero gas and breaking its UI.
      if (maxPriorityFeePerGas === 0n) {
        maxPriorityFeePerGas = 1000000n;
      }

      const bufferedPriority = (maxPriorityFeePerGas * 120n) / 100n;
      // Ensure maxPriorityFeePerGas is never higher than maxFeePerGas
      result.maxPriorityFeePerGas = bufferedPriority > result.maxFeePerGas
        ? result.maxFeePerGas
        : bufferedPriority;

      return result;
    } catch (err) {
      console.warn("Failed to estimate fees per gas with buffer, letting wallet estimate instead:", err);
      return {};
    }
  };

  return { getBufferedFeeData };
}

export function parseTxError(error: any): string {
  if (!error) return "Contract call failed.";
  
  // Console log the raw error for developer diagnostics
  console.log("Parsing transaction / simulation error:", error);

  let revertReason = "";

  // 1. Walk the error to find ContractFunctionRevertedError or similar custom error structures
  if (error.walk) {
    // Try to find if it has errorName (custom Solidity error)
    const customErrorNode = error.walk((err: any) => err.data && typeof err.data === 'object' && err.data.errorName);
    if (customErrorNode && customErrorNode.data) {
      revertReason = customErrorNode.data.errorName;
    }
  }

  // 2. Try to find ContractFunctionRevertedError specifically using viem's walkthrough
  if (!revertReason && error.walk) {
    const walked = error.walk();
    if (walked && walked.message) {
      // Find standard reverted message: "reverted with the following reason:\n..."
      const match = walked.message.match(/reverted with the following reason:\s*([\s\S]+?)(?:\n\n|\nVersion|$)/i);
      if (match && match[1]) {
        revertReason = match[1].trim();
      }
    }
  }

  // 3. Regex check on top-level error messages
  if (!revertReason) {
    const message = error.message || "";
    const match = message.match(/reverted with the following reason:\s*([\s\S]+?)(?:\n\n|\nVersion|$)/i);
    if (match && match[1]) {
      revertReason = match[1].trim();
    }
  }

  // 4. Check nested cause messages
  if (!revertReason && error.cause) {
    const causeMsg = error.cause.message || "";
    const match = causeMsg.match(/reverted with the following reason:\s*([\s\S]+?)(?:\n\n|\nVersion|$)/i);
    if (match && match[1]) {
      revertReason = match[1].trim();
    }
  }

  // 5. Fallback to shortMessage or message
  if (!revertReason) {
    revertReason = error.shortMessage || error.message || "Contract call failed.";
  }

  // Clean prefix if "execution reverted:" is prepended
  if (revertReason.includes("execution reverted:")) {
    revertReason = revertReason.replace("execution reverted:", "").trim();
  }

  // 6. Handle Aave / unknown custom error hex selectors (e.g. 0x3e1d1a10)
  // Check if revertReason contains a 4-byte custom error selector (starts with 0x and is 8 hex chars long)
  const hexSelectorMatch = revertReason.match(/(0x[a-fA-F0-9]{8})/);
  if (hexSelectorMatch) {
    const selector = hexSelectorMatch[1].toLowerCase();
    
    // Check common Aave V3 selectors for a better user-facing message
    if (selector === "0x3e1d1a10" || selector === "0x5c0b115b") {
      return "Transaction would fail: Health factor too low / Insufficient collateral on Aave";
    } else if (selector === "0x1f0d3a5a") {
      return "Transaction would fail: Borrowing not enabled for asset on Aave";
    }
    
    return `Contract reverted with unrecognized error ${selector} — check 4byte.directory or the source ABI`;
  }

  // Intercept typical RPC errors related to gas fee limits and fluctuations
  const lowercaseReason = revertReason.toLowerCase();
  if (
    lowercaseReason.includes("max fee per gas less than block base fee") ||
    lowercaseReason.includes("maxfeepergas less than block base fee") ||
    lowercaseReason.includes("fee too low") ||
    lowercaseReason.includes("base fee") ||
    lowercaseReason.includes("underpriced") ||
    lowercaseReason.includes("gas price")
  ) {
    return "Network fee changed, please try again";
  }
  
  if (lowercaseReason.includes("user rejected") || lowercaseReason.includes("user denied")) {
    return "Transaction signature rejected by user.";
  }

  return revertReason;
}
