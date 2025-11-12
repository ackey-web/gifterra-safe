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

// window.ethereum型定義
declare global {
  interface Window {
    ethereum?: any;
  }
}

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
  const { user, getEthersProvider, wallets, sendTransaction, ready } = usePrivy();

  // Privyの埋め込みウォレットアドレスを正しく取得
  // Privyの新しいバージョンでは user.wallet に直接格納されている
  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const walletAddress = privyEmbeddedWalletAddress || thirdwebAddress || '';


  // signerの取得: Privyの埋め込みウォレットを使用している場合はPrivyのsignerを使用
  const [privySigner, setPrivySigner] = useState<ethers.Signer | null>(null);

  useEffect(() => {
    const getSigner = async () => {
      // Privy walletsから直接signerを取得（推奨方法）
      if (wallets && wallets.length > 0 && privyEmbeddedWalletAddress) {
        try {
          const embeddedWallet = wallets[0];
          const provider = await embeddedWallet.getEthersProvider();
          const web3Provider = new ethers.providers.Web3Provider(provider as any);
          const s = web3Provider.getSigner();
          setPrivySigner(s);
          return;
        } catch (e: any) {
          console.error('Privy signer取得エラー:', e.message);
        }
      }

      // フォールバック: 従来のgetEthersProvider方式
      if (getEthersProvider && privyEmbeddedWalletAddress) {
        try {
          const provider = await getEthersProvider();
          if (provider) {
            const web3Provider = new ethers.providers.Web3Provider(provider as any);
            const s = web3Provider.getSigner();
            setPrivySigner(s);
          }
        } catch (e: any) {
          console.error('getEthersProvider signer取得エラー:', e.message);
        }
      }
    };
    getSigner();
  }, [privyEmbeddedWalletAddress, getEthersProvider, user, wallets]);

  // signerの優先順位: Privy signer > Thirdweb signer > window.ethereum
  const [fallbackSigner, setFallbackSigner] = useState<ethers.Signer | null>(null);

  // フォールバック: window.ethereumから直接signerを取得
  useEffect(() => {
    const getFallbackSigner = async () => {
      if (privySigner || thirdwebSigner) {
        return;
      }

      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum as any);
          const s = provider.getSigner();
          setFallbackSigner(s);
        } catch (e: any) {
          console.error('window.ethereum signer取得エラー:', e.message);
        }
      }
    };
    getFallbackSigner();
  }, [privySigner, thirdwebSigner]);

  const signer = privySigner || thirdwebSigner || fallbackSigner;

  const [showScanner, setShowScanner] = useState(false);
  const [paymentData, setPaymentData] = useState<X402PaymentData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const jpycConfig = getTokenConfig('JPYC');


  // QRコードスキャン処理
  const handleScan = async (data: string) => {
    try {
      const decoded = decodeX402(data);

      // 有効期限チェック
      if (isPaymentExpired(decoded.expires)) {
        setMessage({ type: 'error', text: 'このQRコードは有効期限切れです' });
        return;
      }

      // 残高確認（read-only providerを使用）
      let userBalance = '0';

      try {
        const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
        const tokenContract = new ethers.Contract(decoded.token, ERC20_ABI, readOnlyProvider);

        const balance = await tokenContract.balanceOf(walletAddress);
        const decimals = await tokenContract.decimals();

        userBalance = ethers.utils.formatUnits(balance, decimals);
      } catch (balanceError: any) {
        console.error('残高取得エラー:', balanceError.message);
        userBalance = '0';
      }

      // X402形式のQRコードを検知 - 初回同意チェック
      const hasConsented = localStorage.getItem(X402_CONSENT_KEY) === 'true';

      // paymentDataとbalanceを設定
      setPaymentData(decoded);
      setBalance(userBalance);
      setShowScanner(false);
      setMessage({ type: 'info', text: '決済内容を確認してください' });

      // 次のレンダリングサイクルでモーダルを表示
      setTimeout(() => {
        if (!hasConsented) {
          setShowConsentModal(true);
        } else {
          setShowConfirmation(true);
        }
      }, 50);

    } catch (error: any) {
      console.error('QRコード読み取りエラー:', error.message);
      setMessage({ type: 'error', text: 'QRコードの読み取りに失敗しました' });
      setShowScanner(false);
    }
  };

  // 支払い実行
  const handlePayment = async () => {
    if (!paymentData || !walletAddress) {
      setMessage({ type: 'error', text: 'ウォレットを接続してください' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // 残高確認用のread-only provider
      const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
      const tokenContract = new ethers.Contract(paymentData.token, ERC20_ABI, readOnlyProvider);

      // 残高確認
      const userBalance = await tokenContract.balanceOf(walletAddress);

      if (userBalance.lt(paymentData.amount)) {
        setMessage({ type: 'error', text: '残高不足です' });
        setIsProcessing(false);
        return;
      }

      // トランザクションデータを構築
      const transferData = tokenContract.interface.encodeFunctionData('transfer', [
        paymentData.to,
        paymentData.amount
      ]);

      let txHash: string;

      // Privy埋め込みウォレットの場合はPrivy sendTransactionを使用
      if (privyEmbeddedWalletAddress && sendTransaction) {
        const txRequest = {
          to: paymentData.token,
          data: transferData,
          value: '0x0',
          chainId: 137, // Polygon Mainnet
        };

        const result = await sendTransaction(txRequest);
        txHash = result.transactionHash;
      } else if (signer) {
        // 通常のsigner (MetaMask等)
        const tokenContractWithSigner = new ethers.Contract(paymentData.token, ERC20_ABI, signer);
        const tx = await tokenContractWithSigner.transfer(paymentData.to, paymentData.amount);
        txHash = tx.hash;

        setMessage({ type: 'info', text: 'トランザクション送信中...' });
        await tx.wait();
      } else {
        throw new Error('署名方法が利用できません');
      }

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
      setIsProcessing(false);

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
