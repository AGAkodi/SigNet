import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrumSepolia } from 'wagmi/chains';
import { http } from 'viem';

export const config = getDefaultConfig({
  appName: 'SIGNET',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '8a82ad2b534edb98db6452422d937440',
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
        'https://sepolia-rollup.arbitrum.io/rpc'
    ),
  },
  ssr: true,
});
