// src/components/X402PaymentSection.tsx
// マイページ用X402決済セクション

import { useState, useEffect } from 'react';
import { useSigner, useAddress } from '@thirdweb-dev/react';
import { usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { QRScannerCamera } from './QRScannerCamera';
import { supabase } from '../lib/supabase';
import { getTokenConfig } from '../config/tokens';
import {
  decodeX402,
  formatPaymentAmount,
  isPaymentExpired,
  getTimeUntilExpiry,
  type X402PaymentData
} from '../utils/x402';

// ERC20 ABI (最小限)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

interface X402PaymentSectionProps {
  isMobile?: boolean;
}

const X402_CONSENT_KEY = 'gifterra_x402_consent_accepted';

export function X402PaymentSection({ isMobile = false }: X402PaymentSectionProps) {
  const thirdwebAddress = useAddress();
  const thirdwebSigner = useSigner();
  const { user, getEthersProvider } = usePrivy();

  // Privyの埋め込みウォレットアドレスを正しく取得
  // Privyの新しいバージョンでは user.wallet に直接格納されている
  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const walletAddress = privyEmbeddedWalletAddress || thirdwebAddress || '';

  // デバッグログ: ウォレット接続状態を確認
  useEffect(() => {
    console.log('🔍 X402PaymentSection - ウォレット接続状態チェック:', {
      hasUser: !!user,
      hasPrivyWallet: !!user?.wallet,
      privyWalletAddress: user?.wallet?.address ? user.wallet.address.substring(0, 10) + '...' : 'なし',
      privyEmbeddedWalletAddress: privyEmbeddedWalletAddress ? privyEmbeddedWalletAddress.substring(0, 10) + '...' : 'なし',
      thirdwebAddress: thirdwebAddress ? thirdwebAddress.substring(0, 10) + '...' : 'なし',
      finalWalletAddress: walletAddress ? walletAddress.substring(0, 10) + '...' : 'なし',

      // 修正案の表示
      recommendation: !walletAddress && thirdwebAddress
        ? 'Thirdwebアドレスが利用可能ですが、walletAddressに設定されていません'
        : walletAddress
        ? 'ウォレット接続OK'
        : 'ウォレット未接続',
    });
  }, [user, privyEmbeddedWalletAddress, thirdwebAddress, walletAddress]);

  // signerの取得: Privyの埋め込みウォレットを使用している場合はPrivyのsignerを使用
  const [privySigner, setPrivySigner] = useState<ethers.Signer | null>(null);

  useEffect(() => {
    const getSigner = async () => {
      console.log('🔍 Signer取得開始:', {
        user: !!user,
        linkedAccounts: user?.linkedAccounts?.length,
        privyWallet: privyEmbeddedWallet,
        privyAddress: privyEmbeddedWalletAddress,
        hasGetEthersProvider: !!getEthersProvider,
      });

      if (privyEmbeddedWalletAddress && getEthersProvider) {
        try {
          console.log('🔄 getEthersProvider呼び出し中...');
          const provider = await getEthersProvider();
          console.log('✅ provider取得:', !!provider);

          if (provider) {
            const web3Provider = new ethers.providers.Web3Provider(provider as any);
            const s = web3Provider.getSigner();
            setPrivySigner(s);
            console.log('✅ Privy signer作成成功:', !!s);

            // signerのアドレスも確認
            if (s) {
              const addr = await s.getAddress();
              console.log('📧 Signer address:', addr);
            }
          }
        } catch (e: any) {
          console.error('❌ Privy signer取得エラー:', e.message, e);
        }
      } else {
        console.warn('⚠️ Privy signer取得条件不足:', {
          hasAddress: !!privyEmbeddedWalletAddress,
          hasProvider: !!getEthersProvider,
        });
      }
    };
    getSigner();
  }, [privyEmbeddedWalletAddress, getEthersProvider, user]);

  // signerの優先順位: Privy signer > Thirdweb signer
  const signer = privySigner || thirdwebSigner;

  const [showScanner, setShowScanner] = useState(false);
  const [paymentData, setPaymentData] = useState<X402PaymentData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const jpycConfig = getTokenConfig('JPYC');

  // デバッグボックスをbodyに直接追加（Reactとは独立）
  useEffect(() => {
    const debugBox = document.createElement('div');
    debugBox.id = 'x402-debug-box';
    debugBox.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: orange;
      color: black;
      padding: 10px;
      z-index: 999999999;
      font-size: 12px;
      font-weight: bold;
      max-width: 200px;
      word-break: break-all;
      pointer-events: none;
    `;
    document.body.appendChild(debugBox);

    return () => {
      const box = document.getElementById('x402-debug-box');
      if (box) box.remove();
    };
  }, []);

  // デバッグボックスの内容を更新
  useEffect(() => {
    const debugBox = document.getElementById('x402-debug-box');
    if (debugBox) {
      debugBox.innerHTML = `
        showScanner: ${showScanner}<br/>
        showConsent: ${showConsentModal}<br/>
        showConfirm: ${showConfirmation}<br/>
        hasData: ${!!paymentData}
      `;
    }
  }, [showScanner, showConsentModal, showConfirmation, paymentData]);

  // QRコードスキャン処理
  const handleScan = async (data: string) => {
    // 永続的なデバッグログ（localStorage + DOM）
    const log = (message: string) => {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
      const logEntry = `[${timestamp}] ${message}`;

      // localStorageに追記
      const existingLogs = localStorage.getItem('qr_scan_debug_log') || '';
      localStorage.setItem('qr_scan_debug_log', existingLogs + '\n' + logEntry);

      // DOM要素に反映（React非依存）
      const debugDiv = document.getElementById('qr-scan-persistent-debug');
      if (debugDiv) {
        const allLogs = (existingLogs + '\n' + logEntry)
          .split('\n')
          .filter(l => l.trim());

        // 最新30行を表示（増やした）
        debugDiv.innerHTML = allLogs.slice(-30).join('<br/>');

        // 自動スクロール（最下部へ）
        debugDiv.scrollTop = debugDiv.scrollHeight;
      }

      console.log(logEntry);
    };

    try {
      log('🚀 handleScan開始');

      // ページリロード防止：早期に記録
      localStorage.setItem('x402_scan_start', new Date().toISOString());

      log('🔍 デコード開始');
      const decoded = decodeX402(data);
      log('✅ デコード成功');

      // 有効期限チェック
      if (isPaymentExpired(decoded.expires)) {
        log('⚠️ 有効期限切れ');
        setMessage({ type: 'error', text: 'このQRコードは有効期限切れです' });
        localStorage.setItem('x402_scan_result', 'expired');
        return;
      }

      // 残高確認
      log('💰 残高確認開始');
      log('  signer:' + !!signer);
      log('  privySigner:' + !!privySigner);
      log('  thirdwebSigner:' + !!thirdwebSigner);
      log('  wallet:' + walletAddress.substring(0, 10) + '...');

      let userBalance = '0';
      let currentSigner = signer;

      // signerがない場合、Privyから取得を試みる
      if (!currentSigner && privyEmbeddedWalletAddress) {
        log('🔄 signer再取得を試みます...');
        log('  privyAddress:' + privyEmbeddedWalletAddress.substring(0, 10) + '...');

        if (getEthersProvider) {
          try {
            log('🔄 getEthersProvider経由でsigner作成を試みます...');
            const provider = await getEthersProvider();
            log('  provider取得:' + !!provider);

            if (provider) {
              const web3Provider = new ethers.providers.Web3Provider(provider as any);
              currentSigner = web3Provider.getSigner();
              log('✅ Web3Provider経由でsigner作成成功:' + !!currentSigner);

              // アドレス確認
              try {
                const addr = await currentSigner.getAddress();
                log('  signer address:' + addr.substring(0, 10) + '...');
              } catch (e: any) {
                log('⚠️ アドレス取得失敗:' + e.message);
              }
            } else {
              log('❌ provider is null');
            }
          } catch (e: any) {
            log('❌ getEthersProvider失敗:' + e.message);
            log('  エラー詳細:' + JSON.stringify(e).substring(0, 50));
          }
        } else {
          log('❌ getEthersProvider is not available');
        }

        if (!currentSigner) {
          log('❌ signer取得失敗');
        }
      } else if (!currentSigner) {
        log('⚠️ signerなし & privyAddressなし');
      }

      if (currentSigner) {
        try {
          log('📄 Contract作成:' + decoded.token.substring(0, 10) + '...');
          const tokenContract = new ethers.Contract(decoded.token, ERC20_ABI, currentSigner);

          log('📞 balanceOf呼び出し');
          const balance = await tokenContract.balanceOf(walletAddress);
          log('✅ balance取得:' + balance.toString());

          log('📞 decimals呼び出し');
          const decimals = await tokenContract.decimals();
          log('✅ decimals取得:' + decimals);

          userBalance = ethers.utils.formatUnits(balance, decimals);
          log('✅ 残高計算完了:' + userBalance);
        } catch (balanceError: any) {
          log('❌ 残高取得エラー:' + balanceError.message);
          log('❌ エラー詳細:' + JSON.stringify(balanceError).substring(0, 100));
        }
      } else {
        log('⚠️ signerなし - 残高取得スキップ');
      }

      // X402形式のQRコードを検知 - 初回同意チェック
      const hasConsented = localStorage.getItem(X402_CONSENT_KEY) === 'true';
      log('📋 同意状態:' + hasConsented);

      // まずpaymentDataとbalanceを設定
      log('📝 状態設定開始');
      localStorage.setItem('x402_scan_result', 'setting_state');
      setPaymentData(decoded);
      setBalance(userBalance);
      setShowScanner(false);
      setMessage({ type: 'info', text: '決済内容を確認してください' });
      log('✅ 状態設定完了');

      localStorage.setItem('x402_scan_result', 'state_set_complete');

      // 次のレンダリングサイクルでモーダルを表示
      // setTimeoutを使ってReactの状態更新を確実に完了させる
      log('⏰ モーダル表示待機中...');
      setTimeout(() => {
        log('📺 モーダル表示開始');
        localStorage.setItem('x402_scan_result', 'showing_modal');
        if (!hasConsented) {
          log('✅ 同意モーダル表示');
          setShowConsentModal(true);
        } else {
          log('✅ 確認モーダル表示');
          setShowConfirmation(true);
        }
        localStorage.setItem('x402_scan_result', 'modal_triggered');
        log('🎉 handleScan完了');
      }, 50);

    } catch (error: any) {
      log('❌ エラー発生:' + error.message);
      localStorage.setItem('x402_scan_result', `error: ${error}`);
      setMessage({ type: 'error', text: 'QRコードの読み取りに失敗しました' });
      setShowScanner(false);
    }
  };

  // 支払い実行
  const handlePayment = async () => {
    if (!paymentData || !signer || !walletAddress) {
      setMessage({ type: 'error', text: 'ウォレットを接続してください' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // トークンコントラクトに接続
      const tokenContract = new ethers.Contract(paymentData.token, ERC20_ABI, signer);

      // 残高確認
      const userBalance = await tokenContract.balanceOf(walletAddress);
      if (userBalance.lt(paymentData.amount)) {
        setMessage({ type: 'error', text: '残高不足です' });
        setIsProcessing(false);
        return;
      }

      // トランザクション送信
      const tx = await tokenContract.transfer(paymentData.to, paymentData.amount);

      setMessage({ type: 'info', text: 'トランザクション送信中...' });

      // トランザクション確認待ち
      await tx.wait();

      // Supabaseの支払いリクエストを更新
      if (paymentData.requestId) {
        await supabase
          .from('payment_requests')
          .update({
            status: 'completed',
            completed_by: walletAddress.toLowerCase(),
            completed_at: new Date().toISOString(),
          })
          .eq('request_id', paymentData.requestId);
      }

      setMessage({ type: 'success', text: '✅ 支払いが完了しました！' });

      // 確認画面を閉じる
      setShowConfirmation(false);

      // 3秒後にリセット
      setTimeout(() => {
        setPaymentData(null);
        setMessage(null);
      }, 3000);

    } catch (error: any) {
      let errorMessage = '支払いに失敗しました';
      if (error.code === 4001) {
        errorMessage = 'トランザクションがキャンセルされました';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'ガス代が不足しています';
      }

      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: isMobile ? '16px' : '20px',
        padding: isMobile ? '16px 20px' : '20px 28px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
      }}
    >
      <div>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: 'bold',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/JPYC-logo.png"
              alt="JPYC"
              style={{
                width: isMobile ? '20px' : '24px',
                height: isMobile ? '20px' : '24px',
              objectFit: 'contain',
            }}
          />
          JPYC送信
          </span>
          <span style={{
            fontSize: isMobile ? '10px' : '11px',
            fontWeight: '600',
            padding: '3px 8px',
            background: 'rgba(255, 193, 7, 0.2)',
            border: '1px solid rgba(255, 193, 7, 0.4)',
            borderRadius: '4px',
            color: '#ffc107',
          }}>
            実装テスト中
          </span>
        </h3>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '10px',
            lineHeight: 1.4,
            color: 'rgba(255,255,255,0.7)',
            opacity: 0.8,
          }}
        >
          このセクションはJPYC送信（x402ベース／互換・独自実装）です。現在のGIFTERRA FLOWプランでは特典配布とは連動しません。取消不可。返金は当事者間の合意により受領者が別送金で対応する場合があります。GIFTERRAは返金の当事者ではありません。
        </p>
      </div>

      {/* QRスキャンボタン - 常に表示 */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setShowScanner(true)}
          disabled={!walletAddress}
          style={{
            width: '100%',
            padding: isMobile ? '14px' : '16px',
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: 'bold',
            background: walletAddress
              ? 'rgba(255,255,255,0.95)'
              : 'rgba(255,255,255,0.3)',
            color: walletAddress ? '#667eea' : '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: walletAddress ? 'pointer' : 'not-allowed',
            boxShadow: walletAddress ? '0 4px 16px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <img
            src="/CAMERA.png"
            alt="camera"
            style={{
              width: isMobile ? '24px' : '28px',
              height: isMobile ? '24px' : '28px',
            }}
          />
          スキャンして送信する
        </button>

        {!walletAddress && (
          <p style={{ marginTop: '12px', fontSize: '13px', opacity: 0.9, color: '#fff' }}>
            ウォレット接続が必要です
          </p>
        )}
      </div>


      {/* メッセージ表示 */}
      {message && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background:
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.2)'
                : message.type === 'error'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(59, 130, 246, 0.2)',
            border: `1px solid ${
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.5)'
                : message.type === 'error'
                ? 'rgba(239, 68, 68, 0.5)'
                : 'rgba(59, 130, 246, 0.5)'
            }`,
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'center',
            color: '#fff',
          }}
        >
          {message.text}
        </div>
      )}

      {/* QRスキャナー */}
      {showScanner && (
        <QRScannerCamera
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          placeholder="X402決済QRコードをスキャン"
        />
      )}

      {/* デバッグ表示 */}
      {showConsentModal && !paymentData && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,
          background: 'red',
          color: 'white',
          padding: 20,
          zIndex: 9999999,
          fontSize: 16,
          fontWeight: 'bold',
        }}>
          エラー: paymentDataがnullです
        </div>
      )}

      {/* 初回同意モーダル (X402検知時) */}
      {showConsentModal && paymentData && (
        <div
          onClick={(e) => {
            // 背景クリックでデバッグ用アラート
            if (e.target === e.currentTarget) {
              alert('同意モーダルが表示されています。内容が見えない場合は画面をスクロールしてください。');
            }
          }}
          style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: isMobile ? 16 : 20,
          overflow: 'auto',
        }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              alert('モーダル本体がクリックされました');
            }}
            style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: 20,
            padding: isMobile ? 24 : 32,
            maxWidth: 600,
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            border: '5px solid #22c55e',
          }}>
            <h2 style={{
              fontSize: isMobile ? 20 : 24,
              marginBottom: 20,
              textAlign: 'center',
              color: '#1a1a1a',
              fontWeight: 700,
            }}>
              JPYC送受信（x402ベース／互換・独自実装）について
            </h2>

            <div style={{
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.8,
              marginBottom: 24,
              color: '#2d3748',
            }}>
              <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
                <li style={{ marginBottom: 12 }}>
                  GIFTERRAは決済事業者ではありません。
                </li>
                <li style={{ marginBottom: 12 }}>
                  この送受信はGIFTERRAの独自実装で、JPYCがx402を公式提供・連携していることを示すものではありません。
                </li>
                <li style={{ marginBottom: 12 }}>
                  FLOWでは特典配布と連動しません。STUDIO有効時は送金完了後に別イベントとして任意のギフティングが行われる場合があります（支払いの対価ではありません）。
                </li>
                <li style={{ marginBottom: 12 }}>
                  送受信は取消できません。返金は当事者間の合意により受領者が別送金で対応することがあります。GIFTERRAは返金の当事者ではありません。
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                fontSize: isMobile ? 13 : 14,
                color: '#1a1a1a',
                fontWeight: 500,
              }}>
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  style={{
                    marginTop: 4,
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                  }}
                />
                <span>
                  同意して続行（
                  <a href="/terms" target="_blank" style={{ color: '#60a5fa', textDecoration: 'underline' }}>利用規約</a>
                  {' / '}
                  <a href="/privacy" target="_blank" style={{ color: '#60a5fa', textDecoration: 'underline' }}>プライバシーポリシー</a>
                  ）
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowConsentModal(false);
                  setPaymentData(null);
                  setConsentAccepted(false);
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
                  localStorage.setItem(X402_CONSENT_KEY, 'true');
                  setShowConsentModal(false);
                  setShowConfirmation(true);
                }}
                disabled={!consentAccepted}
                style={{
                  flex: 2,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: consentAccepted
                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                    : '#e5e7eb',
                  color: consentAccepted ? '#fff' : '#9ca3af',
                  border: 'none',
                  borderRadius: 10,
                  cursor: consentAccepted ? 'pointer' : 'not-allowed',
                  boxShadow: consentAccepted ? '0 4px 16px rgba(34, 197, 94, 0.4)' : 'none',
                }}
              >
                同意して続行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 送信確認モーダル (毎回表示) */}
      {showConfirmation && paymentData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: isMobile ? 16 : 20,
          overflow: 'auto',
        }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              alert('確認モーダル本体がクリックされました');
            }}
            style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: 20,
            padding: isMobile ? 24 : 32,
            maxWidth: 500,
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            border: '5px solid #3b82f6',
          }}>
            <h2 style={{
              fontSize: isMobile ? 18 : 22,
              marginBottom: 16,
              textAlign: 'center',
              color: '#1a1a1a',
              fontWeight: 700,
            }}>
              送信内容の確認
            </h2>

            {/* 金額表示 */}
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '2px solid #86efac',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, marginBottom: 6, color: '#166534', fontWeight: 600 }}>
                送信量
              </div>
              <div style={{ fontSize: isMobile ? 36 : 42, fontWeight: 'bold', color: '#16a34a' }}>
                {formatPaymentAmount(paymentData.amount, jpycConfig.decimals)} JPYC
              </div>
              {/* 法務リスク回避のため、QRコード作成者のメッセージは非表示 */}
              {/* paymentData.message && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#166534' }}>
                  {paymentData.message}
                </div>
              ) */}
            </div>

            {/* 送信先 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>送信先</div>
              <div style={{
                fontSize: 11,
                fontFamily: 'monospace',
                background: '#f3f4f6',
                padding: 10,
                borderRadius: 8,
                wordBreak: 'break-all',
                color: '#374151',
                border: '1px solid #e5e7eb',
              }}>
                {paymentData.to}
              </div>
            </div>

            {/* 残高表示 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>
                あなたの残高
              </div>
              <div style={{ fontSize: 16, fontWeight: '600', color: '#1a1a1a' }}>{balance} JPYC</div>
            </div>

            {/* 有効期限 */}
            {paymentData.expires && (
              <div style={{ marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
                有効期限: 残り {Math.floor(getTimeUntilExpiry(paymentData.expires) / 60)} 分
              </div>
            )}

            {/* 警告テキスト */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 10,
              padding: isMobile ? 12 : 14,
              marginBottom: 20,
              fontSize: isMobile ? 11 : 12,
              lineHeight: 1.6,
              color: '#fca5a5',
              textAlign: 'center',
            }}>
              <strong>取消不可／返金は当事者間の別送金。</strong>
              <br />
              GIFTERRAは返金の当事者ではありません。
              <br />
              （x402ベース／互換・独自実装）
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setPaymentData(null);
                }}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: 10,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                style={{
                  flex: 2,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: isProcessing
                    ? '#d1d5db'
                    : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(34, 197, 94, 0.4)',
                }}
              >
                {isProcessing ? '処理中...' : '💰 送信する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
