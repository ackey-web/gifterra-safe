// src/pages/MypageMinimal.tsx
// 最小限のマイページ - トークン残高と履歴表示

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { useTransactionHistory } from '../hooks/useTransactionHistory';

export function MypageMinimal() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | undefined>(undefined);

  // Privyウォレットからsignerを取得
  useEffect(() => {
    async function setupSigner() {
      if (!wallets || wallets.length === 0) {
        setSigner(null);
        setAddress(undefined);
        return;
      }

      try {
        const wallet = wallets[0]; // 最初のウォレットを使用
        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        const ethersSigner = ethersProvider.getSigner();
        const addr = await ethersSigner.getAddress();

        setSigner(ethersSigner);
        setAddress(addr);
      } catch (error) {
        console.error('Failed to setup signer:', error);
        setSigner(null);
        setAddress(undefined);
      }
    }

    if (authenticated) {
      setupSigner();
    }
  }, [authenticated, wallets]);

  // トークン残高を取得
  const { balances, refetch: refetchBalances } = useTokenBalances(address, signer);

  // トランザクション履歴を取得
  const { transactions, loading: historyLoading } = useTransactionHistory(address);

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
            🎁 GIFTERRA マイページ
          </h1>
          <p style={{ fontSize: 16, color: '#4a5568', marginBottom: 32 }}>
            マイページを表示するにはログインが必要です
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

  // 認証済み - マイページ表示
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* ヘッダー */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              🎁 マイページ
            </h1>
            <p style={{ fontSize: 14, color: '#718096', margin: '8px 0 0 0' }}>
              {user?.email?.address || user?.google?.email || 'ゲストユーザー'}
            </p>
          </div>
          <button
            onClick={logout}
            style={{
              padding: '12px 24px',
              background: '#e53e3e',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>

        {/* ウォレットアドレス */}
        {address && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', margin: '0 0 12px 0' }}>
              💳 ウォレットアドレス
            </h2>
            <div style={{
              padding: '16px',
              background: '#f7fafc',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: 14,
              color: '#2d3748',
              wordBreak: 'break-all',
            }}>
              {address}
            </div>
          </div>
        )}

        {/* トークン残高 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', margin: '0 0 16px 0' }}>
            💰 トークン残高
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {/* MATIC */}
            <div style={{
              padding: '16px',
              background: balances.matic.loading ? '#f7fafc' : '#ecfdf5',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#2d3748' }}>MATIC</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                {balances.matic.loading ? '読込中...' : `${balances.matic.formatted} MATIC`}
              </span>
            </div>

            {/* JPYC */}
            <div style={{
              padding: '16px',
              background: balances.jpyc.loading ? '#f7fafc' : '#eff6ff',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#2d3748' }}>JPYC</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>
                {balances.jpyc.loading ? '読込中...' : `${balances.jpyc.formatted} JPYC`}
              </span>
            </div>

            {/* NHT */}
            <div style={{
              padding: '16px',
              background: balances.nht.loading ? '#f7fafc' : '#fef3c7',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#2d3748' }}>NHT</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>
                {balances.nht.loading ? '読込中...' : `${balances.nht.formatted} NHT`}
              </span>
            </div>
          </div>

          <button
            onClick={refetchBalances}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 残高を更新
          </button>
        </div>

        {/* トランザクション履歴 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', margin: '0 0 16px 0' }}>
            📜 トランザクション履歴（最新20件）
          </h2>

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              読込中...
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              トランザクション履歴がありません
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {transactions.map((tx, index) => (
                <div
                  key={`${tx.hash}-${index}`}
                  style={{
                    padding: '16px',
                    background: tx.type === 'receive' ? '#ecfdf5' : '#fef3c7',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: tx.type === 'receive' ? '#059669' : '#d97706',
                    }}>
                      {tx.type === 'receive' ? '📥 受取' : '📤 送信'}
                    </span>
                    <span style={{ fontSize: 12, color: '#718096' }}>
                      {new Date(tx.timestamp * 1000).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: '#2d3748', marginBottom: 4 }}>
                    <strong>{parseFloat(tx.value).toFixed(4)} {tx.tokenSymbol}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#718096', fontFamily: 'monospace' }}>
                    {tx.type === 'receive' ? 'From:' : 'To:'} {tx.type === 'receive' ? tx.from.slice(0, 10) : tx.to.slice(0, 10)}...
                  </div>
                  <a
                    href={`https://polygonscan.com/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      color: '#667eea',
                      textDecoration: 'none',
                      marginTop: 8,
                      display: 'inline-block',
                    }}
                  >
                    🔗 PolygonScanで確認
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div style={{
          marginTop: '32px',
          textAlign: 'center',
          color: '#ffffff',
          fontSize: 12,
        }}>
          <div>Powered by <strong>GIFTERRA</strong></div>
          <div>Produced by <strong>METATRON</strong></div>
        </div>
      </div>
    </div>
  );
}
