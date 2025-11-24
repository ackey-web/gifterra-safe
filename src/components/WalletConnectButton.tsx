// src/components/WalletConnectButton.tsx
// WalletConnect接続ボタン

import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useState } from 'react';

interface WalletConnectButtonProps {
  onConnected?: () => void;
}

export function WalletConnectButton({ onConnected }: WalletConnectButtonProps) {
  const { connectors, connect } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // WalletConnectコネクターを探す
      const walletConnectConnector = connectors.find(
        (connector) => connector.id === 'walletConnect'
      );

      if (walletConnectConnector) {
        await connect({ connector: walletConnectConnector });
        console.log('✅ WalletConnect接続成功');
        onConnected?.();
      } else {
        console.error('❌ WalletConnectコネクターが見つかりません');
      }
    } catch (error) {
      console.error('❌ WalletConnect接続エラー:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div style={{
        padding: '16px',
        background: 'rgba(2, 187, 209, 0.1)',
        borderRadius: '12px',
        marginBottom: '16px',
      }}>
        <div style={{
          color: '#02bbd1',
          fontSize: '14px',
          marginBottom: '8px',
          fontWeight: 600,
        }}>
          ✅ WalletConnect接続済み
        </div>
        <div style={{
          color: '#94a3b8',
          fontSize: '12px',
          marginBottom: '12px',
          wordBreak: 'break-all',
        }}>
          {address}
        </div>
        <button
          onClick={() => disconnect()}
          style={{
            width: '100%',
            padding: '10px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          切断
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      style={{
        width: '100%',
        padding: '16px',
        background: isConnecting
          ? '#64748b'
          : 'linear-gradient(135deg, #02bbd1 0%, #018a9a 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: 700,
        cursor: isConnecting ? 'not-allowed' : 'pointer',
        boxShadow: '0 4px 14px 0 rgba(2, 187, 209, 0.39)',
        transition: 'all 0.2s',
        marginBottom: '16px',
      }}
    >
      {isConnecting ? '接続中...' : '📱 WalletConnect で接続'}
    </button>
  );
}
