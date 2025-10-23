import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { walletConnectUniversal } from './connectors/walletConnectUniversalConnector'

const queryClient = new QueryClient()

const wcProjectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
if (!wcProjectId) console.warn('VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect mobile deep-link will not work.')

const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    ...(wcProjectId
      ? [
          walletConnectUniversal({
            projectId: wcProjectId,
            metadata: {
              name: 'Connection Test',
              description: 'WalletConnect v2 Universal Provider',
              url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
              icons: ['https://avatars.githubusercontent.com/u/37784886?s=200&v=4'],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [mainnet.id]: http(),
  },
})

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config} reconnectOnMount={false}>
        <App />
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
