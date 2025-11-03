// src/pages/ReceivePage.tsx
import { useEffect, useState } from 'react';

export function ReceivePage() {
  const [address, setAddress] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // URLパラメータからアドレスを取得
    const params = new URLSearchParams(window.location.search);
    const addr = params.get('address');
    if (addr) {
      setAddress(addr);
    }

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
            ⚠️ エラー
          </h1>
          <p style={{ color: '#4a5568', fontSize: 16 }}>
            受け取りアドレスが指定されていません
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
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: isMobile ? '32px 24px' : '48px 40px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* ヘッダー */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <h1 style={{
            fontSize: isMobile ? 24 : 32,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '12px',
          }}>
            💴 受け取りアドレス
          </h1>
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: '#4a5568',
            lineHeight: 1.6,
          }}>
            アドレスをタップしてコピー
          </p>
        </div>

        {/* アドレス表示 (タップでコピー) */}
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            background: copySuccess ? '#ecfdf5' : '#f7fafc',
            border: copySuccess ? '2px solid #10b981' : '2px solid #e2e8f0',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '24px',
            marginBottom: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            fontSize: isMobile ? 11 : 12,
            color: '#718096',
            marginBottom: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'left',
          }}>
            {copySuccess ? '✅ コピーしました！' : 'アドレス (タップでコピー)'}
          </div>
          <div style={{
            wordBreak: 'break-all',
            fontSize: isMobile ? 14 : 16,
            fontFamily: 'monospace',
            color: '#1a1a1a',
            fontWeight: 500,
            lineHeight: 1.6,
            padding: '16px',
            background: '#ffffff',
            borderRadius: '12px',
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
            padding: isMobile ? '18px' : '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            textAlign: 'center',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            marginBottom: '24px',
          }}
        >
          🦊 MetaMaskアプリを開く
        </a>

        {/* 注意事項 */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
        }}>
          <div style={{
            fontWeight: 600,
            color: '#92400e',
            marginBottom: '8px',
            fontSize: isMobile ? 14 : 15,
          }}>
            ⚠️ 送金手順
          </div>
          <ol style={{
            margin: 0,
            paddingLeft: '20px',
            fontSize: isMobile ? 13 : 14,
            color: '#78350f',
            lineHeight: 1.8,
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
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          fontSize: isMobile ? 12 : 13,
          color: '#718096',
          lineHeight: 1.8,
        }}>
          <div>Powered by <strong>GIFTERRA</strong></div>
          <div>Produced by <strong>METATRON</strong></div>
        </div>
      </div>
    </div>
  );
}
