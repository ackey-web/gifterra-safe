// src/pages/ReceivePage.tsx
import { useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useTokenBalances } from '../hooks/useTokenBalances';

export function ReceivePage() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const [address, setAddress] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [newReceiveNotification, setNewReceiveNotification] = useState<{
    show: boolean;
    amount: string;
    token: string;
  }>({ show: false, amount: '', token: '' });

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

  // トランザクション履歴を取得
  const { transactions, loading: historyLoading } = useTransactionHistory(address);

  // リアルタイム残高表示
  const { balances, loading: balancesLoading } = useTokenBalances(address);

  // 受取通知機能 - トランザクション履歴の変化を監視
  useEffect(() => {
    if (!transactions || transactions.length === 0) return;

    const latestReceive = transactions.find(tx => tx.type === 'receive');
    if (!latestReceive) return;

    // LocalStorageに最後に通知したトランザクションハッシュを保存
    const lastNotifiedTx = localStorage.getItem('lastNotifiedReceiveTx');

    if (lastNotifiedTx !== latestReceive.hash) {
      // 新しい受取があった場合、通知を表示
      setNewReceiveNotification({
        show: true,
        amount: parseFloat(latestReceive.value).toFixed(4),
        token: latestReceive.tokenSymbol,
      });

      // LocalStorageを更新
      localStorage.setItem('lastNotifiedReceiveTx', latestReceive.hash);

      // 5秒後に通知を非表示
      setTimeout(() => {
        setNewReceiveNotification({ show: false, amount: '', token: '' });
      }, 5000);
    }
  }, [transactions]);

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
      padding: '20px',
      position: 'relative',
    }}>
      {/* 受取通知 */}
      {newReceiveNotification.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: isMobile ? '16px 20px' : '20px 24px',
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out',
          maxWidth: isMobile ? '280px' : '320px',
        }}>
          <div style={{
            fontSize: isMobile ? 18 : 20,
            fontWeight: 700,
            marginBottom: '8px',
          }}>
            📥 受取完了！
          </div>
          <div style={{
            fontSize: isMobile ? 16 : 18,
            fontWeight: 600,
          }}>
            +{newReceiveNotification.amount} {newReceiveNotification.token}
          </div>
        </div>
      )}

      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: isMobile ? '32px 24px' : '48px 40px',
        maxWidth: '800px',
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
            {user?.email?.address || user?.google?.email || 'ゲストユーザー'}
          </p>
        </div>

        {/* リアルタイム残高表示 */}
        <div style={{
          background: '#f0fdf4',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '24px',
          border: '2px solid #10b981',
        }}>
          <h2 style={{
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '12px',
          }}>
            💰 リアルタイム残高
          </h2>
          {balancesLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#718096' }}>
              読込中...
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {balances.map((balance) => (
                <div
                  key={balance.symbol}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #d1fae5',
                  }}
                >
                  <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#059669' }}>
                    {balance.symbol}
                  </span>
                  <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: '#1a1a1a' }}>
                    {balance.balance}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QRコード */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '32px',
        }}>
          <div style={{
            padding: '16px',
            background: '#ffffff',
            border: '4px solid #10b981',
            borderRadius: '16px',
            display: 'inline-block',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <QRCodeSVG
              value={address}
              size={isMobile ? 200 : 256}
              level="H"
              includeMargin={false}
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
            marginBottom: '32px',
          }}
        >
          🦊 MetaMaskアプリを開く
        </a>

        {/* 受取履歴 */}
        <div style={{
          background: '#f7fafc',
          borderRadius: '16px',
          padding: isMobile ? '20px' : '24px',
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: isMobile ? 18 : 20,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '16px',
          }}>
            📥 最近の受取履歴（最新10件）
          </h2>

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              読込中...
            </div>
          ) : transactions.filter(tx => tx.type === 'receive').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              受取履歴がありません
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {transactions
                .filter(tx => tx.type === 'receive')
                .slice(0, 10)
                .map((tx, index) => (
                  <div
                    key={`${tx.hash}-${index}`}
                    style={{
                      padding: '16px',
                      background: '#ecfdf5',
                      borderRadius: '12px',
                      border: '1px solid #10b981',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#059669',
                      }}>
                        📥 受取
                      </span>
                      <span style={{ fontSize: 12, color: '#718096' }}>
                        {new Date(tx.timestamp * 1000).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, color: '#2d3748', marginBottom: 4, fontWeight: 600 }}>
                      {parseFloat(tx.value).toFixed(4)} {tx.tokenSymbol}
                    </div>
                    <div style={{ fontSize: 12, color: '#718096', fontFamily: 'monospace', marginBottom: 8 }}>
                      From: {tx.from.slice(0, 10)}...{tx.from.slice(-8)}
                    </div>
                    <a
                      href={`https://polygonscan.com/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: '#667eea',
                        textDecoration: 'none',
                      }}
                    >
                      🔗 PolygonScanで確認
                    </a>
                  </div>
                ))}
            </div>
          )}
        </div>

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
