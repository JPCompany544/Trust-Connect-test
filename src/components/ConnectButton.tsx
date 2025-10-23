import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useEffect, useMemo, useState } from 'react';
import { isMobile, isInAppBrowser } from '../utils/mobileUtils';

export default function ConnectButton() {
  const { connectAsync, connectors, status, variables } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();

  const [useWalletConnect, setUseWalletConnect] = useState(false);

  useEffect(() => {
    const mobile = isMobile();
    const inApp = isInAppBrowser();
    setUseWalletConnect(mobile && !inApp);
  }, []);

  const preferredConnector = useMemo(() => {
    if (useWalletConnect) {
      return connectors.find((c) => c.id === 'walletConnect' || c.name.includes('WalletConnect')) || connectors[0];
    }
    return connectors.find((connector) => connector.name === 'Trust Wallet') ?? connectors[0];
  }, [connectors, useWalletConnect]);

  function shorten(addr?: string) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  const handleConnect = async () => {
    if (!preferredConnector) return;
    try {
      await connectAsync({ connector: preferredConnector });
    } catch {}
  };

  const handleDisconnect = async () => {
    try {
      await disconnectAsync();
    } catch {}
    try {
      localStorage.removeItem('wagmi.store');
      localStorage.removeItem('injected.connected');
      localStorage.removeItem('walletconnect');
      // Clear common WC keys
      Object.keys(localStorage).forEach((k) => {
        if (k.toLowerCase().includes('walletconnect') || k.toLowerCase().includes('wc@')) {
          try { localStorage.removeItem(k) } catch {}
        }
      });
    } catch {}
  };

  return (
    <div className="w-screen h-[100dvh] bg-white flex flex-col items-center justify-center">
      <button
        onClick={isConnected ? handleDisconnect : handleConnect}
        disabled={status === 'pending'}
        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-xl hover:from-blue-600 hover:to-blue-800 transition-all duration-300 text-lg"
      >
        {isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
      </button>

      {status === 'pending' && (
        <p className="mt-3 text-sm text-gray-600">Waiting for approval...</p>
      )}

      {isConnected && (
        <div className="mt-4 text-center">
          <p className="text-gray-700">Wallet Connected ✅</p>
          <p className="text-gray-500 mt-1">{shorten(address)}</p>
        </div>
      )}
    </div>
  );
}