import { http, createConfig, injected } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
        'https://sepolia-rollup.arbitrum.io/rpc'
    ),
  },
});
