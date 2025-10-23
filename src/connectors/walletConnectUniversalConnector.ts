import UniversalProvider from '@walletconnect/universal-provider'
import { createConnector } from '@wagmi/core'
import { openDeepLink } from '../utils/mobileUtils'
type Address = `0x${string}`

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

  return createConnector((config) => {
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

      provider.on?.('display_uri', (uri: string) => {
        try { openDeepLink(uri) } catch {}
      })
      provider.on?.('session_update', (args: any) => {
        try {
          const accounts = (args?.params?.namespaces?.eip155?.accounts ?? []).map((a: string) => a.split(':')[2]) as Address[]
          if (accounts?.length) config.emitter.emit('change', { accounts: accounts as readonly Address[] })
        } catch {}
      })
      provider.on?.('session_delete', () => {
        try { config.emitter.emit('disconnect') } catch {}
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
        return p as any
      },

      async connect({ chainId }: { chainId?: number } = {}): Promise<any> {
        const p = await ensureProvider()
        await clearPairings()

        const chains = chainId ? [chainId] : config.chains.map((c) => c.id)
        const requiredNamespaces = {
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

        const connectPromise = p.connect({ namespaces: requiredNamespaces, requiredNamespaces } as any)
        const raced = await Promise.race([
          (async () => ({ ok: true as const, session: await connectPromise }))(),
          new Promise((resolve) => setTimeout(() => resolve({ ok: false as const }), 60000)),
        ])
        if (!(raced as any).ok) {
          try { await p.disconnect?.() } catch {}
          try {
            const pairings = p?.core?.pairing?.getPairings?.() ?? []
            for (const pairing of pairings) await p.core.pairing.delete({ topic: pairing.topic })
          } catch {}
          throw new Error('Connection timed out')
        }
        const session = (raced as any).session
        const accounts = (session?.namespaces?.eip155?.accounts ?? []).map((a: string) => a.split(':')[2]) as Address[]
        const connectedChainId = (() => {
          const first = session?.namespaces?.eip155?.chains?.[0]
          if (!first) return chainId ?? config.chains[0].id
          return Number(first.split(':')[1])
        })()

        return { accounts: accounts as readonly Address[], chainId: connectedChainId } as any
      },

      async disconnect() {
        const p = await ensureProvider()
        try { await p.disconnect?.() } catch {}
        try {
          const pairings = p?.core?.pairing?.getPairings?.() ?? []
          for (const pairing of pairings) await p.core.pairing.delete({ topic: pairing.topic })
        } catch {}
        try {
          if (typeof localStorage !== 'undefined') {
            try { localStorage.removeItem('wagmi.store') } catch {}
            try { localStorage.removeItem('walletconnect') } catch {}
            try { localStorage.removeItem('injected.connected') } catch {}
            Object.keys(localStorage).forEach((k) => {
              if (k.toLowerCase().includes('walletconnect') || k.toLowerCase().includes('wc@')) {
                try { localStorage.removeItem(k) } catch {}
              }
            })
          }
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
        config.emitter.emit('change', { accounts: accounts as readonly Address[] })
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
