import { usePublicClient } from 'wagmi';
import { ContractFunctionRevertedError, decodeErrorResult } from 'viem';

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

export function extractHexSelector(error: any): string | null {
  if (!error) return null;

  // Helper to validate and extract a 4-byte selector from a hex string
  const getSelectorFromHex = (hex: any): string | null => {
    if (typeof hex !== 'string') return null;
    const trimmed = hex.trim().toLowerCase();
    if (trimmed.startsWith('0x') && trimmed.length >= 10) {
      // Avoid matching addresses (42 chars) or tx hashes (66 chars)
      if (trimmed.length !== 42 && trimmed.length !== 66) {
        return trimmed.slice(0, 10);
      }
    }
    return null;
  };

  // 1. Walk the error tree to inspect data fields
  if (error.walk) {
    let selectorFromWalk: string | null = null;
    error.walk((err: any) => {
      if (err) {
        // Check data property
        let sel = getSelectorFromHex(err.data);
        if (sel) {
          selectorFromWalk = sel;
          return true; // Stop walking
        }
        // Check nested error.data
        if (err.error) {
          sel = getSelectorFromHex(err.error.data);
          if (sel) {
            selectorFromWalk = sel;
            return true;
          }
        }
        // Check nested cause.data
        if (err.cause) {
          sel = getSelectorFromHex(err.cause.data);
          if (sel) {
            selectorFromWalk = sel;
            return true;
          }
        }
      }
      return false;
    });
    if (selectorFromWalk) return selectorFromWalk;
  }

  // 2. Direct property lookups (in case walk didn't find it or isn't available)
  let directSel = getSelectorFromHex(error.data) || 
                  getSelectorFromHex(error.error?.data) || 
                  getSelectorFromHex(error.cause?.data) ||
                  getSelectorFromHex(error.info?.error?.data);
  if (directSel) return directSel;

  // 3. Search text messages for standalone 4-byte hex selectors (using word boundary)
  const messages = [
    error.message,
    error.shortMessage,
    error.cause?.message,
  ];
  for (const msg of messages) {
    if (typeof msg === 'string') {
      const match = msg.match(/\b(0x[a-fA-F0-9]{8})\b/i);
      if (match) {
        return match[1].toLowerCase();
      }
    }
  }

  return null;
}

export function parseTxError(error: any): string {
  if (!error) return "Contract call failed.";
  
  // Console log the raw error for developer diagnostics
  console.log("Parsing transaction / simulation error:", error);

  // 1. Detect 4-byte hex error selectors (e.g. from Aave V3 or unrecognized)
  const selector = extractHexSelector(error);
  if (selector) {
    const lowerSel = selector.toLowerCase();
    
    // Check common Aave V3 selectors for a better user-facing message
    if (lowerSel === "0x3e1d1a10" || lowerSel === "0x5c0b115b") {
      return "Transaction would fail: Health factor too low / Insufficient collateral on Aave";
    } else if (lowerSel === "0x1f0d3a5a") {
      return "Transaction would fail: Borrowing not enabled for asset on Aave";
    } else if (lowerSel === "0x08c379a0") {
      const getFullHexData = (err: any): string | null => {
        if (!err) return null;
        const inspectStr = (val: any): string | null => {
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.toLowerCase().startsWith('0x08c379a0')) {
              return trimmed;
            }
          }
          return null;
        };
        let found = inspectStr(err.data) || inspectStr(err.error?.data) || inspectStr(err.cause?.data) || inspectStr(err.info?.error?.data);
        if (found) return found;
        if (err.walk) {
          let foundInWalk: string | null = null;
          err.walk((e: any) => {
            if (e) {
              let f = inspectStr(e.data) || inspectStr(e.error?.data) || inspectStr(e.cause?.data);
              if (f) {
                foundInWalk = f;
                return true;
              }
            }
            return false;
          });
          if (foundInWalk) return foundInWalk;
        }
        const messages = [err.message, err.shortMessage, err.cause?.message];
        for (const msg of messages) {
          if (typeof msg === 'string') {
            const match = msg.match(/(0x08c379a0[a-fA-F0-9]*)/i);
            if (match) {
              return match[1];
            }
          }
        }
        return null;
      };

      const fullHex = getFullHexData(error);
      if (fullHex) {
        try {
          const decoded = decodeErrorResult({
            abi: [{
              type: 'error',
              name: 'Error',
              inputs: [{ name: 'message', type: 'string' }],
            }],
            data: fullHex as `0x${string}`,
          });
          if (decoded.args && decoded.args[0]) {
            return decoded.args[0] as string;
          }
        } catch (e) {
          console.warn("Failed to decode standard Error(string) hex:", e);
        }
      }
    }
    
    return `Contract reverted with unrecognized error ${lowerSel} — check 4byte.directory or the source ABI`;
  }

  let revertReason = "";

  // 2. Walk the error to find ContractFunctionRevertedError or similar custom error structures
  if (error.walk) {
    // Try to find if it has errorName (custom Solidity error)
    const customErrorNode = error.walk((err: any) => err.data && typeof err.data === 'object' && err.data.errorName);
    if (customErrorNode && customErrorNode.data) {
      revertReason = customErrorNode.data.errorName;
    }
  }

  // 3. Try to find ContractFunctionRevertedError specifically using viem's walkthrough
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

  // 4. Regex check on top-level error messages
  if (!revertReason) {
    const message = error.message || "";
    const match = message.match(/reverted with the following reason:\s*([\s\S]+?)(?:\n\n|\nVersion|$)/i);
    if (match && match[1]) {
      revertReason = match[1].trim();
    }
  }

  // 5. Check nested cause messages
  if (!revertReason && error.cause) {
    const causeMsg = error.cause.message || "";
    const match = causeMsg.match(/reverted with the following reason:\s*([\s\S]+?)(?:\n\n|\nVersion|$)/i);
    if (match && match[1]) {
      revertReason = match[1].trim();
    }
  }

  // 6. Fallback to shortMessage or message
  if (!revertReason) {
    revertReason = error.shortMessage || error.message || "Contract call failed.";
  }

  // Clean prefix if "execution reverted:" is prepended
  if (revertReason.includes("execution reverted:")) {
    revertReason = revertReason.replace("execution reverted:", "").trim();
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
