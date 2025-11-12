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

  // メッセージ
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // QR生成
  const handleGenerateQR = async () => {
    try {
      if (!walletAddress) {
        setMessage({ type: 'error', text: 'ウォレット未接続' });
        return;
      }

      const amountValue = parseInt(displayAmount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setMessage({ type: 'error', text: '金額を入力してください' });
        return;
      }

      const amountWei = parsePaymentAmount(displayAmount, jpycConfig.decimals);
      const expires = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
      const requestId = generateRequestId();

      const paymentData = encodeX402({
        to: walletAddress,
        token: jpycConfig.currentAddress,
        amount: amountWei,
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
      const result = await shareReceipt(lastCompletedPayment);

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
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
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
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>📊 最近の受信履歴</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentPayments.slice(0, 3).map((payment) => (
                      <div
                        key={payment.id}
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                          {payment.amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7 }}>
                          {new Date(payment.completed_at).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  📥 受信履歴エクスポート
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
                有効期限: {expiryMinutes}分
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
                  📥 受信履歴エクスポート
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
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>合計受信額</div>
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
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>平均受信額</div>
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
