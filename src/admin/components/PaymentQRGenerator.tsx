// src/admin/components/PaymentQRGenerator.tsx
// テナント向け決済QRコード生成コンポーネント

import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { supabase } from '../../lib/supabase';
import { getTokenConfig } from '../../config/tokens';
import { encodeX402, parsePaymentAmount, generateRequestId } from '../../utils/x402';
import { isGaslessPaymentEnabled } from '../../config/features';
import { generateNonce } from '../../utils/eip3009';
import type { AuthorizationQRData } from '../../types/qrPayment';
import { JPYC_TOKEN, ERC20_MIN_ABI } from '../../contract';

export function PaymentQRGenerator() {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(5);
  const [qrData, setQrData] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isMobile] = useState(window.innerWidth < 768);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingGenerateData, setPendingGenerateData] = useState<{ amount: string; message: string; expiryMinutes: number } | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // 新規: ガスレス決済の状態
  const [useGasless, setUseGasless] = useState(false);
  const [isGaslessAvailable, setIsGaslessAvailable] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isExecutingGasless, setIsExecutingGasless] = useState(false);

  // ハンバーガーメニュー関連
  const [showMenu, setShowMenu] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // バッチ処理関連
  const [pendingSignatures, setPendingSignatures] = useState<any[]>([]);
  const [batchProcessingEnabled, setBatchProcessingEnabled] = useState(false);

  const { user } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address || wallets[0]?.address || '';

  const jpycConfig = getTokenConfig('JPYC');

  // ガスレス機能が使えるかチェック
  useEffect(() => {
    if (walletAddress) {
      const available = isGaslessPaymentEnabled(walletAddress);
      setIsGaslessAvailable(available);
      console.log('⚡ Gasless payment available:', available);
    }
  }, [walletAddress]);

  // Supabase Realtime: 署名受信を監視してtransferWithAuthorizationを実行
  useEffect(() => {
    if (!currentRequestId || !walletAddress) return;

    console.log('👂 Realtime subscription started for:', currentRequestId);

    const channel = supabase
      .channel(`payment_request:${currentRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_requests',
          filter: `request_id=eq.${currentRequestId}`,
        },
        async (payload) => {
          console.log('📨 Realtime update received:', payload);

          const newRecord = payload.new as any;

          // 署名が受信されたらtransferWithAuthorizationを実行
          if (newRecord.status === 'signature_received' && !isExecutingGasless) {
            console.log('✅ Signature received!');

            // バッチ処理モードの場合はキューに追加
            if (batchProcessingEnabled) {
              console.log('📦 Adding to batch queue...');
              setPendingSignatures(prev => [...prev, newRecord]);
              alert(`📦 署名をキューに追加しました (${pendingSignatures.length + 1}件待機中)`);
              return;
            }

            // 即時実行モード
            console.log('⚡ Executing immediately...');
            setIsExecutingGasless(true);

            try {
              // Signerを取得
              const wallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
              if (!wallet) {
                throw new Error('ウォレットが見つかりません');
              }

              await wallet.switchChain(137); // Polygon Mainnet
              const ethereumProvider = await wallet.getEthereumProvider();
              const provider = new ethers.providers.Web3Provider(ethereumProvider);
              const signer = provider.getSigner();

              // JPYC コントラクト
              const jpycContract = new ethers.Contract(JPYC_TOKEN.ADDRESS, ERC20_MIN_ABI, signer);

              // transferWithAuthorization を実行
              const tx = await jpycContract.transferWithAuthorization(
                newRecord.completed_by,     // from
                walletAddress,              // to (店舗)
                newRecord.value || ethers.utils.parseUnits(newRecord.amount, 18), // value
                0,                          // validAfter
                newRecord.valid_before || Math.floor(Date.now() / 1000) + 3600,   // validBefore
                newRecord.nonce,            // nonce
                newRecord.signature_v,      // v
                newRecord.signature_r,      // r
                newRecord.signature_s       // s
              );

              console.log('⏳ Transaction sent:', tx.hash);
              const receipt = await tx.wait();
              console.log('✅ Transaction confirmed:', receipt.transactionHash);

              // ステータスを完了に更新
              await supabase
                .from('payment_requests')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('request_id', currentRequestId);

              alert('✅ ガスレス決済が完了しました！');

              // リセット
              setCurrentRequestId(null);
              setQrData(null);

            } catch (error: any) {
              console.error('❌ transferWithAuthorization error:', error);
              alert(`❌ 決済の実行に失敗しました: ${error.message}`);

              // エラー状態に更新
              await supabase
                .from('payment_requests')
                .update({ status: 'cancelled' })
                .eq('request_id', currentRequestId);
            } finally {
              setIsExecutingGasless(false);
            }
          }
        }
      )
      .subscribe();

    // クリーンアップ
    return () => {
      console.log('🔌 Realtime subscription closed');
      supabase.removeChannel(channel);
    };
  }, [currentRequestId, walletAddress, wallets, isExecutingGasless, batchProcessingEnabled, pendingSignatures]);

  // バッチ処理: 複数の署名をまとめて実行
  const executeBatch = async () => {
    if (pendingSignatures.length === 0) {
      alert('実行する署名がありません');
      return;
    }

    const batchSize = pendingSignatures.length;
    const confirmed = window.confirm(
      `📦 ${batchSize}件の署名をまとめて実行します。\n\n推定ガス代削減: 約${Math.round((batchSize - 1) * 0.15)}円\n\n実行しますか？`
    );

    if (!confirmed) return;

    setIsExecutingGasless(true);

    try {
      // Signerを取得
      const wallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
      if (!wallet) {
        throw new Error('ウォレットが見つかりません');
      }

      await wallet.switchChain(137); // Polygon Mainnet
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.providers.Web3Provider(ethereumProvider);
      const signer = provider.getSigner();

      // JPYC コントラクト
      const jpycContract = new ethers.Contract(JPYC_TOKEN.ADDRESS, ERC20_MIN_ABI, signer);

      let successCount = 0;
      let failCount = 0;

      // 各署名を順次実行
      for (const record of pendingSignatures) {
        try {
          console.log(`📤 Executing ${successCount + 1}/${batchSize}...`);

          const tx = await jpycContract.transferWithAuthorization(
            record.completed_by,
            walletAddress,
            record.value || ethers.utils.parseUnits(record.amount, 18),
            0,
            record.valid_before || Math.floor(Date.now() / 1000) + 3600,
            record.nonce,
            record.signature_v,
            record.signature_r,
            record.signature_s
          );

          await tx.wait();
          console.log(`✅ Transaction confirmed: ${tx.hash}`);

          // ステータスを完了に更新
          await supabase
            .from('payment_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('request_id', record.request_id);

          successCount++;
        } catch (error: any) {
          console.error(`❌ Failed for request ${record.request_id}:`, error);
          failCount++;

          // エラー状態に更新
          await supabase
            .from('payment_requests')
            .update({ status: 'cancelled' })
            .eq('request_id', record.request_id);
        }
      }

      // キューをクリア
      setPendingSignatures([]);

      alert(`✅ バッチ処理完了\n\n成功: ${successCount}件\n失敗: ${failCount}件`);

    } catch (error: any) {
      console.error('❌ Batch execution error:', error);
      alert(`❌ バッチ処理に失敗しました: ${error.message}`);
    } finally {
      setIsExecutingGasless(false);
    }
  };

  const handleGenerate = async () => {
    setError('');

    // バリデーション
    if (!amount || parseFloat(amount) <= 0) {
      setError('金額を入力してください');
      return;
    }

    if (!walletAddress) {
      setError('ウォレットに接続してください');
      return;
    }

    // WEB決済（60分以上）の場合は確認モーダルを表示
    if (expiryMinutes >= 60) {
      setPendingGenerateData({ amount, message, expiryMinutes });
      setShowConfirmModal(true);
      return;
    }

    // ガスレスモードかどうかで分岐
    if (useGasless && isGaslessAvailable) {
      await executeGenerateGasless(amount, message, expiryMinutes);
    } else {
      await executeGenerate(amount, message, expiryMinutes);
    }
  };

  const executeGenerate = async (amt: string, msg: string, expiry: number) => {
    setError('');
    setIsGenerating(true);

    try {
      const amountWei = parsePaymentAmount(amt, jpycConfig.decimals);
      const expires = Math.floor(Date.now() / 1000) + (expiry * 60);
      const requestId = generateRequestId();

      // X402形式でエンコード
      const paymentData = encodeX402({
        to: walletAddress,
        token: jpycConfig.currentAddress,
        amount: amountWei,
        chainId: 137, // Polygon Mainnet
        message: msg || undefined,
        expires,
        requestId,
      });

      setQrData(paymentData);

      // Supabaseに記録
      const { error: dbError } = await supabase
        .from('payment_requests')
        .insert({
          request_id: requestId,
          tenant_address: walletAddress.toLowerCase(),
          amount: amt,
          message: msg || null,
          expires_at: new Date(expires * 1000).toISOString(),
          status: 'pending',
        });

      if (dbError) {
        console.error('Failed to save payment request:', dbError);
        // エラーでもQRは表示（記録は任意）
      }

    } catch (err: any) {
      console.error('QR generation error:', err);
      setError(err.message || 'QRコードの生成に失敗しました');
    } finally {
      setIsGenerating(false);
      setShowConfirmModal(false);
    }
  };

  // 新規: ガスレスQR生成
  const executeGenerateGasless = async (amt: string, msg: string, expiry: number) => {
    setError('');
    setIsGenerating(true);

    try {
      const amountWei = parsePaymentAmount(amt, jpycConfig.decimals);
      const nonce = generateNonce();
      const validBefore = Math.floor(Date.now() / 1000) + (expiry * 60);
      const requestId = generateRequestId();

      console.log('⚡ Generating gasless payment QR:', {
        amount: amt,
        nonce: nonce.substring(0, 10) + '...',
        validBefore,
        requestId,
      });

      // AuthorizationQRData を生成
      const qrData: AuthorizationQRData = {
        type: 'authorization',
        to: walletAddress,
        value: amountWei,
        validBefore,
        nonce,
        chainId: 137,
        storeName: msg || '店舗', // メッセージを店舗名として使用
        requestId,
      };

      setQrData(JSON.stringify(qrData));

      // Supabaseに記録（署名待機状態）
      const { error: dbError } = await supabase
        .from('payment_requests')
        .insert({
          request_id: requestId,
          tenant_address: walletAddress.toLowerCase(),
          amount: amt,
          message: msg || null,
          expires_at: new Date(validBefore * 1000).toISOString(),
          status: 'awaiting_signature',
          payment_type: 'authorization',
          nonce: nonce,
        });

      if (dbError) {
        console.error('Failed to save gasless payment request:', dbError);
        // エラーでもQRは表示（記録は任意）
      } else {
        console.log('✅ Gasless payment request saved:', requestId);
        // リクエストIDを保存してRealtime購読を開始
        setCurrentRequestId(requestId);
      }

    } catch (err: any) {
      console.error('Gasless QR generation error:', err);
      setError(err.message || 'ガスレスQRコードの生成に失敗しました');
    } finally {
      setIsGenerating(false);
      setShowConfirmModal(false);
    }
  };

  // QRコードダウンロード機能
  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // SVGをPNGに変換してダウンロード
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `jpyc-payment-${amount}JPY-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleReset = () => {
    setAmount('');
    setMessage('');
    setQrData(null);
    setError('');
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
        borderRadius: isMobile ? 16 : 20,
        padding: isMobile ? 20 : 32,
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* ヘッダー: タイトル + ハンバーガーメニュー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        position: 'relative'
      }}>
        <h2
          style={{
            margin: 0,
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            color: '#EAF2FF',
          }}
        >
          💳 決済QRコード生成
        </h2>

        {/* ハンバーガーメニューボタン */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 8,
            padding: isMobile ? '8px 12px' : '10px 14px',
            cursor: 'pointer',
            color: '#3b82f6',
            fontSize: isMobile ? 18 : 20,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
          }}
        >
          ☰
        </button>

        {/* ドロップダウンメニュー */}
        {showMenu && (
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 45 : 50,
              right: 0,
              background: 'linear-gradient(135deg, #1e1e2e 0%, #2a2a3c 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              minWidth: 220,
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                setShowAnalytics(true);
              }}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#EAF2FF',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              📊 分析ダッシュボード
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                setShowNotificationSettings(true);
              }}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#EAF2FF',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              🔔 通知設定
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                // 既存の設定ボタンと同じ動作は後で実装
              }}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'transparent',
                border: 'none',
                color: '#EAF2FF',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ⚙️ 設定
            </button>
          </div>
        )}
      </div>

      {/* バッチ処理コントロール */}
      {isGaslessAvailable && (
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: pendingSignatures.length > 0 ? 12 : 0,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: '#10b981',
              }}
            >
              <input
                type="checkbox"
                checked={batchProcessingEnabled}
                onChange={(e) => setBatchProcessingEnabled(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              📦 バッチ処理モード
            </label>

            {pendingSignatures.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: '#10b981',
                    fontWeight: 600,
                  }}
                >
                  {pendingSignatures.length}件待機中
                </span>
                <button
                  onClick={executeBatch}
                  disabled={isExecutingGasless}
                  style={{
                    padding: '8px 16px',
                    background: isExecutingGasless
                      ? 'rgba(148, 163, 184, 0.3)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isExecutingGasless ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isExecutingGasless ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isExecutingGasless) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExecutingGasless) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {isExecutingGasless ? '実行中...' : '⚡ まとめて実行'}
                </button>
              </div>
            )}
          </div>

          {batchProcessingEnabled && (
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: 1.5,
                marginTop: 8,
              }}
            >
              💡 署名をキューに追加し、まとめて実行することでガス代を削減できます
            </div>
          )}
        </div>
      )}

      {!qrData ? (
        <div>
          {/* 金額入力 */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                color: '#EAF2FF',
              }}
            >
              金額 (JPYC) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 1500"
              step="0.01"
              min="0"
              style={{
                width: '100%',
                padding: isMobile ? '12px' : '14px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 16 : 18,
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>

          {/* メモ入力 */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                color: '#EAF2FF',
              }}
            >
              メモ（任意）
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="例: コーヒー x 2"
              maxLength={50}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '12px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
                outline: 'none',
              }}
            />
          </div>

          {/* 有効期限 */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                color: '#EAF2FF',
              }}
            >
              有効期限
            </label>
            <select
              value={expiryMinutes}
              onChange={(e) => setExpiryMinutes(Number(e.target.value))}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '12px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
                outline: 'none',
              }}
            >
              <optgroup label="対面決済">
                <option value={3}>3分</option>
                <option value={5}>5分（デフォルト）</option>
                <option value={10}>10分</option>
                <option value={15}>15分</option>
                <option value={30}>30分</option>
              </optgroup>
              <optgroup label="WEB決済">
                <option value={60}>1時間</option>
                <option value={360}>6時間</option>
                <option value={1440}>24時間</option>
                <option value={4320}>72時間</option>
                <option value={10080}>7日</option>
              </optgroup>
            </select>
          </div>

          {/* ガスレス決済オプション（フィーチャーフラグで制御） */}
          {isGaslessAvailable && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useGasless}
                  onChange={(e) => setUseGasless(e.target.checked)}
                />
                <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#EAF2FF' }}>
                  ⚡ ガスレス決済（ユーザーはガス代不要）
                  <span style={{
                    marginLeft: 8,
                    padding: '2px 6px',
                    background: '#10b981',
                    color: '#fff',
                    fontSize: 10,
                    borderRadius: 4,
                    fontWeight: 600
                  }}>
                    BETA
                  </span>
                </span>
              </label>
              <p style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
                marginTop: 4,
                marginLeft: 24
              }}>
                ユーザーはJPYCだけで決済可能。店舗がガス代を負担します（約0.2円/回）
              </p>
            </div>
          )}

          {/* エラーメッセージ */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#fca5a5',
                fontSize: isMobile ? 13 : 14,
              }}
            >
              {error}
            </div>
          )}

          {/* 生成ボタン */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '16px',
              background: isGenerating
                ? 'rgba(100, 100, 100, 0.3)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? '生成中...' : '✨ QRコードを生成'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          {/* QRコード表示 */}
          <div
            ref={qrRef}
            style={{
              background: '#fff',
              padding: isMobile ? 20 : 24,
              borderRadius: 12,
              display: 'inline-block',
              marginBottom: 20,
            }}
          >
            <QRCodeSVG
              value={qrData}
              size={isMobile ? 250 : 300}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* 金額表示 */}
          <div
            style={{
              marginBottom: 20,
              padding: isMobile ? '16px' : '20px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 28 : 36,
                fontWeight: 700,
                color: '#60a5fa',
                marginBottom: 8,
              }}
            >
              {amount} JPYC
            </div>
            {message && (
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {message}
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                fontSize: isMobile ? 11 : 12,
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              有効期限: {
                expiryMinutes >= 1440
                  ? `${Math.floor(expiryMinutes / 1440)}日`
                  : expiryMinutes >= 60
                    ? `${Math.floor(expiryMinutes / 60)}時間`
                    : `${expiryMinutes}分`
              }
            </div>
          </div>

          {/* ボタングループ */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <button
              onClick={handleDownloadQR}
              style={{
                flex: 1,
                padding: isMobile ? '12px' : '14px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📥 QRコードをダウンロード
            </button>
          </div>

          {/* リセットボタン */}
          <button
            onClick={handleReset}
            style={{
              width: '100%',
              padding: isMobile ? '12px' : '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔄 新しいQRを生成
          </button>
        </div>
      )}

      {/* WEB決済確認モーダル */}
      {showConfirmModal && pendingGenerateData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 16 : 24,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              border: '3px solid #f59e0b',
            }}
          >
            <h2
              style={{
                fontSize: isMobile ? 18 : 20,
                marginBottom: 16,
                textAlign: 'center',
                color: '#1a1a1a',
                fontWeight: 700,
              }}
            >
              ⚠️ WEB決済用QRコード生成確認
            </h2>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '2px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 12,
                padding: isMobile ? 16 : 20,
                marginBottom: 20,
                fontSize: isMobile ? 13 : 14,
                lineHeight: 1.8,
                color: '#1a1a1a',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontWeight: 600 }}>
                このコードはJPYC送受信リンクです。
              </p>
              <p style={{ margin: 0 }}>
                取引内容や請求情報にはGIFTERRAは関与しません。
              </p>
            </div>

            <div
              style={{
                marginBottom: 20,
                padding: isMobile ? 14 : 16,
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 10,
                fontSize: isMobile ? 13 : 14,
                color: '#1a1a1a',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong>金額:</strong> {pendingGenerateData.amount} JPYC
              </div>
              {pendingGenerateData.message && (
                <div style={{ marginBottom: 8 }}>
                  <strong>メモ:</strong> {pendingGenerateData.message}
                </div>
              )}
              <div>
                <strong>有効期限:</strong>{' '}
                {pendingGenerateData.expiryMinutes >= 1440
                  ? `${Math.floor(pendingGenerateData.expiryMinutes / 1440)}日`
                  : `${Math.floor(pendingGenerateData.expiryMinutes / 60)}時間`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingGenerateData(null);
                }}
                style={{
                  flex: 1,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  if (pendingGenerateData) {
                    executeGenerate(
                      pendingGenerateData.amount,
                      pendingGenerateData.message,
                      pendingGenerateData.expiryMinutes
                    );
                  }
                }}
                style={{
                  flex: 2,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                }}
              >
                確認して生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分析ダッシュボードモーダル */}
      {showAnalytics && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20,
          }}
          onClick={() => setShowAnalytics(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e1e2e 0%, #2a2a3c 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              maxWidth: 700,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: isMobile ? 20 : 24,
                fontWeight: 700,
                color: '#EAF2FF',
              }}>
                📊 分析ダッシュボード
              </h3>
              <button
                onClick={() => setShowAnalytics(false)}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#ef4444',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ color: '#EAF2FF', lineHeight: 1.8 }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 16,
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
                  💳 決済統計
                </h4>
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>総決済数:</strong> 準備中
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>ガスレス決済:</strong> 準備中
                  </div>
                  <div>
                    <strong>成功率:</strong> 準備中
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 16,
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
                  ⚡ ガスレス決済分析
                </h4>
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>利用ユーザー数:</strong> 準備中
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>平均ガス代削減:</strong> 準備中
                  </div>
                  <div>
                    <strong>バッチ処理待ち:</strong> 準備中
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>
                ※ 分析機能は今後のアップデートで実装予定です
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 通知設定モーダル */}
      {showNotificationSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20,
          }}
          onClick={() => setShowNotificationSettings(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e1e2e 0%, #2a2a3c 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              maxWidth: 600,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: isMobile ? 20 : 24,
                fontWeight: 700,
                color: '#EAF2FF',
              }}>
                🔔 通知設定
              </h3>
              <button
                onClick={() => setShowNotificationSettings(false)}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#ef4444',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ color: '#EAF2FF' }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  marginBottom: 12,
                }}>
                  <input type="checkbox" defaultChecked style={{ width: 18, height: 18 }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      署名受信通知
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      ユーザーが署名を送信したときに通知
                    </div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  marginBottom: 12,
                }}>
                  <input type="checkbox" defaultChecked style={{ width: 18, height: 18 }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      決済完了通知
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      トランザクション確認後に通知
                    </div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}>
                  <input type="checkbox" style={{ width: 18, height: 18 }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      エラー通知
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      決済失敗時に音声アラート
                    </div>
                  </div>
                </label>
              </div>

              <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>
                ※ 通知設定は今後のアップデートで実装予定です
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
