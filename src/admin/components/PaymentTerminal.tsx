// src/admin/components/PaymentTerminal.tsx
// タブレット専用レジUI - 実店舗向けに最適化

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

export function PaymentTerminal() {
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

  // エクスポート・領収書
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [lastCompletedPayment, setLastCompletedPayment] = useState<PaymentHistory | null>(null);

  // エラー・成功メッセージ
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 決済履歴の自動更新
  useEffect(() => {
    if (!walletAddress) return;

    const fetchRecentPayments = async () => {
      // 最近の決済（5件）
      const { data: recentData } = await supabase
        .from('payment_requests')
        .select('id, request_id, amount, completed_at, completed_by, message, tenant_address')
        .eq('tenant_address', walletAddress.toLowerCase())
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      if (recentData) {
        setRecentPayments(recentData);

        // 最新の完了済み決済を保存（領収書発行用）
        if (recentData.length > 0) {
          setLastCompletedPayment(recentData[0]);
        }
      }

      // すべての決済（エクスポート用）
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

    fetchRecentPayments();

    // 10秒ごとに更新
    const interval = setInterval(fetchRecentPayments, 10000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // テンキー入力
  const handleNumberClick = (num: string) => {
    if (displayAmount === '0') {
      setDisplayAmount(num);
    } else {
      setDisplayAmount(displayAmount + num);
    }
  };

  // クリア
  const handleClear = () => {
    setDisplayAmount('0');
    setAmount('');
    setQrData(null);
    setMessage(null);
  };

  // プリセット金額
  const handlePresetAmount = (presetAmount: number) => {
    setDisplayAmount(presetAmount.toString());
  };

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
      setMessage({ type: 'success', text: 'QRコード生成完了' });

      // 3秒後にメッセージを消す
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
      // Web Share API対応チェック
      if (navigator.share) {
        await navigator.share({
          title: 'JPYC決済アドレス',
          text: `支払先アドレス: ${walletAddress}`,
        });
      } else {
        // フォールバック: クリップボードにコピー
        await navigator.clipboard.writeText(walletAddress);
        setMessage({ type: 'success', text: 'アドレスをコピーしました' });
        setTimeout(() => setMessage(null), 2000);
      }
    } catch (error) {
      // ユーザーがキャンセルした場合など
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('共有エラー:', error);
      }
    }
  };

  // CSVエクスポート
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
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ヘッダー */}
      <header
        style={{
          textAlign: 'center',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid rgba(255,255,255,0.2)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <h1
            style={{
              fontSize: '32px',
              margin: 0,
              fontWeight: 'bold',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <img
              src="/gifterra-logo.png"
              alt="GIFTERRA"
              style={{
                height: '32px',
                width: 'auto',
                verticalAlign: 'middle',
              }}
            />
            <span>GIFTERRA FLOW Terminal</span>
          </h1>
          <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
            {walletAddress ? `店舗: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'ウォレット未接続'}
          </p>
        </div>
      </header>

      {!walletAddress || !walletConfirmed ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 30px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '16px',
            marginTop: '40px',
            maxWidth: '500px',
            margin: '40px auto',
          }}
        >
          {showWalletSelection ? (
            // 別のウォレットに変更モード
            <>
              <h2 style={{ fontSize: '28px', marginBottom: '12px', fontWeight: 'bold' }}>
                ウォレットを接続してください
              </h2>
              <p style={{ opacity: 0.7, marginBottom: '32px', fontSize: '15px' }}>
                レジを使用するにはウォレット接続が必要です
              </p>

              {/* Privyログインボタン（推奨） */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => {
                    if (typeof login === 'function') {
                      login();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  <span style={{ fontSize: '22px' }}>🔐</span>
                  Google / SNS でログイン（推奨）
                </button>
              </div>

              {/* 区切り線 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '24px 0',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent)',
                  }}
                />
                <span
                  style={{
                    padding: '0 16px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                    fontWeight: '600',
                  }}
                >
                  または
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.3), transparent)',
                  }}
                />
              </div>

              {/* ウォレット接続ボタン */}
              <div>
                <ConnectWallet
                  theme="dark"
                  btnTitle="既存ウォレットで接続"
                  modalTitle="ウォレット接続"
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.2s',
                  }}
                />
              </div>
            </>
          ) : (
            // 接続中のウォレットで続行モード
            <>
              <h2 style={{ fontSize: '28px', marginBottom: '12px', fontWeight: 'bold' }}>
                ウォレットを接続してください
              </h2>
              <p style={{ opacity: 0.7, marginBottom: '32px', fontSize: '15px' }}>
                レジを使用するにはウォレット接続が必要です
              </p>

              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => {
                    // 接続中のウォレットで続行
                    setWalletConfirmed(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  接続中のウォレットで続行
                </button>
              </div>

              <button
                onClick={() => setShowWalletSelection(true)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                別のウォレットに変更
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: '20px',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          {/* 左側: 入力エリア */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* プリセット金額 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', opacity: 0.9 }}>よく使う金額</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {[100, 300, 500, 1000, 1500, 2000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetAmount(preset)}
                    style={{
                      padding: '16px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {preset} JPYC
                  </button>
                ))}
              </div>
            </div>

            {/* 金額表示 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>受信金額</div>
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: '#22c55e',
                  textShadow: '0 2px 10px rgba(34, 197, 94, 0.3)',
                }}
              >
                {displayAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC
              </div>
            </div>

            {/* テンキー */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'C'].map((key) => (
                  <button
                    key={key}
                    onClick={() => (key === 'C' ? handleClear() : handleNumberClick(key))}
                    style={{
                      padding: '24px',
                      fontSize: '28px',
                      fontWeight: 'bold',
                      background: key === 'C' ? '#ef4444' : 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                      e.currentTarget.style.background = key === 'C' ? '#dc2626' : 'rgba(255,255,255,0.3)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = key === 'C' ? '#ef4444' : 'rgba(255,255,255,0.2)';
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
                  padding: '20px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(34, 197, 94, 0.3)';
                }}
              >
                QR生成
              </button>

              {/* メッセージ */}
              {message && (
                <div
                  style={{
                    marginTop: '12px',
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
            </div>
          </div>

          {/* 右側: QRコード・履歴エリア */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* QRコード表示 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '30px',
                textAlign: 'center',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {qrData ? (
                <>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>お客様にご提示ください</h3>
                  <div
                    style={{
                      background: 'white',
                      padding: '24px',
                      borderRadius: '16px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                    }}
                  >
                    <QRCodeSVG value={qrData} size={280} level="H" includeMargin={true} />
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>
                    {amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.7 }}>
                    有効期限: {expiryMinutes}分
                  </div>

                  {/* 支払先アドレス表示（タップで共有） */}
                  {walletAddress && (
                    <button
                      onClick={handleShareAddress}
                      style={{
                        marginTop: '16px',
                        padding: '12px 20px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        width: '100%',
                        maxWidth: '350px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
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
                          wordBreak: 'break-all',
                        }}
                      >
                        {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <div style={{ opacity: 0.5 }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>📱</div>
                  <div style={{ fontSize: '18px' }}>金額を入力してQRコードを生成してください</div>
                </div>
              )}
            </div>

            {/* 最近の決済履歴 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>📊 最近の受信履歴</h3>
              {recentPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>決済履歴がありません</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                          {parseInt(payment.amount).toLocaleString()} JPYC
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                          {new Date(payment.completed_at).toLocaleString('ja-JP')}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          opacity: 0.6,
                        }}
                      >
                        {payment.completed_by.slice(0, 8)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* エクスポート・領収書ボタン */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExportModal(true)}
                disabled={allPayments.length === 0}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: allPayments.length > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: allPayments.length > 0 ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${allPayments.length > 0 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  cursor: allPayments.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                📥 受信履歴エクスポート
              </button>
              <button
                onClick={handleShareReceipt}
                disabled={!lastCompletedPayment}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: lastCompletedPayment ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: lastCompletedPayment ? '#22c55e' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${lastCompletedPayment ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  cursor: lastCompletedPayment ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                📄 トランザクションレシート
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
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#fff' }}>📥 受信履歴エクスポート</h2>

            {/* 期間選択 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', marginBottom: '12px', opacity: 0.9, color: '#fff' }}>エクスポート期間</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['today', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setExportPeriod(period)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: exportPeriod === period ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: `2px solid ${exportPeriod === period ? '#3b82f6' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {period === 'today' ? '今日' : period === 'week' ? '今週' : '今月'}
                  </button>
                ))}
              </div>
            </div>

            {/* 集計情報 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              {(() => {
                const filtered = filterPaymentsByPeriod(allPayments, exportPeriod);
                const summary = calculateSummary(filtered);
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#fff' }}>
                      <span style={{ fontSize: '13px', opacity: 0.8 }}>件数</span>
                      <span style={{ fontSize: '16px', fontWeight: '600' }}>{summary.count}件</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#fff' }}>
                      <span style={{ fontSize: '13px', opacity: 0.8 }}>合計受信額</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>
                        {summary.total.toLocaleString()} JPYC
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                      <span style={{ fontSize: '13px', opacity: 0.8 }}>平均受信額</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{summary.average.toLocaleString()} JPYC</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleExportCSV}
                style={{
                  flex: 2,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
                }}
              >
                📥 CSVダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
