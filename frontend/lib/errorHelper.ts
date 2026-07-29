import { usePublicClient } from 'wagmi';

export interface BufferedFees {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

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
          return {
            gasPrice: (fees.gasPrice * 120n) / 100n,
          };
        }
        return {};
      }

      const result: BufferedFees = {};
      result.maxFeePerGas = (fees.maxFeePerGas * 120n) / 100n;
      
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
  
  const message = (error.message || "").toLowerCase();
  const shortMessage = (error.shortMessage || "").toLowerCase();
  
  // Intercept typical RPC errors related to gas fee limits and fluctuations
  if (
    message.includes("max fee per gas less than block base fee") ||
    message.includes("maxfeepergas less than block base fee") ||
    message.includes("fee too low") ||
    message.includes("base fee") ||
    message.includes("underpriced") ||
    message.includes("gas price") ||
    shortMessage.includes("max fee per gas less than block base fee") ||
    shortMessage.includes("maxfeepergas less than block base fee") ||
    shortMessage.includes("fee too low") ||
    shortMessage.includes("base fee") ||
    shortMessage.includes("underpriced") ||
    shortMessage.includes("gas price")
  ) {
    return "Network fee changed, please try again";
  }
  
  if (message.includes("user rejected") || message.includes("user denied")) {
    return "Transaction signature rejected by user.";
  }

  return error.shortMessage || error.message || "Contract call failed.";
}
