// src/pages/MypageWithSend.tsx
// JPYC送金機能付きマイページ

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { QRScannerSimple } from '../components/QRScannerSimple';
import { JPYC_TOKEN, ERC20_MIN_ABI } from '../contract';
import { analyzeSentiment } from '../lib/ai_analysis';
import { saveTipMessageToSupabase } from '../lib/saveTipMessage';

// 送金タイプ定義
type SendMode = 'simple' | 'bulk' | 'tenant';

// 一括送金の制限
const BULK_SEND_LIMITS = {
  maxRecipients: 5,
  dailyLimit: 10,
};

// LocalStorage管理（一括送金回数）
interface BulkSendHistory {
  date: string;
  count: number;
}

const getTodayBulkSendCount = (): number => {
  const today = new Date().toISOString().split('T')[0];
  const history: BulkSendHistory[] = JSON.parse(localStorage.getItem('bulk_send_history') || '[]');
  const todayRecord = history.find(h => h.date === today);
  return todayRecord?.count || 0;
};

const incrementBulkSendCount = () => {
  const today = new Date().toISOString().split('T')[0];
  const history: BulkSendHistory[] = JSON.parse(localStorage.getItem('bulk_send_history') || '[]');
  const todayIndex = history.findIndex(h => h.date === today);

  if (todayIndex >= 0) {
    history[todayIndex].count += 1;
  } else {
    history.push({ date: today, count: 1 });
  }

  // 過去7日間のみ保持
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const filtered = history.filter(h => new Date(h.date) >= sevenDaysAgo);

  localStorage.setItem('bulk_send_history', JSON.stringify(filtered));
};

// 受取人情報の型定義
interface Recipient {
  id: number;
  address: string;
  amount: string;
}

// テナント情報の型定義
interface Tenant {
  tenantId: string;
  name: string;
  icon: string;
  thumbnail?: string;
  walletAddress: string;
  rank?: string;
}

export function MypageWithSend() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | undefined>(undefined);

  // 送金関連の状態
  const [showSendModeModal, setShowSendModeModal] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // 一括送金用の状態
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: 1, address: '', amount: '' },
  ]);
  const [nextRecipientId, setNextRecipientId] = useState(2);

  // テナント送金用の状態
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // Privyウォレットからsignerを取得
  useEffect(() => {
    async function setupSigner() {
      if (!wallets || wallets.length === 0) {
        setSigner(null);
        setAddress(undefined);
        return;
      }

      try {
        const wallet = wallets[0];
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

  // LocalStorageからフォロー中のテナント一覧を読み込み
  useEffect(() => {
    const saved = localStorage.getItem('followed_tenants');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTenants(parsed);
      } catch (error) {
        console.error('Failed to parse followed tenants:', error);
        setTenants([]);
      }
    }
  }, []);

  // テナント選択時の処理
  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setSendTo(tenant.walletAddress);
    setShowTenantModal(false);
    setShowSendModal(true);
  };

  // JPYC送金処理
  const handleSend = async () => {
    if (!signer || !address) {
      setSendError('ウォレットに接続してください');
      return;
    }

    if (!sendTo || !sendAmount) {
      setSendError('送金先と金額を入力してください');
      return;
    }

    // アドレスのバリデーション
    if (!/^0x[a-fA-F0-9]{40}$/.test(sendTo)) {
      setSendError('無効な送金先アドレスです');
      return;
    }

    // 金額のバリデーション
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError('無効な金額です');
      return;
    }

    // 残高チェック
    const jpycBalance = parseFloat(balances.jpyc.formatted);
    if (amount > jpycBalance) {
      setSendError(`残高不足です（残高: ${jpycBalance} JPYC）`);
      return;
    }

    try {
      setSending(true);
      setSendError(null);

      // JPYC コントラクト
      const jpycContract = new ethers.Contract(
        JPYC_TOKEN.ADDRESS,
        ERC20_MIN_ABI,
        signer
      );

      // 金額をWei単位に変換（18 decimals）
      const amountWei = ethers.utils.parseUnits(sendAmount, 18);

      // 送金トランザクション
      const tx = await jpycContract.transfer(sendTo, amountWei);
      console.log('Transaction sent:', tx.hash);

      // トランザクション完了を待つ
      await tx.wait();
      console.log('Transaction confirmed');

      // kodomi記録（メッセージがある場合のみ）
      let kodomiRecorded = false;
      if (sendMessage && sendMessage.trim()) {
        try {
          console.log('Recording kodomi message...');

          // AI感情分析
          const sentiment = await analyzeSentiment(sendMessage);
          console.log('Sentiment analysis:', sentiment);

          // Supabaseにメッセージとsentimentを保存
          await saveTipMessageToSupabase(
            tx.hash,
            address, // ユーザーアドレス
            sendMessage,
            sentiment
          );

          console.log('Kodomi message recorded successfully');
          kodomiRecorded = true;
        } catch (error) {
          console.error('Failed to record kodomi message:', error);
          // エラーでも送金は成功しているので続行
        }
      }

      setSendSuccess(true);
      setSendTo('');
      setSendAmount('');
      setSendMessage(''); // メッセージもリセット

      // 残高を更新
      setTimeout(() => {
        refetchBalances();
      }, 2000);

      // 3秒後にモーダルを閉じる
      setTimeout(() => {
        setShowSendModal(false);
        setSendSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('Send error:', error);
      setSendError(error.message || '送金に失敗しました');
    } finally {
      setSending(false);
    }
  };

  // QRスキャン結果を受け取る
  const handleQRScan = (data: string) => {
    setSendTo(data);
    setShowQRScanner(false);
  };

  // 一括送金: 受取人管理
  const addRecipient = () => {
    setRecipients([...recipients, { id: nextRecipientId, address: '', amount: '' }]);
    setNextRecipientId(nextRecipientId + 1);
  };

  const removeRecipient = (id: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter(r => r.id !== id));
    }
  };

  const updateRecipient = (id: number, field: 'address' | 'amount', value: string) => {
    setRecipients(recipients.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  // 一括送金: 合計金額計算
  const totalAmount = recipients.reduce((sum, r) => {
    const amount = parseFloat(r.amount || '0');
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  // 一括送金処理
  const handleBulkSend = async () => {
    if (!signer || !address) {
      setSendError('ウォレットに接続してください');
      return;
    }

    // バリデーション
    for (const recipient of recipients) {
      if (!recipient.address || !recipient.amount) {
        setSendError('全ての送金先と金額を入力してください');
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient.address)) {
        setSendError(`無効な送金先アドレスです: ${recipient.address.slice(0, 10)}...`);
        return;
      }
      const amount = parseFloat(recipient.amount);
      if (isNaN(amount) || amount <= 0) {
        setSendError(`無効な金額です: ${recipient.amount}`);
        return;
      }
    }

    // Privyウォレット制限チェック
    if (recipients.length > BULK_SEND_LIMITS.maxRecipients) {
      setSendError(`一度に送金できるのは最大${BULK_SEND_LIMITS.maxRecipients}人までです`);
      return;
    }

    const todayCount = getTodayBulkSendCount();
    if (todayCount >= BULK_SEND_LIMITS.dailyLimit) {
      setSendError(`本日の一括送金回数が上限（${BULK_SEND_LIMITS.dailyLimit}回）に達しました`);
      return;
    }

    // 残高チェック
    const jpycBalance = parseFloat(balances.jpyc.formatted);
    if (totalAmount > jpycBalance) {
      setSendError(`残高不足です（残高: ${jpycBalance} JPYC、必要: ${totalAmount.toFixed(2)} JPYC）`);
      return;
    }

    try {
      setSending(true);
      setSendError(null);

      const erc20Interface = new ethers.utils.Interface(ERC20_MIN_ABI);
      const txHashes: string[] = [];

      // 各受取人へ個別送金
      for (const recipient of recipients) {
        const amountWei = ethers.utils.parseUnits(recipient.amount, 18);
        const normalizedAddress = ethers.utils.getAddress(recipient.address);

        const transferData = erc20Interface.encodeFunctionData('transfer', [
          normalizedAddress,
          amountWei
        ]);

        const tx = await signer.sendTransaction({
          to: JPYC_TOKEN.ADDRESS,
          data: transferData,
          gasLimit: 65000,
        });

        const receipt = await tx.wait();
        txHashes.push(receipt.transactionHash);
        console.log(`Sent to ${normalizedAddress}:`, receipt.transactionHash);
      }

      // 送金回数をインクリメント
      incrementBulkSendCount();

      setSendSuccess(true);
      setRecipients([{ id: nextRecipientId, address: '', amount: '' }]);
      setNextRecipientId(nextRecipientId + 1);

      // 残高を更新
      setTimeout(() => {
        refetchBalances();
      }, 2000);

      // 3秒後にモーダルを閉じる
      setTimeout(() => {
        setShowSendModal(false);
        setSendSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('Bulk send error:', error);
      setSendError(error.message || '一括送金に失敗しました');
    } finally {
      setSending(false);
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
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={refetchBalances}
              style={{
                flex: 1,
                padding: '12px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                color: '#2d3748',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄 残高を更新
            </button>
            <button
              onClick={() => setShowSendModeModal(true)}
              style={{
                flex: 1,
                padding: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              💸 送金タイプを選択
            </button>
          </div>
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

      {/* 送金タイプ選択モーダル */}
      {showSendModeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: 8,
              textAlign: 'center',
            }}>
              💸 送金タイプを選択
            </h2>
            <p style={{
              fontSize: 14,
              color: '#718096',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              送金方法を選んでください
            </p>

            <div style={{ display: 'grid', gap: '16px', marginBottom: 24 }}>
              {/* シンプル送金 */}
              <button
                onClick={() => {
                  setSendMode('simple');
                  setShowSendModeModal(false);
                  setShowSendModal(true);
                }}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>💸</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  シンプル送金
                </div>
                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                  個人アドレスへ自由に送金
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  • 自由なアドレス入力<br />
                  • kodomi記録なし<br />
                  • メッセージ任意
                </div>
              </button>

              {/* 一括送金 */}
              <button
                onClick={() => {
                  setSendMode('bulk');
                  setShowSendModeModal(false);
                  setShowSendModal(true);
                }}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  一括送金
                </div>
                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                  複数人へ同時に送金
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  • 複数アドレス対応<br />
                  • シンプルな操作<br />
                  • 効率的な送金
                </div>
              </button>

              {/* テナントへチップ */}
              <button
                onClick={() => {
                  setSendMode('tenant');
                  setShowSendModeModal(false);
                  setShowTenantModal(true);
                }}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 193, 7, 0.15) 100%)',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '12px',
                  color: '#92400e',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 4px 12px rgba(255,193,7,0.2)',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  テナントへチップ
                </div>
                <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.9 }}>
                  テナントを選んで応援
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  • テナント一覧から選択<br />
                  • kodomi（貢献熱量ポイント）が記録される<br />
                  • 各テナントごとの特典配布が受けられる<br />
                  • メッセージ推奨
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowSendModeModal(false)}
              style={{
                width: '100%',
                padding: '14px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                color: '#2d3748',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 送金モーダル（モード別表示） */}
      {showSendModal && sendMode === 'bulk' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              📤 JPYC一括送金
            </h2>

            {sendSuccess ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <p style={{ fontSize: 18, color: '#059669', fontWeight: 600 }}>
                  一括送金が完了しました！
                </p>
              </div>
            ) : (
              <>
                {/* 制限情報 */}
                <div style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: '8px',
                  marginBottom: 16,
                  fontSize: 13,
                  color: '#1e40af',
                }}>
                  <div>最大送金先: {BULK_SEND_LIMITS.maxRecipients}人</div>
                  <div>本日残り: {BULK_SEND_LIMITS.dailyLimit - getTodayBulkSendCount()}回</div>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSendMode(null);
                      setShowSendModeModal(true);
                    }}
                    style={{
                      marginTop: 8,
                      padding: '4px 12px',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    変更
                  </button>
                </div>

                {/* 受取人リスト */}
                <div style={{ display: 'grid', gap: '12px', marginBottom: 16 }}>
                  {recipients.map((recipient, index) => (
                    <div
                      key={recipient.id}
                      style={{
                        padding: '16px',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        borderRadius: '8px',
                        border: '2px solid #3b82f6',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1e40af' }}>
                          送金先 {index + 1}
                        </span>
                        {recipients.length > 1 && (
                          <button
                            onClick={() => removeRecipient(recipient.id)}
                            style={{
                              padding: '4px 8px',
                              background: '#ef4444',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#ffffff',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            削除
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={recipient.address}
                        onChange={(e) => updateRecipient(recipient.id, 'address', e.target.value)}
                        placeholder="0x..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: 13,
                          fontFamily: 'monospace',
                          border: '2px solid #e2e8f0',
                          borderRadius: '6px',
                          marginBottom: 8,
                          outline: 'none',
                        }}
                      />
                      <input
                        type="number"
                        value={recipient.amount}
                        onChange={(e) => updateRecipient(recipient.id, 'amount', e.target.value)}
                        placeholder="金額"
                        step="0.01"
                        min="0"
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: 14,
                          border: '2px solid #e2e8f0',
                          borderRadius: '6px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* 送金先追加ボタン */}
                {recipients.length < BULK_SEND_LIMITS.maxRecipients && (
                  <button
                    onClick={addRecipient}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'transparent',
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      color: '#64748b',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: 16,
                    }}
                  >
                    + 送金先を追加
                  </button>
                )}

                {/* 合計金額表示 */}
                <div style={{
                  padding: '16px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  marginBottom: 16,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
                    合計送金額
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>
                    {totalAmount.toFixed(2)} JPYC
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    残高: {balances.jpyc.formatted} JPYC
                  </div>
                </div>

                {sendError && (
                  <div style={{
                    padding: '12px',
                    background: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: 14,
                    marginBottom: 16,
                  }}>
                    {sendError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSendMode(null);
                      setRecipients([{ id: nextRecipientId, address: '', amount: '' }]);
                      setNextRecipientId(nextRecipientId + 1);
                      setSendError(null);
                    }}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#2d3748',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: sending ? 0.5 : 1,
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBulkSend}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: sending ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    {sending ? '送金中...' : '一括送金'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* シンプル送金モーダル */}
      {showSendModal && sendMode === 'simple' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              💸 JPYC送金
            </h2>

            {sendSuccess ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <p style={{ fontSize: 18, color: '#059669', fontWeight: 600 }}>
                  送金が完了しました！
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: 8,
                  }}>
                    送金先アドレス
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      placeholder="0x..."
                      style={{
                        flex: 1,
                        padding: '12px',
                        fontSize: 14,
                        fontFamily: 'monospace',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => setShowQRScanner(true)}
                      style={{
                        padding: '12px 16px',
                        background: '#e2e8f0',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: 18,
                      }}
                    >
                      📷
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: 8,
                  }}>
                    金額（JPYC）
                  </label>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: 14,
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  <p style={{
                    fontSize: 12,
                    color: '#718096',
                    marginTop: 4,
                  }}>
                    残高: {balances.jpyc.formatted} JPYC
                  </p>
                </div>

                {sendError && (
                  <div style={{
                    padding: '12px',
                    background: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: 14,
                    marginBottom: 16,
                  }}>
                    {sendError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSendTo('');
                      setSendAmount('');
                      setSendError(null);
                    }}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#2d3748',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: sending ? 0.5 : 1,
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: sending ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    {sending ? '送金中...' : '送金'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* QRスキャナー */}
      {showQRScanner && (
        <QRScannerSimple
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
          placeholder="送金先アドレスを入力"
        />
      )}

      {/* テナント選択モーダル */}
      {showTenantModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: 8,
              textAlign: 'center',
            }}>
              🎁 テナントを選択
            </h2>
            <p style={{
              fontSize: 14,
              color: '#718096',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              チップを送りたいテナントを選んでください
            </p>

            {tenants.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#718096',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <p>フォロー中のテナントがありません</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  テナントをフォローすると、ここに表示されます
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px', marginBottom: 24 }}>
                {tenants.map((tenant) => (
                  <button
                    key={tenant.tenantId}
                    onClick={() => handleTenantSelect(tenant)}
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      border: '2px solid #fbbf24',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: 32 }}>{tenant.icon || '🏪'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#92400e',
                        marginBottom: 4,
                      }}>
                        {tenant.name}
                      </div>
                      {tenant.rank && (
                        <div style={{
                          fontSize: 12,
                          color: '#78350f',
                          opacity: 0.8,
                        }}>
                          ランク: {tenant.rank}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowTenantModal(false);
                if (!selectedTenant) {
                  setSendMode(null);
                }
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                color: '#2d3748',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* テナントチップ送金モーダル */}
      {showSendModal && sendMode === 'tenant' && selectedTenant && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              🎁 {selectedTenant.icon} {selectedTenant.name}へチップ
            </h2>

            {sendSuccess ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <p style={{ fontSize: 18, color: '#059669', fontWeight: 600 }}>
                  チップ送金が完了しました！
                </p>
                <p style={{ fontSize: 14, color: '#78350f', marginTop: 12 }}>
                  kodomiポイントが記録されました
                </p>
              </div>
            ) : (
              <>
                <div style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  borderRadius: '8px',
                  marginBottom: 16,
                  fontSize: 13,
                  color: '#92400e',
                }}>
                  <div>💡 メッセージを書くとkodomi算出に有利になります</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: 8,
                  }}>
                    宛先（自動入力済み）
                  </label>
                  <div style={{
                    padding: '12px',
                    background: '#f7fafc',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: '#64748b',
                    wordBreak: 'break-all',
                  }}>
                    {selectedTenant.walletAddress}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: 8,
                  }}>
                    金額（JPYC）
                  </label>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: 14,
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  <p style={{
                    fontSize: 12,
                    color: '#718096',
                    marginTop: 4,
                  }}>
                    残高: {balances.jpyc.formatted} JPYC
                  </p>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2d3748',
                    marginBottom: 8,
                  }}>
                    メッセージ（任意）
                  </label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder="応援メッセージを入力..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: 14,
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {sendError && (
                  <div style={{
                    padding: '12px',
                    background: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: 14,
                    marginBottom: 16,
                  }}>
                    {sendError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setSendMode(null);
                      setSelectedTenant(null);
                      setSendAmount('');
                      setSendMessage('');
                      setSendError(null);
                    }}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#2d3748',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: sending ? 0.5 : 1,
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: sending ? '#9ca3af' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    {sending ? '送金中...' : 'チップを送る'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
