import { usePublicClient } from 'wagmi';

export interface BufferedFees {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export function useBufferedFees() {
  const publicClient = usePublicClient();

  const getBufferedFeeData = async (): Promise<BufferedFees> => {
    try {
      if (!publicClient) return {};
      const fees = await publicClient.estimateFeesPerGas();
      if (!fees) return {};

      const result: BufferedFees = {};
      
      // Fetch or default priority fee if undefined (common on Arbitrum Sepolia)
      let maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      if (maxPriorityFeePerGas === undefined || maxPriorityFeePerGas === null) {
        try {
          maxPriorityFeePerGas = await publicClient.estimateMaxPriorityFeePerGas();
        } catch {
          maxPriorityFeePerGas = 0n;
        }
      }

      // Apply 1.2x (20%) safety buffer to fee estimations
      if (fees.maxFeePerGas !== undefined && fees.maxFeePerGas !== null) {
        result.maxFeePerGas = (fees.maxFeePerGas * 120n) / 100n;
      }
      
      if (maxPriorityFeePerGas !== undefined && maxPriorityFeePerGas !== null) {
        const bufferedPriority = (maxPriorityFeePerGas * 120n) / 100n;
        // Ensure maxPriorityFeePerGas is never higher than maxFeePerGas
        result.maxPriorityFeePerGas = result.maxFeePerGas !== undefined && bufferedPriority > result.maxFeePerGas
          ? result.maxFeePerGas
          : bufferedPriority;
      }

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
