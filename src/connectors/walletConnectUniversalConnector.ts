import UniversalProvider from '@walletconnect/universal-provider'
import type { Address, EIP1193Provider } from 'viem'
import { createConnector } from '@wagmi/core'
import { openDeepLink } from '../utils/mobileUtils'

/**
 * WalletConnect v2 Universal Provider connector for Wagmi v2
 * - Deep-links to Trust Wallet on mobile via `display_uri` event
 * - Forces fresh approval by clearing pairings before connect
 */
export function walletConnectUniversal(parameters: {
  projectId: string
  metadata?: { name: string; description: string; url: string; icons: string[] }
}) {
  const { projectId, metadata } = parameters

  return createConnector<EIP1193Provider, { wc?: any }>((config) => {
    let provider: any | undefined

    async function ensureProvider() {
      if (provider) return provider
      provider = await UniversalProvider.init({
        projectId,
        metadata: metadata ?? {
          name: 'Connection Test',
          description: 'WalletConnect v2 Universal Provider',
          url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
          icons: ['https://avatars.githubusercontent.com/u/37784886?s=200&v=4'],
        },
      })

      // Deep link on mobile when a URI is available
      provider.on?.('display_uri', (uri: string) => {
        try { openDeepLink(uri) } catch {}
      })

      return provider
    }

    async function clearPairings() {
      try {
        const p = await ensureProvider()
        const pairings = p?.core?.pairing?.getPairings?.() ?? []
        for (const pairing of pairings) await p.core.pairing.delete({ topic: pairing.topic })
      } catch {}
    }

    return {
      id: 'walletConnect',
      name: 'WalletConnect',
      type: 'walletConnect',

      async getProvider() {
        const p = await ensureProvider()
        return p as EIP1193Provider
      },

      async connect({ chainId }: { chainId?: number } = {}) {
        const p = await ensureProvider()
        await clearPairings() // always fresh approval

        const chains = chainId ? [chainId] : config.chains.map((c) => c.id)
        const namespaces = {
          eip155: {
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
              'wallet_switchEthereumChain',
              'wallet_addEthereumChain',
            ],
            chains: chains.map((id) => `eip155:${id}`),
            events: ['chainChanged', 'accountsChanged'],
          },
        }

        const session = await p.connect({ namespaces })
        const accounts = (session?.namespaces?.eip155?.accounts ?? []).map((a: string) => a.split(':')[2]) as Address[]
        const connectedChainId = (() => {
          const first = session?.namespaces?.eip155?.chains?.[0]
          if (!first) return chainId ?? config.chains[0].id
          return Number(first.split(':')[1])
        })()

        return { accounts, chainId: connectedChainId }
      },

      async disconnect() {
        const p = await ensureProvider()
        try { await p.disconnect?.() } catch {}
        try {
          const pairings = p?.core?.pairing?.getPairings?.() ?? []
          for (const pairing of pairings) await p.core.pairing.delete({ topic: pairing.topic })
        } catch {}
      },

      async getAccounts() {
        const p = await ensureProvider()
        const accounts = (await p.request({ method: 'eth_accounts' })) as string[]
        return accounts as Address[]
      },

      async getChainId() {
        const p = await ensureProvider()
        const id = await p.request({ method: 'eth_chainId' })
        return typeof id === 'string' ? parseInt(id, 16) : Number(id)
      },

      async isAuthorized() {
        try { return (await this.getAccounts()).length > 0 } catch { return false }
      },

      onAccountsChanged(accounts: string[]) {
        config.emitter.emit('change', { accounts: accounts as Address[] })
        if (accounts.length === 0) config.emitter.emit('disconnect')
      },

      onChainChanged(chainId: string) {
        const id = typeof chainId === 'string' ? parseInt(chainId, 16) : Number(chainId)
        config.emitter.emit('change', { chainId: id })
      },

      onDisconnect() {
        config.emitter.emit('disconnect')
      },
    }
  })
}
