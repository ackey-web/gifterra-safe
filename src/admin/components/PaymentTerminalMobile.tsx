// src/admin/components/PaymentTerminalMobile.tsx
// スマホ専用レジUI - モバイルデバイス向けに最適化

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePrivy } from '@privy-io/react-auth';
import { ConnectWallet, useAddress, useDisconnect } from '@thirdweb-dev/react';
import { supabase } from '../../lib/supabase';
import { getTokenConfig } from '../../config/tokens';
import {
  encodeX402,
  parsePaymentAmount,
  generateRequestId,
  validateAddress,
} from '../../utils/x402';
import {
  generateCSV,
  downloadCSV,
  shareReceipt,
  filterPaymentsByPeriod,
  calculateSummary,
} from '../../utils/paymentExport';

interface PaymentHistory {
  id: string;
  request_id: string;
  amount: string;
  completed_at: string;
  completed_by: string;
  message?: string;
  tenant_address: string;
}

export function PaymentTerminalMobile() {
  const { user, login, logout: privyLogout } = usePrivy();
  const thirdwebAddress = useAddress();
  const disconnect = useDisconnect();

  // Privy または Thirdweb のいずれかからウォレットアドレスを取得
  const walletAddress = user?.wallet?.address || thirdwebAddress;

  // 接続中のウォレット情報を状態管理
  const [showWalletSelection, setShowWalletSelection] = useState(false);
  const [walletConfirmed, setWalletConfirmed] = useState(false);

  // JPYC設定を取得
  const jpycConfig = getTokenConfig('JPYC');

  // 金額入力
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('0');

  // QRコード
  const [qrData, setQrData] = useState<string | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState(5);

  // 決済履歴
  const [recentPayments, setRecentPayments] = useState<PaymentHistory[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentHistory[]>([]);
  const [lastCompletedPayment, setLastCompletedPayment] = useState<PaymentHistory | null>(null);

  // エクスポート機能
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'today' | 'week' | 'month'>('today');

  // 店舗名（プロフィールから取得）
  const [storeName, setStoreName] = useState<string | undefined>(undefined);

  // メッセージ
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 設定モーダル
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [presetAmounts, setPresetAmounts] = useState<number[]>([100, 500, 1000, 3000, 5000, 10000]);
  const [tempPresetAmounts, setTempPresetAmounts] = useState<number[]>([100, 500, 1000, 3000, 5000, 10000]);
  const [tempExpiryMinutes, setTempExpiryMinutes] = useState(5);

  // 受信履歴のプライバシー設定
  const [historyPrivacy, setHistoryPrivacy] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const itemsPerPage = 5;

  // テンキー入力
  const handleNumberClick = (num: string) => {
    if (displayAmount === '0') {
      setDisplayAmount(num);
    } else {
      setDisplayAmount(displayAmount + num);
    }
  };

  const handleClear = () => {
    setDisplayAmount('0');
  };

  // 店舗プロフィールの取得
  useEffect(() => {
    if (!walletAddress) return;

    const fetchStoreProfile = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('tenant_id', 'default')
        .single();

      if (data && data.display_name) {
        setStoreName(data.display_name);
      }
    };

    fetchStoreProfile();
  }, [walletAddress]);

  // 決済履歴を取得
  useEffect(() => {
    if (!walletAddress) return;

    const fetchPayments = async () => {
      // 最近の決済5件を取得
      const { data: recentData } = await supabase
        .from('payment_requests')
        .select('id, request_id, amount, completed_at, completed_by, message, tenant_address')
        .eq('tenant_address', walletAddress.toLowerCase())
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      if (recentData) {
        setRecentPayments(recentData);
        if (recentData.length > 0) {
          setLastCompletedPayment(recentData[0]);
        }
      }

      // エクスポート用に全決済履歴を取得
      const { data: allData } = await supabase
        .from('payment_requests')
        .select('id, request_id, amount, completed_at, completed_by, message, tenant_address')
        .eq('tenant_address', walletAddress.toLowerCase())
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (allData) {
        setAllPayments(allData);
      }
    };

    fetchPayments();

    // リアルタイム更新
    const channel = supabase
      .channel('mobile_payment_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_requests',
          filter: `tenant_address=eq.${walletAddress.toLowerCase()}`,
        },
        () => {
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress]);

  // LocalStorageから設定を読み込み
  useEffect(() => {
    try {
      const savedPresets = localStorage.getItem('terminal_preset_amounts');
      const savedExpiry = localStorage.getItem('terminal_qr_expiry');
      const savedPrivacy = localStorage.getItem('terminal_history_privacy');

      if (savedPresets) {
        const parsed = JSON.parse(savedPresets);
        setPresetAmounts(parsed);
        setTempPresetAmounts(parsed);
      }

      if (savedExpiry) {
        const expiryValue = parseInt(savedExpiry);
        setExpiryMinutes(expiryValue);
        setTempExpiryMinutes(expiryValue);
      }

      if (savedPrivacy) {
        setHistoryPrivacy(savedPrivacy === 'true');
      }
    } catch (error) {
      console.error('設定の読み込みエラー:', error);
    }
  }, []);

  // 設定を保存
  const handleSaveSettings = () => {
    try {
      localStorage.setItem('terminal_preset_amounts', JSON.stringify(tempPresetAmounts));
      localStorage.setItem('terminal_qr_expiry', tempExpiryMinutes.toString());

      setPresetAmounts(tempPresetAmounts);
      setExpiryMinutes(tempExpiryMinutes);

      setShowSettingsModal(false);
      setMessage({ type: 'success', text: '設定を保存しました' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('設定の保存エラー:', error);
      setMessage({ type: 'error', text: '設定の保存に失敗しました' });
    }
  };

  // プライバシー設定の保存
  const toggleHistoryPrivacy = () => {
    const newValue = !historyPrivacy;
    setHistoryPrivacy(newValue);
    localStorage.setItem('terminal_history_privacy', newValue.toString());
  };

  // QR生成
  const handleGenerateQR = async () => {
    try {
      if (!walletAddress) {
        setMessage({ type: 'error', text: 'ウォレット未接続' });
        return;
      }

      // EIP-55アドレス検証
      const walletValidation = validateAddress(walletAddress);
      if (!walletValidation.valid) {
        setMessage({ type: 'error', text: walletValidation.error || '受取アドレスが無効です' });
        console.error('🔴 受取アドレス検証失敗:', walletValidation.error);
        return;
      }

      const tokenValidation = validateAddress(jpycConfig.currentAddress);
      if (!tokenValidation.valid) {
        setMessage({ type: 'error', text: 'トークンアドレスが無効です' });
        console.error('🔴 トークンアドレス検証失敗:', tokenValidation.error);
        return;
      }

      console.log('✅ EIP-55検証成功:', {
        wallet: walletValidation.checksumAddress,
        token: tokenValidation.checksumAddress,
      });

      const amountValue = parseInt(displayAmount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setMessage({ type: 'error', text: '金額を入力してください' });
        return;
      }

      const amountWei = parsePaymentAmount(displayAmount, jpycConfig.decimals);
      const expires = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
      const requestId = generateRequestId();

      // チェックサムアドレスを使用
      const paymentData = encodeX402({
        to: walletValidation.checksumAddress!,
        token: tokenValidation.checksumAddress!,
        amount: amountWei,
        chainId: 137, // Polygon Mainnet
        message: `${displayAmount}円のお支払い`,
        expires,
        requestId,
      });

      // Supabaseに保存
      const { error } = await supabase.from('payment_requests').insert({
        request_id: requestId,
        tenant_address: walletAddress.toLowerCase(),
        amount: displayAmount,
        message: `${displayAmount}円のお支払い`,
        expires_at: new Date(expires * 1000).toISOString(),
        status: 'pending',
      });

      if (error) throw error;

      setQrData(paymentData);
      setAmount(displayAmount);
      setMessage({ type: 'success', text: 'QR生成完了' });

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('QR生成エラー:', error);
      setMessage({ type: 'error', text: '生成に失敗しました' });
    }
  };

  // アドレス共有機能
  const handleShareAddress = async () => {
    if (!walletAddress) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'JPYC決済アドレス',
          text: `支払先アドレス: ${walletAddress}`,
        });
      } else {
        await navigator.clipboard.writeText(walletAddress);
        setMessage({ type: 'success', text: 'アドレスをコピーしました' });
        setTimeout(() => setMessage(null), 2000);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('共有エラー:', error);
      }
    }
  };

  // CSV エクスポート
  const handleExportCSV = () => {
    try {
      const filtered = filterPaymentsByPeriod(allPayments, exportPeriod);
      if (filtered.length === 0) {
        setMessage({ type: 'error', text: '指定期間のデータがありません' });
        setTimeout(() => setMessage(null), 2000);
        return;
      }

      const csv = generateCSV(filtered);
      const filename = `jpyc_sales_${exportPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);

      setMessage({ type: 'success', text: `${filtered.length}件のデータをエクスポートしました` });
      setTimeout(() => setMessage(null), 2000);
      setShowExportModal(false);
    } catch (error) {
      console.error('エクスポートエラー:', error);
      setMessage({ type: 'error', text: 'エクスポートに失敗しました' });
    }
  };

  // 領収書発行
  const handleShareReceipt = async () => {
    if (!lastCompletedPayment) {
      setMessage({ type: 'error', text: '発行可能な領収書がありません' });
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    try {
      const result = await shareReceipt(lastCompletedPayment, storeName);

      if (result.success) {
        if (result.fallback) {
          setMessage({ type: 'success', text: '領収書をダウンロードしました' });
        } else if (!result.cancelled) {
          setMessage({ type: 'success', text: '領収書を共有しました' });
        }
        setTimeout(() => setMessage(null), 2000);
      }
    } catch (error) {
      console.error('領収書発行エラー:', error);
      setMessage({ type: 'error', text: 'トランザクションレシート発行に失敗しました' });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
        color: '#fff',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ヘッダー */}
      <header style={{ textAlign: 'center', marginBottom: '24px', position: 'relative' }}>
        {/* 設定ボタン */}
        {walletAddress && walletConfirmed && (
          <button
            onClick={() => {
              setTempPresetAmounts([...presetAmounts]);
              setTempExpiryMinutes(expiryMinutes);
              setShowSettingsModal(true);
            }}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '36px',
              height: '36px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
          >
            ⚙️
          </button>
        )}

        <h1 style={{
          fontSize: '24px',
          margin: '0 0 8px 0',
          fontWeight: 'bold',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <img
              src="/gifterra-logo.png"
              alt="GIFTERRA"
              style={{
                height: '24px',
                width: 'auto',
                verticalAlign: 'middle',
              }}
            />
            <span>GIFTERRA FLOW Terminal</span>
          </span>
        </h1>
        <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>
          {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'ウォレット未接続'}
        </p>
      </header>

      {!walletAddress || !walletConfirmed ? (
        <div style={{
          textAlign: 'center',
          padding: '30px 20px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '16px',
          marginTop: '40px',
          maxWidth: '400px',
          margin: '40px auto',
        }}>
          {showWalletSelection ? (
            // 別のウォレットに変更モード
            <>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔐</div>
              <h2 style={{ fontSize: '24px', marginBottom: '8px', fontWeight: 'bold' }}>
                ウォレットを接続してください
              </h2>
              <p style={{ opacity: 0.7, marginBottom: '24px', fontSize: '14px' }}>
                レジを使用するにはウォレット接続が必要です
              </p>

              {/* Privyログインボタン */}
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => {
                    if (typeof login === 'function') {
                      login();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <span style={{ fontSize: '20px', marginRight: '8px' }}>🔐</span>
                  Google / SNS でログイン
                </button>
              </div>

              {/* 区切り線 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '20px 0',
              }}>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent)',
                }} />
                <span style={{
                  padding: '0 12px',
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: '600',
                }}>
                  または
                </span>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.3), transparent)',
                }} />
              </div>

              {/* ウォレット接続ボタン */}
              <ConnectWallet
                theme="dark"
                btnTitle="既存ウォレットで接続"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              />
            </>
          ) : (
            // 接続中のウォレットで続行モード
            <>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔐</div>
              <h2 style={{ fontSize: '24px', marginBottom: '8px', fontWeight: 'bold' }}>
                ウォレットを接続してください
              </h2>
              <p style={{ opacity: 0.7, marginBottom: '24px', fontSize: '14px' }}>
                レジを使用するにはウォレット接続が必要です
              </p>

              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    // 接続中のウォレットで続行
                    setWalletConfirmed(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  接続中のウォレットで続行
                </button>
              </div>

              <button
                onClick={() => setShowWalletSelection(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                別のウォレットに変更
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          {/* QRコード表示または金額入力 */}
          {!qrData ? (
            <>
              {/* 金額表示 */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>受信金額</div>
                <div
                  style={{
                    fontSize: '48px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: '#22c55e',
                  }}
                >
                  {displayAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC
                </div>
              </div>

              {/* テンキー */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'C'].map((key) => (
                    <button
                      key={key}
                      onClick={() => (key === 'C' ? handleClear() : handleNumberClick(key))}
                      style={{
                        padding: '20px',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        background: key === 'C' ? '#ef4444' : 'rgba(255,255,255,0.2)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        touchAction: 'manipulation',
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>

                {/* QR生成ボタン */}
                <button
                  onClick={handleGenerateQR}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '18px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  QRコード生成
                </button>
              </div>

              {/* 最近の決済 */}
              {recentPayments.length > 0 && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>📊 最近の売上履歴</h3>
                    <button
                      onClick={toggleHistoryPrivacy}
                      style={{
                        width: '32px',
                        height: '32px',
                        background: historyPrivacy ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        border: `1px solid ${historyPrivacy ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation',
                      }}
                    >
                      {historyPrivacy ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                    }}
                  >
                    {recentPayments.slice(historyPage * itemsPerPage, (historyPage + 1) * itemsPerPage).map((payment) => (
                      <div
                        key={payment.id}
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                            {historyPrivacy ? '****' : `${payment.amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC`}
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>
                            {new Date(payment.completed_at).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const result = await shareReceipt(payment, storeName);
                              if (result.success) {
                                if (result.fallback) {
                                  setMessage({ type: 'success', text: '領収書をダウンロードしました' });
                                } else if (!result.cancelled) {
                                  setMessage({ type: 'success', text: '領収書を共有しました' });
                                }
                                setTimeout(() => setMessage(null), 2000);
                              }
                            } catch (error) {
                              console.error('領収書発行エラー:', error);
                              setMessage({ type: 'error', text: 'レシート発行に失敗しました' });
                              setTimeout(() => setMessage(null), 2000);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: 'rgba(34, 197, 94, 0.2)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            touchAction: 'manipulation',
                          }}
                        >
                          📄 レシート発行
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* ページネーション */}
                  {recentPayments.length > itemsPerPage && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                        disabled={historyPage === 0}
                        style={{
                          padding: '8px 12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: historyPage === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                          color: historyPage === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: historyPage === 0 ? 'not-allowed' : 'pointer',
                          touchAction: 'manipulation',
                        }}
                      >
                        ← 前へ
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', opacity: 0.7 }}>
                        {historyPage + 1} / {Math.ceil(recentPayments.length / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setHistoryPage(Math.min(Math.ceil(recentPayments.length / itemsPerPage) - 1, historyPage + 1))}
                        disabled={historyPage >= Math.ceil(recentPayments.length / itemsPerPage) - 1}
                        style={{
                          padding: '8px 12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background:
                            historyPage >= Math.ceil(recentPayments.length / itemsPerPage) - 1
                              ? 'rgba(255,255,255,0.05)'
                              : 'rgba(255,255,255,0.1)',
                          color:
                            historyPage >= Math.ceil(recentPayments.length / itemsPerPage) - 1
                              ? 'rgba(255,255,255,0.3)'
                              : '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor:
                            historyPage >= Math.ceil(recentPayments.length / itemsPerPage) - 1
                              ? 'not-allowed'
                              : 'pointer',
                          touchAction: 'manipulation',
                        }}
                      >
                        次へ →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* エクスポート・領収書ボタン */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={allPayments.length === 0}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: allPayments.length > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                    color: allPayments.length > 0 ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                    border: `1px solid ${allPayments.length > 0 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '10px',
                    cursor: allPayments.length > 0 ? 'pointer' : 'not-allowed',
                    touchAction: 'manipulation',
                  }}
                >
                  📥 売上履歴エクスポート
                </button>
                <button
                  onClick={handleShareReceipt}
                  disabled={!lastCompletedPayment}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: lastCompletedPayment ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                    color: lastCompletedPayment ? '#22c55e' : 'rgba(255,255,255,0.3)',
                    border: `1px solid ${lastCompletedPayment ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '10px',
                    cursor: lastCompletedPayment ? 'pointer' : 'not-allowed',
                    touchAction: 'manipulation',
                  }}
                >
                  📄 トランザクションレシート
                </button>
              </div>
            </>
          ) : (
            // QRコード表示画面
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '24px' }}>お客様にご提示ください</h2>
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  display: 'inline-block',
                }}
              >
                <QRCodeSVG value={qrData} size={240} level="H" includeMargin={true} />
              </div>

              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e', marginBottom: '8px' }}>
                {amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC
              </div>

              <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>
                有効期限: {
                  expiryMinutes >= 1440
                    ? `${Math.floor(expiryMinutes / 1440)}日`
                    : expiryMinutes >= 60
                      ? `${Math.floor(expiryMinutes / 60)}時間`
                      : `${expiryMinutes}分`
                }
              </div>

              {/* 支払先アドレス共有ボタン */}
              {walletAddress && (
                <button
                  onClick={handleShareAddress}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
                    📤 タップして共有 (AirDrop/Nearby Share対応)
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      color: '#3b82f6',
                    }}
                  >
                    {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  setQrData(null);
                  setDisplayAmount('0');
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                新しい請求を作成
              </button>
            </div>
          )}

          {/* メッセージ */}
          {message && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                background: message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {message.text}
            </div>
          )}

          {/* 設定モーダル */}
          {showSettingsModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                zIndex: 1001,
              }}
              onClick={() => setShowSettingsModal(false)}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  maxWidth: '400px',
                  width: '100%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '20px', marginBottom: '20px', textAlign: 'center' }}>
                  ⚙️ ターミナル設定
                </h2>

                {/* よく使う金額の編集 */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '15px', marginBottom: '12px', fontWeight: '600', color: '#fff' }}>
                    よく使う金額（JPYC）
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tempPresetAmounts.map((amount, index) => (
                      <div key={`preset-input-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', minWidth: '24px' }}>
                          {index + 1}.
                        </span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => {
                            const newPresets = [...tempPresetAmounts];
                            newPresets[index] = Math.max(0, parseInt(e.target.value) || 0);
                            setTempPresetAmounts(newPresets);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            fontSize: '14px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            color: '#fff',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* QRコード有効時間 */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '15px', marginBottom: '12px', fontWeight: '600', color: '#fff' }}>
                    QRコード有効時間
                  </div>

                  {/* 対面決済 */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', marginBottom: '8px', color: 'rgba(255,255,255,0.6)' }}>
                      対面決済
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {[3, 5, 10, 15, 30].map((minutes) => (
                        <button
                          key={minutes}
                          onClick={() => setTempExpiryMinutes(minutes)}
                          style={{
                            padding: '10px',
                            fontSize: '13px',
                            fontWeight: '600',
                            background: tempExpiryMinutes === minutes ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: `2px solid ${tempExpiryMinutes === minutes ? '#22c55e' : 'transparent'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            touchAction: 'manipulation',
                          }}
                        >
                          {minutes}分
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* WEB決済 */}
                  <div>
                    <div style={{ fontSize: '12px', marginBottom: '8px', color: 'rgba(255,255,255,0.6)' }}>
                      WEB決済
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        { value: 60, label: '1時間' },
                        { value: 360, label: '6時間' },
                        { value: 1440, label: '24時間' },
                        { value: 4320, label: '72時間' },
                        { value: 10080, label: '7日' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTempExpiryMinutes(option.value)}
                          style={{
                            padding: '10px',
                            fontSize: '13px',
                            fontWeight: '600',
                            background: tempExpiryMinutes === option.value ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: `2px solid ${tempExpiryMinutes === option.value ? '#22c55e' : 'transparent'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            touchAction: 'manipulation',
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ボタン */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    💾 保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* エクスポートモーダル */}
          {showExportModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                zIndex: 1000,
              }}
              onClick={() => setShowExportModal(false)}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  maxWidth: '400px',
                  width: '100%',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '20px', marginBottom: '20px', textAlign: 'center' }}>
                  📥 売上履歴エクスポート
                </h2>

                {/* 期間選択 */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', opacity: 0.8, marginBottom: '8px', display: 'block' }}>
                    エクスポート期間
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(['today', 'week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setExportPeriod(period)}
                        style={{
                          padding: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          background:
                            exportPeriod === period
                              ? 'rgba(59, 130, 246, 0.3)'
                              : 'rgba(255,255,255,0.1)',
                          color: 'white',
                          border: `2px solid ${
                            exportPeriod === period ? '#3b82f6' : 'rgba(255,255,255,0.2)'
                          }`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          touchAction: 'manipulation',
                        }}
                      >
                        {period === 'today' && '今日'}
                        {period === 'week' && '過去7日間'}
                        {period === 'month' && '過去30日間'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* サマリー表示 */}
                {(() => {
                  const filtered = filterPaymentsByPeriod(allPayments, exportPeriod);
                  const summary = calculateSummary(filtered);
                  return (
                    <div
                      style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                      }}
                    >
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>
                        選択期間の受信サマリー
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '12px',
                          marginTop: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>合計売上</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                            {summary.total.toLocaleString()} JPYC
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>件数</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                            {summary.count}件
                          </div>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>平均単価</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                            {summary.average.toLocaleString()} JPYC
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ボタン */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowExportModal(false)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    エクスポート
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
