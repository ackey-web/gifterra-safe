// src/admin/components/PaymentTerminal.tsx
// タブレット専用レジUI - 実店舗向けに最適化

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ConnectWallet, useAddress, useDisconnect } from '@thirdweb-dev/react';
import { ethers } from 'ethers';
import { supabase } from '../../lib/supabase';
import { getTokenConfig } from '../../config/tokens';
import { JPYC_TOKEN, ERC20_MIN_ABI } from '../../contract';
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
import { isGaslessPaymentEnabled } from '../../config/featureFlags';

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
  const { user, login } = usePrivy();
  const { wallets } = useWallets();
  const thirdwebAddress = useAddress();

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
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [qrMode, setQrMode] = useState<'invoice' | 'wallet'>('invoice'); // 請求書 or ウォレット
  const [expiryMinutes, setExpiryMinutes] = useState(5);
  const qrRef = useRef<HTMLDivElement>(null);

  // WEB決済確認モーダル
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingGenerateData, setPendingGenerateData] = useState<{
    amount: string;
  } | null>(null);

  // 決済履歴
  const [recentPayments, setRecentPayments] = useState<PaymentHistory[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentHistory[]>([]);

  // エクスポート・領収書
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [lastCompletedPayment, setLastCompletedPayment] = useState<PaymentHistory | null>(null);

  // 店舗名（プロフィールから取得）
  const [storeName, setStoreName] = useState<string | undefined>(undefined);

  // エラー・成功メッセージ
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 設定モーダル
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [presetAmounts, setPresetAmounts] = useState<number[]>([100, 300, 500, 1000, 1500, 2000]);
  const [tempPresetAmounts, setTempPresetAmounts] = useState<number[]>([100, 300, 500, 1000, 1500, 2000]);
  const [tempExpiryMinutes, setTempExpiryMinutes] = useState(5);

  // 受信履歴のプライバシー設定
  const [historyPrivacy, setHistoryPrivacy] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const itemsPerPage = 5;

  // ☰ ハンバーガーメニュー（Phase 5）
  const [showMenu, setShowMenu] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // ⚡ ガスレス決済（Phase 5）
  const [useGasless, setUseGasless] = useState(false); // ガスレス決済を使用するか
  const [isGaslessAvailable] = useState(isGaslessPaymentEnabled()); // 機能フラグ
  const [isExecutingGasless, setIsExecutingGasless] = useState(false);
  const [pendingSignatures, setPendingSignatures] = useState<any[]>([]); // 署名待ちキュー
  const [batchProcessingEnabled, setBatchProcessingEnabled] = useState(false); // バッチ処理モード

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

  // 決済履歴の自動更新
  useEffect(() => {
    if (!walletAddress) return;

    const fetchRecentPayments = async () => {
      // 最近の決済（5件）- 請求書QR & ウォレットQR両方
      const { data: recentData } = await supabase
        .from('payment_requests')
        .select('id, request_id, amount, completed_at, completed_by, message, tenant_address, payment_type, transaction_hash')
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

      // すべての決済（エクスポート用）- 請求書QR & ウォレットQR両方
      const { data: allData } = await supabase
        .from('payment_requests')
        .select('id, request_id, amount, completed_at, completed_by, message, tenant_address, payment_type, transaction_hash')
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

  // ⚡ Supabase Realtime: ガスレス決済の署名受信監視（Phase 5）
  useEffect(() => {
    if (!currentRequestId || !walletAddress || !isGaslessAvailable) return;

    console.log('📡 Realtime subscription started for:', currentRequestId);

    const channel = supabase
      .channel(`gasless_payment:${currentRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_requests',
          filter: `request_id=eq.${currentRequestId}`,
        },
        async (payload) => {
          const newRecord = payload.new as any;
          console.log('📬 Realtime UPDATE received:', newRecord);

          if (newRecord.status === 'signature_received' && !isExecutingGasless) {
            // バッチ処理モードの場合はキューに追加
            if (batchProcessingEnabled) {
              console.log('📦 Adding to batch queue...');
              setPendingSignatures((prev) => [...prev, newRecord]);
              setMessage({
                type: 'success',
                text: `📦 署名をキューに追加 (${pendingSignatures.length + 1}件待機中)`,
              });
              setTimeout(() => setMessage(null), 3000);
              return;
            }

            // 即時実行モード
            setIsExecutingGasless(true);

            try {
              const wallet = wallets.find(
                (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
              );
              if (!wallet) {
                throw new Error('ウォレットが見つかりません');
              }

              console.log('🔄 Switching to Polygon...');
              await wallet.switchChain(137);

              const ethereumProvider = await wallet.getEthereumProvider();
              const provider = new ethers.providers.Web3Provider(ethereumProvider);
              const signer = provider.getSigner();

              console.log('📝 Creating contract instance...');
              const jpycContract = new ethers.Contract(
                JPYC_TOKEN.ADDRESS,
                ERC20_MIN_ABI,
                signer
              );

              console.log('⚡ Executing transferWithAuthorization...');
              const tx = await jpycContract.transferWithAuthorization(
                newRecord.completed_by,
                walletAddress,
                newRecord.value || ethers.utils.parseUnits(newRecord.amount, 18),
                0,
                newRecord.valid_before || Math.floor(Date.now() / 1000) + 3600,
                newRecord.nonce,
                newRecord.signature_v,
                newRecord.signature_r,
                newRecord.signature_s
              );

              console.log('⏳ Waiting for confirmation...');
              const receipt = await tx.wait();
              console.log('✅ Transaction confirmed:', receipt.transactionHash);

              // Supabaseのステータスを更新
              await supabase
                .from('payment_requests')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  transaction_hash: receipt.transactionHash,
                })
                .eq('request_id', currentRequestId);

              setMessage({ type: 'success', text: '✅ ガスレス決済完了！' });
              setTimeout(() => setMessage(null), 3000);

              // QRをクリア
              setQrData(null);
              setCurrentRequestId(null);
            } catch (error: any) {
              console.error('❌ Gasless execution error:', error);
              setMessage({ type: 'error', text: `❌ 実行失敗: ${error.message}` });

              // エラー時はキャンセル扱い
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

    return () => {
      console.log('📡 Realtime subscription cleanup');
      supabase.removeChannel(channel);
    };
  }, [
    currentRequestId,
    walletAddress,
    wallets,
    isExecutingGasless,
    batchProcessingEnabled,
    pendingSignatures.length,
    isGaslessAvailable,
  ]);

  // 📦 バッチ実行関数（Phase 5）
  const executeBatch = async () => {
    if (pendingSignatures.length === 0) {
      setMessage({ type: 'error', text: '実行する署名がありません' });
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    const batchSize = pendingSignatures.length;
    const confirmed = window.confirm(
      `📦 ${batchSize}件の署名をまとめて実行します。\n\n推定ガス代削減: 約${Math.round((batchSize - 1) * 0.15)}円\n\n実行しますか？`
    );

    if (!confirmed) return;
    setIsExecutingGasless(true);

    try {
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
      );
      if (!wallet) throw new Error('ウォレットが見つかりません');

      await wallet.switchChain(137);
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.providers.Web3Provider(ethereumProvider);
      const signer = provider.getSigner();

      const jpycContract = new ethers.Contract(JPYC_TOKEN.ADDRESS, ERC20_MIN_ABI, signer);

      let successCount = 0;
      let failCount = 0;

      for (const record of pendingSignatures) {
        try {
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
          const receipt = await tx.wait();

          await supabase
            .from('payment_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              transaction_hash: receipt.transactionHash,
            })
            .eq('request_id', record.request_id);

          successCount++;
        } catch (error: any) {
          console.error(`❌ Failed for request ${record.request_id}:`, error);
          failCount++;

          await supabase
            .from('payment_requests')
            .update({ status: 'cancelled' })
            .eq('request_id', record.request_id);
        }
      }

      setPendingSignatures([]);
      setMessage({
        type: 'success',
        text: `✅ バッチ処理完了\n\n成功: ${successCount}件\n失敗: ${failCount}件`,
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('❌ Batch execution error:', error);
      setMessage({ type: 'error', text: `❌ バッチ処理失敗: ${error.message}` });
    } finally {
      setIsExecutingGasless(false);
    }
  };

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

  // QR生成（WEB決済チェック付き）
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

      // WEB決済（60分以上）の場合は確認モーダルを表示
      if (expiryMinutes >= 60) {
        setPendingGenerateData({ amount: displayAmount });
        setShowConfirmModal(true);
        return;
      }

      // 対面決済の場合はそのまま生成
      await executeGenerateQR(displayAmount);
    } catch (error) {
      console.error('QR生成エラー:', error);
      setMessage({ type: 'error', text: '生成に失敗しました' });
    }
  };

  // QR生成実行
  const executeGenerateQR = async (amountToGenerate: string) => {
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

      const amountWei = parsePaymentAmount(amountToGenerate, jpycConfig.decimals);
      const expires = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
      const requestId = generateRequestId();

      // ⚡ ガスレス決済モード（Phase 5）
      if (useGasless && isGaslessAvailable) {
        console.log('⚡ [Desktop] Generating gasless payment QR...');

        // EIP-3009用の32バイトnonce生成
        const nonce = '0x' + Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

        console.log('⚡ [Desktop] Generated nonce:', nonce);

        // ガスレス決済用QRデータ
        const gaslessQRData = JSON.stringify({
          type: 'gasless',
          tenant: walletValidation.checksumAddress,
          token: tokenValidation.checksumAddress,
          amount: amountWei,
          chainId: 137,
          message: `${amountToGenerate}円のお支払い（ガスレス）`,
          expires,
          requestId,
          nonce,
          validAfter: 0,
          validBefore: expires,
        });

        console.log('⚡ [Desktop] QR data prepared:', gaslessQRData.substring(0, 100) + '...');

        // Supabaseに保存（ガスレス用フィールド付き）
        const insertData = {
          request_id: requestId,
          tenant_address: walletAddress.toLowerCase(),
          amount: amountToGenerate,
          message: `${amountToGenerate}円のお支払い（ガスレス）`,
          expires_at: new Date(expires * 1000).toISOString(),
          status: 'awaiting_signature',
          payment_type: 'authorization',
          nonce,
          valid_after: 0,
          valid_before: expires,
        };

        console.log('⚡ [Desktop] Inserting to Supabase:', insertData);

        const { error } = await supabase.from('payment_requests').insert(insertData);

        if (error) {
          console.error('❌ [Desktop] Supabase insert error:', error);
          console.error('❌ [Desktop] Error code:', error.code);
          console.error('❌ [Desktop] Error message:', error.message);
          console.error('❌ [Desktop] Error details:', error.details);
          console.error('❌ [Desktop] Error hint:', error.hint);
          setMessage({ type: 'error', text: `生成失敗: ${error.message}` });
          throw error;
        }

        console.log('✅ [Desktop] Gasless QR successfully saved to Supabase');

        setQrData(gaslessQRData);
        setAmount(amountToGenerate);
        setCurrentRequestId(requestId);
        setMessage({ type: 'success', text: '⚡ ガスレスQR生成完了（署名待ち）' });

        setTimeout(() => setMessage(null), 3000);
        return;
      }

      // 通常の決済QR生成（X402）
      const paymentData = encodeX402({
        to: walletValidation.checksumAddress!,
        token: tokenValidation.checksumAddress!,
        amount: amountWei,
        chainId: 137, // Polygon Mainnet
        message: `${amountToGenerate}円のお支払い`,
        expires,
        requestId,
      });

      // Supabaseに保存
      const { error } = await supabase.from('payment_requests').insert({
        request_id: requestId,
        tenant_address: walletAddress.toLowerCase(),
        amount: amountToGenerate,
        message: `${amountToGenerate}円のお支払い`,
        expires_at: new Date(expires * 1000).toISOString(),
        status: 'pending',
        payment_type: 'invoice',
      });

      if (error) throw error;

      setQrData(paymentData);
      setAmount(amountToGenerate);
      setMessage({ type: 'success', text: 'QRコード生成完了' });

      // 3秒後にメッセージを消す
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('QR生成エラー:', error);
      setMessage({ type: 'error', text: '生成に失敗しました' });
    }
  };


  // QRコードダウンロード
  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    try {
      // SVGをシリアライズ
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Canvasのサイズを設定
        canvas.width = img.width;
        canvas.height = img.height;

        // 背景を白に設定
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }

        // PNGとしてダウンロード
        canvas.toBlob((blob) => {
          if (!blob) return;

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `jpyc-payment-${amount}JPY-${Date.now()}.png`;
          link.href = url;
          link.click();

          URL.revokeObjectURL(url);

          setMessage({ type: 'success', text: 'QRコードをダウンロードしました' });
          setTimeout(() => setMessage(null), 2000);
        });
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('QRダウンロードエラー:', error);
      setMessage({ type: 'error', text: 'ダウンロードに失敗しました' });
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
          position: 'relative',
        }}
      >
        {/* ☰ ハンバーガーメニューボタン（Phase 5） */}
        {walletAddress && walletConfirmed && (
          <>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '44px',
                height: '44px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ☰
            </button>

            {/* ドロップダウンメニュー */}
            {showMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '54px',
                  right: 0,
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  zIndex: 100,
                  minWidth: '220px',
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
                    color: '#fff',
                    fontSize: '15px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
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
                    color: '#fff',
                    fontSize: '15px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
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
                    setTempPresetAmounts([...presetAmounts]);
                    setTempExpiryMinutes(expiryMinutes);
                    setShowSettingsModal(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '15px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ⚙️ 設定
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <h1
            onClick={() => window.location.href = '/mypage'}
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
              cursor: 'pointer',
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
                {presetAmounts.map((preset, index) => (
                  <button
                    key={`preset-${index}`}
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
              <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>お支払い金額</div>
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

              {/* ⚡ ガスレス決済チェックボックス（Phase 5） */}
              {isGaslessAvailable && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '10px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: '600',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={useGasless}
                      onChange={(e) => {
                        setUseGasless(e.target.checked);
                        if (!e.target.checked) {
                          setBatchProcessingEnabled(false);
                        }
                      }}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                      }}
                    />
                    ⚡ ガスレス決済（ガス代店舗負担）
                  </label>

                  {/* バッチ処理モード */}
                  {useGasless && (
                    <div style={{ marginTop: '12px', paddingLeft: '26px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={batchProcessingEnabled}
                          onChange={(e) => setBatchProcessingEnabled(e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                          }}
                        />
                        📦 バッチ処理モード（複数署名まとめて実行）
                      </label>

                      {/* バッチ処理キュー表示 */}
                      {batchProcessingEnabled && pendingSignatures.length > 0 && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>
                            ⏳ {pendingSignatures.length}件待機中
                            <span style={{ fontSize: '12px', opacity: 0.8, marginLeft: '6px' }}>
                              (約{Math.round((pendingSignatures.length - 1) * 0.15)}円節約)
                            </span>
                          </span>
                          <button
                            onClick={executeBatch}
                            disabled={isExecutingGasless}
                            style={{
                              padding: '6px 14px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              background: isExecutingGasless
                                ? 'rgba(107, 114, 128, 0.5)'
                                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isExecutingGasless ? 'not-allowed' : 'pointer',
                              boxShadow: isExecutingGasless
                                ? 'none'
                                : '0 2px 8px rgba(245, 158, 11, 0.3)',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isExecutingGasless ? '実行中...' : '⚡ まとめて実行'}
                          </button>
                        </div>
                      )}

                      {/* バッチ処理説明 */}
                      <p
                        style={{
                          fontSize: '12px',
                          opacity: 0.7,
                          marginTop: '8px',
                          marginBottom: 0,
                          lineHeight: '1.5',
                        }}
                      >
                        💡 署名を受信しても即座に実行せず、キューに追加します。
                        複数の署名をまとめて実行することでガス代を削減できます。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* QR生成ボタン（デュアルモード） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={handleGenerateQR}
                  style={{
                    width: '100%',
                    padding: '20px',
                    fontSize: '20px',
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
                  📄 決済QR生成
                </button>

              </div>

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

                  {/* QRモード説明 */}
                  <div
                    style={{
                      background: qrMode === 'wallet'
                        ? 'rgba(59, 130, 246, 0.1)'
                        : 'rgba(34, 197, 94, 0.1)',
                      border: qrMode === 'wallet'
                        ? '1px solid rgba(59, 130, 246, 0.2)'
                        : '1px solid rgba(34, 197, 94, 0.2)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      maxWidth: '400px',
                    }}
                  >
                    📄 <strong>請求書QR</strong><br />
                    このQRは、GIFTERRA Pay で読み取り・お支払いできます。<br />
                    GIFTERRAマイページの「スキャンして支払う」からご利用ください。
                  </div>

                  <div
                    ref={qrRef}
                    style={{
                      background: 'white',
                      padding: '24px',
                      borderRadius: '16px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                    }}
                  >
                    <QRCodeSVG value={qrData} size={280} level="H" includeMargin={true} />
                  </div>

                  {/* 請求書モード: 金額と有効期限を表示 */}
                  {qrMode === 'invoice' && (
                    <>
                      <div style={{ marginTop: '20px', fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>
                        {amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} JPYC
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.7 }}>
                        有効期限: {
                          expiryMinutes >= 1440
                            ? `${Math.floor(expiryMinutes / 1440)}日`
                            : expiryMinutes >= 60
                              ? `${Math.floor(expiryMinutes / 60)}時間`
                              : `${expiryMinutes}分`
                        }
                      </div>
                    </>
                  )}

                  {/* ウォレットモード: 店舗名を表示 */}
                  {qrMode === 'wallet' && (
                    <div style={{ marginTop: '20px', fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {storeName || 'GIFTERRA店舗'}
                    </div>
                  )}

                  {/* QRコードダウンロードボタン */}
                  <button
                    onClick={handleDownloadQR}
                    style={{
                      marginTop: '16px',
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                    }}
                  >
                    📥 QRコードをダウンロード
                  </button>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>📊 最近の売上履歴</h3>
                <button
                  onClick={toggleHistoryPrivacy}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: historyPrivacy ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${historyPrivacy ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = historyPrivacy ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = historyPrivacy ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                  }}
                  title={historyPrivacy ? '金額を表示' : '金額を非表示'}
                >
                  {historyPrivacy ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {recentPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>決済履歴がありません</div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '320px',
                      overflowY: 'auto',
                    }}
                  >
                    {recentPayments.slice(historyPage * itemsPerPage, (historyPage + 1) * itemsPerPage).map((payment) => (
                      <div
                        key={payment.id}
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>
                            {historyPrivacy ? '****' : `${parseInt(payment.amount).toLocaleString()} JPYC`}
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
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: 'rgba(34, 197, 94, 0.2)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
                          }}
                        >
                          📄 レシート
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
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: historyPage === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                          color: historyPage === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: historyPage === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ← 前へ
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', fontSize: '12px', opacity: 0.7 }}>
                        {historyPage + 1} / {Math.ceil(recentPayments.length / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setHistoryPage(Math.min(Math.ceil(recentPayments.length / itemsPerPage) - 1, historyPage + 1))}
                        disabled={historyPage >= Math.ceil(recentPayments.length / itemsPerPage) - 1}
                        style={{
                          padding: '8px 16px',
                          fontSize: '12px',
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
                        }}
                      >
                        次へ →
                      </button>
                    </div>
                  )}
                </>
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
                📥 売上履歴エクスポート
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

      {/* 設定モーダル */}
      {showSettingsModal && (
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
            zIndex: 1001,
          }}
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '550px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#fff' }}>⚙️ ターミナル設定</h2>

            {/* よく使う金額の編集 */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '16px', marginBottom: '12px', fontWeight: '600', color: '#fff' }}>
                よく使う金額（JPYC）
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {tempPresetAmounts.map((amount, index) => (
                  <div key={`preset-input-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', minWidth: '30px' }}>
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
                        fontSize: '15px',
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
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '16px', marginBottom: '12px', fontWeight: '600', color: '#fff' }}>
                QRコード有効時間
              </div>

              {/* 対面決済 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', marginBottom: '8px', color: 'rgba(255,255,255,0.6)' }}>
                  対面決済
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[3, 5, 10, 15, 30].map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => setTempExpiryMinutes(minutes)}
                      style={{
                        flex: '1 1 calc(20% - 8px)',
                        minWidth: '70px',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: tempExpiryMinutes === minutes ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: `2px solid ${tempExpiryMinutes === minutes ? '#22c55e' : 'transparent'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {minutes}分
                    </button>
                  ))}
                </div>
              </div>

              {/* WEB決済 */}
              <div>
                <div style={{ fontSize: '13px', marginBottom: '8px', color: 'rgba(255,255,255,0.6)' }}>
                  WEB決済
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                        flex: '1 1 calc(20% - 8px)',
                        minWidth: '90px',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: tempExpiryMinutes === option.value ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: `2px solid ${tempExpiryMinutes === option.value ? '#22c55e' : 'transparent'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
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
                onClick={handleSaveSettings}
                style={{
                  flex: 2,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(34, 197, 94, 0.4)',
                }}
              >
                💾 保存
              </button>
            </div>
          </div>
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
            padding: 20,
          }}
          onClick={() => {
            setShowConfirmModal(false);
            setPendingGenerateData(null);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              maxWidth: 600,
              width: '100%',
              padding: 32,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              border: '3px solid #f59e0b',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: '0 0 20px 0',
                fontSize: 24,
                fontWeight: 700,
                color: '#1a1a1a',
                textAlign: 'center',
              }}
            >
              ⚠️ WEB決済用QRコード生成確認
            </h2>

            <div
              style={{
                background: 'rgba(249, 115, 22, 0.1)',
                border: '2px solid rgba(249, 115, 22, 0.3)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#f59e0b',
                  lineHeight: 1.6,
                }}
              >
                このコードはJPYC送受信リンクです。
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  color: '#1a1a1a',
                  lineHeight: 1.6,
                }}
              >
                取引内容や請求情報にはGIFTERRAは関与しません。
              </p>
            </div>

            <div
              style={{
                background: '#f3f4f6',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: '#6b7280',
                    marginBottom: 4,
                    fontWeight: 600,
                  }}
                >
                  お支払い金額
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#22c55e',
                  }}
                >
                  {parseInt(pendingGenerateData.amount).toLocaleString()} JPYC
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#6b7280',
                    marginBottom: 4,
                    fontWeight: 600,
                  }}
                >
                  有効期限
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1a1a1a',
                  }}
                >
                  {expiryMinutes >= 1440
                    ? `${Math.floor(expiryMinutes / 1440)}日`
                    : expiryMinutes >= 60
                      ? `${Math.floor(expiryMinutes / 60)}時間`
                      : `${expiryMinutes}分`}
                </div>
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
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 600,
                  background: '#f3f4f6',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  setShowConfirmModal(false);
                  const dataToGenerate = pendingGenerateData;
                  setPendingGenerateData(null);
                  await executeGenerateQR(dataToGenerate.amount);
                }}
                style={{
                  flex: 2,
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.4)';
                }}
              >
                確認して生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 分析ダッシュボード モーダル（Phase 5） */}
      {showAnalytics && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 1002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowAnalytics(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#fff', fontWeight: 'bold' }}>
              📊 分析ダッシュボード
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
              売上分析、決済トレンド、顧客インサイトなどの機能は今後のアップデートで追加予定です。
            </p>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.6' }}>
                <strong>🚀 予定機能:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>日次・週次・月次売上レポート</li>
                  <li>決済方法別統計</li>
                  <li>ピークタイム分析</li>
                  <li>リアルタイム売上ダッシュボード</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowAnalytics(false)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 🔔 通知設定 モーダル（Phase 5） */}
      {showNotificationSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 1002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowNotificationSettings(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#fff', fontWeight: 'bold' }}>
              🔔 通知設定
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
              プッシュ通知、メール通知、Slack連携などの機能は今後のアップデートで追加予定です。
            </p>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.6' }}>
                <strong>🚀 予定機能:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>決済完了時のプッシュ通知</li>
                  <li>日次売上サマリーメール</li>
                  <li>高額決済アラート</li>
                  <li>Slack/Discord連携</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationSettings(false)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              閉じる
            </button>
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
            <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#fff' }}>📥 売上履歴エクスポート</h2>

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
                      <span style={{ fontSize: '13px', opacity: 0.8 }}>合計売上</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>
                        {summary.total.toLocaleString()} JPYC
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                      <span style={{ fontSize: '13px', opacity: 0.8 }}>平均単価</span>
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
