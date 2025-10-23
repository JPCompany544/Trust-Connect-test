import { useConnect, useAccount, useDisconnect } from 'wagmi';

export default function ConnectButton() {
  const { connectAsync, connectors, status } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();

  const preferredConnector =
    connectors.find((connector) => connector.name === 'Trust Wallet') ?? connectors[0];

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

      {isConnected && (
        <div className="mt-4 text-center">
          <p className="text-gray-700">Wallet Connected ✅</p>
          <p className="text-gray-500 mt-1">{shorten(address)}</p>
        </div>
      )}
    </div>
  );
}