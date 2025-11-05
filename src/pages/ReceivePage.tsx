// src/pages/ReceivePage.tsx
import { useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';

export function ReceivePage() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [address, setAddress] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Privyウォレットからアドレスを取得
  useEffect(() => {
    async function getAddress() {
      if (!wallets || wallets.length === 0) {
        setAddress('');
        return;
      }

      try {
        const wallet = wallets[0];
        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        const signer = ethersProvider.getSigner();
        const addr = await signer.getAddress();
        setAddress(addr);
      } catch (error) {
        console.error('Failed to get address:', error);
        setAddress('');
      }
    }

    if (authenticated) {
      getAddress();
    }
  }, [authenticated, wallets]);

  useEffect(() => {
    // モバイル判定
    setIsMobile(window.innerWidth <= 768);
  }, []);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
      alert('コピーに失敗しました');
    }
  };

  // 未認証の場合
  if (!ready || !authenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '48px 40px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 }}>
            🎁 GIFTERRA 受取ページ
          </h1>
          <p style={{ fontSize: 16, color: '#4a5568', marginBottom: 32 }}>
            受取ページを表示するにはログインが必要です
          </p>
          <button
            onClick={login}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#1a1a1a', marginBottom: '16px', fontSize: 24 }}>
            ⏳ 読込中...
          </h1>
          <p style={{ color: '#4a5568', fontSize: 16 }}>
            ウォレットアドレスを取得しています
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      padding: isMobile ? '8px' : '20px',
      position: 'relative',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: isMobile ? '16px' : '24px',
        padding: isMobile ? '16px 14px' : '36px 28px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* ヘッダー */}
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? '12px' : '20px',
        }}>
          <h1 style={{
            fontSize: isMobile ? 18 : 26,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: isMobile ? '4px' : '8px',
          }}>
            💴 送金先アドレス
          </h1>
          <p style={{
            fontSize: isMobile ? 11 : 14,
            color: '#4a5568',
            lineHeight: 1.3,
          }}>
            下記のアドレスに送金してください
          </p>
        </div>

        {/* QRコード */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: isMobile ? '12px' : '20px',
        }}>
          <div style={{
            padding: isMobile ? '10px' : '14px',
            background: '#ffffff',
            border: isMobile ? '2px solid #10b981' : '3px solid #10b981',
            borderRadius: isMobile ? '10px' : '14px',
            display: 'inline-block',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <QRCodeSVG
              value={`${window.location.origin}/receive?address=${address}`}
              size={isMobile ? 140 : 200}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: '/polygon-logo.png',
                height: isMobile ? 28 : 40,
                width: isMobile ? 28 : 40,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* アドレス表示 (タップでコピー) */}
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            background: copySuccess ? '#ecfdf5' : '#f7fafc',
            border: copySuccess ? '2px solid #10b981' : '2px solid #e2e8f0',
            borderRadius: isMobile ? '10px' : '14px',
            padding: isMobile ? '10px' : '16px',
            marginBottom: isMobile ? '10px' : '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            fontSize: isMobile ? 9 : 10,
            color: '#718096',
            marginBottom: isMobile ? '6px' : '8px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'left',
          }}>
            {copySuccess ? '✅ コピーしました！' : 'アドレス (タップでコピー)'}
          </div>
          <div style={{
            wordBreak: 'break-all',
            fontSize: isMobile ? 10 : 13,
            fontFamily: 'monospace',
            color: '#1a1a1a',
            fontWeight: 500,
            lineHeight: isMobile ? 1.3 : 1.5,
            padding: isMobile ? '8px' : '12px',
            background: '#ffffff',
            borderRadius: isMobile ? '6px' : '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'left',
          }}>
            {address}
          </div>
        </button>

        {/* MetaMaskアプリを開くボタン */}
        <a
          href={`https://metamask.app.link/send/${address}@137`}
          style={{
            display: 'block',
            width: '100%',
            padding: isMobile ? '12px' : '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: isMobile ? '8px' : '10px',
            color: '#ffffff',
            fontSize: isMobile ? 13 : 15,
            fontWeight: 700,
            textAlign: 'center',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            marginBottom: isMobile ? '10px' : '16px',
          }}
        >
          🦊 MetaMaskアプリを開く
        </a>

        {/* 注意事項 */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: isMobile ? '8px' : '10px',
          padding: isMobile ? '10px' : '14px',
        }}>
          <div style={{
            fontWeight: 600,
            color: '#92400e',
            marginBottom: isMobile ? '5px' : '7px',
            fontSize: isMobile ? 11 : 13,
          }}>
            ⚠️ 送金手順
          </div>
          <ol style={{
            margin: 0,
            paddingLeft: isMobile ? '14px' : '18px',
            fontSize: isMobile ? 10 : 12,
            color: '#78350f',
            lineHeight: isMobile ? 1.4 : 1.6,
          }}>
            <li>アドレスをタップしてコピー</li>
            <li>MetaMaskアプリを開く</li>
            <li>ネットワークを <strong>Polygon</strong> に変更</li>
            <li>送金するトークンを選択</li>
            <li>コピーしたアドレスを貼り付けて送金</li>
          </ol>
        </div>

        {/* フッター */}
        <div style={{
          marginTop: isMobile ? '10px' : '16px',
          paddingTop: isMobile ? '10px' : '14px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          fontSize: isMobile ? 9 : 11,
          color: '#718096',
          lineHeight: isMobile ? 1.3 : 1.5,
        }}>
          <div>Powered by <strong>GIFTERRA</strong></div>
          <div>Produced by <strong>METATRON</strong></div>
        </div>
      </div>
    </div>
  );
}
