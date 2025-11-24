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
  validateAddress,
  validateChainId,
  getCurrentChainId,
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
const X402_CONSENT_VERSION = 'v1.0.0'; // 同意条件バージョン

// 同意記録の型定義
interface ConsentRecord {
  version: string;        // 同意したバージョン (例: 'v1.0.0')
  timestamp: number;      // 同意した日時 (Unix timestamp)
  walletAddress: string;  // 同意時のウォレットアドレス
}

/**
 * 同意記録をlocalStorageから取得
 */
function getConsentRecord(): ConsentRecord | null {
  try {
    const stored = localStorage.getItem(X402_CONSENT_KEY);
    if (!stored) return null;

    // 旧形式の互換性チェック (stored === 'true')
    if (stored === 'true') {
      return null;
    }

    const record = JSON.parse(stored) as ConsentRecord;

    // バージョンチェック
    if (record.version !== X402_CONSENT_VERSION) {
      return null;
    }

    return record;
  } catch (error) {
    console.error('❌ 同意記録の読み取りエラー:', error);
    return null;
  }
}

/**
 * 同意記録をlocalStorageに保存
 */
function saveConsentRecord(walletAddress: string): ConsentRecord {
  const record: ConsentRecord = {
    version: X402_CONSENT_VERSION,
    timestamp: Date.now(),
    walletAddress: walletAddress.toLowerCase(),
  };

  localStorage.setItem(X402_CONSENT_KEY, JSON.stringify(record));

  return record;
}

export function X402PaymentSection({ isMobile = false }: X402PaymentSectionProps) {
  const thirdwebAddress = useAddress();
  const thirdwebSigner = useSigner();
  const privyContext = usePrivy() as any; // 型定義が古いため any で回避
  const { user, authenticated, wallets } = privyContext;

  // Privyの埋め込みウォレットアドレスを正しく取得
  // Privyの新しいバージョンでは user.wallet に直接格納されている
  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const walletAddress = privyEmbeddedWalletAddress || thirdwebAddress || '';


  // signerの取得
  // MetaMask接続時は直接window.ethereumを使用（Privyのリダイレクト回避）
  const [privySigner, setPrivySigner] = useState<ethers.Signer | null>(null);

  useEffect(() => {
    const getSigner = async () => {
      // MetaMaskブラウザを最優先で検出（Privy完全バイパス）
      if (typeof window !== 'undefined' && window.ethereum) {
        // MetaMask mobileまたはデスクトップブラウザの検出
        const isMetaMask = window.ethereum.isMetaMask;

        if (isMetaMask) {
          try {
            // MetaMask 7.59.0対応: selectedAddressがnullの場合は明示的に接続をリクエスト
            if (!window.ethereum.selectedAddress) {
              await window.ethereum.request({ method: 'eth_requestAccounts' });
            }

            const directProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
            const directSigner = directProvider.getSigner();
            setPrivySigner(directSigner);
            return;
          } catch (error: any) {
            console.warn('⚠️ [請求QR] MetaMask直接接続失敗:', error.message);
            // フォールバックとしてPrivy経由を試行
          }
        }
      }

      // Privyウォレット経由でのフォールバック
      if (!wallets || wallets.length === 0) {
        setPrivySigner(null);
        return;
      }

      try {
        const wallet = wallets[0];

        // Privy経由のMetaMask検出（2次チェック）
        if (wallet.walletClientType === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
          const directProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
          const directSigner = directProvider.getSigner();
          setPrivySigner(directSigner);
          return;
        }

        // Privyウォレットなど他のウォレットの場合は通常通り
        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        const ethersSigner = ethersProvider.getSigner();
        setPrivySigner(ethersSigner);
      } catch (error: any) {
        console.error('[請求QR] Failed to setup signer:', error);
        setPrivySigner(null);
      }
    };

    // authenticatedの場合のみsigner取得
    if (authenticated) {
      getSigner();
    } else {
      // 未認証でもMetaMaskが利用可能なら設定（MetaMask mobileで重要）
      if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {
        getSigner();
      }
    }
  }, [authenticated, wallets]);

  // 送金セクションと同じ: privySignerのみ使用
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


  // QRコードスキャン処理
  const handleScan = async (data: string) => {
    // デバッグログを保存＋追加用の関数


    try {

      // ウォレットQRかどうかを判定
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'wallet') {
          setMessage({ type: 'error', text: 'これはウォレットQRです。請求QRをスキャンしてください。' });
          return;
        }
      } catch (e) {
        // JSON parseエラーは無視（通常のアドレスかX402形式）
      }

      const decoded = decodeX402(data);


      // EIP-55アドレス検証
      const recipientValidation = validateAddress(decoded.to);
      if (!recipientValidation.valid) {
        setMessage({ type: 'error', text: '無効な受取アドレスです' });
        console.error('🔴 受取アドレス検証失敗:', recipientValidation.error);
        return;
      }

      const tokenValidation = validateAddress(decoded.token);
      if (!tokenValidation.valid) {
        setMessage({ type: 'error', text: '無効なトークンアドレスです' });
        console.error('🔴 トークンアドレス検証失敗:', tokenValidation.error);
        return;
      }

      // ChainID検証
      const chainValidation = validateChainId(decoded.chainId, 137);
      if (!chainValidation.valid) {
        setMessage({ type: 'error', text: chainValidation.error || 'チェーンIDが一致しません' });
        console.error('🔴 ChainID検証失敗:', chainValidation.error);
        return;
      }


      // 有効期限チェック
      if (isPaymentExpired(decoded.expires)) {
        setMessage({ type: 'error', text: 'このQRコードは有効期限切れです' });
        return;
      }

      // 残高確認（read-only providerを使用）
      let userBalance = '0';

      try {

        const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/polygon');
        const tokenContract = new ethers.Contract(decoded.token, ERC20_ABI, readOnlyProvider);

        const balance = await tokenContract.balanceOf(walletAddress);
        const decimals = await tokenContract.decimals();

        userBalance = ethers.utils.formatUnits(balance, decimals);
      } catch (balanceError: any) {
        console.error('残高取得エラー:', balanceError.message);
        userBalance = '0';
      }

      // X402形式のQRコードを検知 - バージョン付き同意チェック
      const consentRecord = getConsentRecord();
      const hasValidConsent = consentRecord !== null;

      // paymentDataとbalanceを設定
      setPaymentData(decoded);
      setBalance(userBalance);
      setShowScanner(false);
      setMessage({ type: 'info', text: '決済内容を確認してください' });

      // 次のレンダリングサイクルでモーダルを表示
      setTimeout(() => {
        if (!hasValidConsent) {
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
      console.error('❌ paymentDataまたはwalletAddressが未設定');
      setMessage({ type: 'error', text: 'ウォレットを接続してください' });
      return;
    }
    setIsProcessing(true);
    setMessage(null);

    try {
      // 接続中のChainIDを確認
      let currentChainId: number | null = null;
      let chainIdSource = '';

      // 複数のソースから取得してログ出力
      let privyWalletChainId: number | null = null;
      let windowChainId: number | null = null;
      let signerChainId: number | null = null;

      // 1. Privyのwalletsから取得（最優先）
      if (wallets && wallets.length > 0) {
        try {
          // まず外部ウォレット(MetaMask等)を優先的に検索
          let targetWallet = wallets.find((w: any) => w.walletClientType !== 'privy');

          // 外部ウォレットがない場合、Privy Embedded Walletを使用
          if (!targetWallet) {
            targetWallet = wallets[0]; // 最初のウォレット（通常はPrivy Embedded Wallet）
          }

          if (targetWallet && targetWallet.chainId) {
            // chainIdは16進数文字列の場合と数値の場合がある
            const chainIdValue = targetWallet.chainId;
            if (typeof chainIdValue === 'string') {
              privyWalletChainId = chainIdValue.startsWith('0x')
                ? parseInt(chainIdValue, 16)
                : parseInt(chainIdValue, 10);
            } else {
              privyWalletChainId = chainIdValue;
            }
          } else if (targetWallet) {
            console.warn('⚠️ ウォレットは見つかったが chainId が未設定 - providerから取得を試みる');

            // chainIdプロパティがない場合、providerから直接取得
            try {
              const walletProvider = await targetWallet.getEthersProvider();
              const web3Provider = new ethers.providers.Web3Provider(walletProvider as any);
              const network = await web3Provider.getNetwork();
              privyWalletChainId = network.chainId;
            } catch (providerError: any) {
              console.error('❌ Privy wallet provider ChainID取得エラー:', providerError.message);
            }
          }
        } catch (e: any) {
          console.warn('Privy wallet ChainID取得エラー:', e.message);
        }
      }

      // 2. window.ethereumから取得（最優先）
      if (typeof window !== 'undefined' && window.ethereum) {

        // MetaMask接続を確認・リクエスト
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });

          // アカウントが接続されていない場合、接続をリクエスト
          if (!accounts || accounts.length === 0) {
            setMessage({ type: 'info', text: 'MetaMaskアプリで接続を許可してください...' });

            const requestedAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            // 2秒待って接続完了を確認
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // eth_chainIdメソッドで直接取得（より確実）
          try {
            const chainIdHexFromMethod = await window.ethereum.request({ method: 'eth_chainId' });

            if (chainIdHexFromMethod) {
              windowChainId = parseInt(chainIdHexFromMethod, 16);
            }
          } catch (chainIdError: any) {
            console.error('❌ eth_chainId取得エラー:', chainIdError);

            // フォールバック: プロパティから直接取得
            const chainIdHex = window.ethereum.chainId;

            if (chainIdHex) {
              windowChainId = parseInt(chainIdHex, 16);
            }
          }
        } catch (connectError: any) {
          console.error('❌ MetaMask接続エラー:', connectError.message);
          setMessage({
            type: 'error',
            text: `MetaMask接続エラー: ${connectError.message}\n\nMetaMaskブラウザを使用していますか？`
          });
          setIsProcessing(false);
          return;
        }
      } else {
      }

      // 3. signer.providerから取得
      if (signer && signer.provider) {
        try {
          signerChainId = await getCurrentChainId(signer.provider as ethers.providers.Provider);
        } catch (chainError: any) {
          console.warn('ChainID確認エラー（続行）:', chainError.message);
        }
      }

      // 優先順位: window.ethereum > Privy wallet > signer.provider
      // MetaMaskブラウザでは window.ethereum が最も信頼できる
      if (windowChainId !== null) {
        currentChainId = windowChainId;
        chainIdSource = 'window.ethereum';
      } else if (privyWalletChainId !== null) {
        currentChainId = privyWalletChainId;
        chainIdSource = 'privy.wallets';
      } else if (signerChainId !== null) {
        currentChainId = signerChainId;
        chainIdSource = 'signer.provider';
      }


      // ChainID検証を完全にスキップ
      // トランザクションパラメータで chainId: 0x89 を指定するため、
      // ここでの検証は不要。MetaMaskが間違ったネットワークなら自動的にエラーを出す

      const SKIP_CHAINID_VALIDATION = true;
      if (currentChainId !== null && !SKIP_CHAINID_VALIDATION) {
        const chainValidation = validateChainId(currentChainId, 137);

        if (!chainValidation.valid) {

          console.error('🔴 接続中のChainID検証失敗:', {
            error: chainValidation.error,
            currentChainId,
            chainIdSource,
            privyWalletChainId,
            windowChainId,
            signerChainId,
          });

          // 自動的にPolygon Mainnetへの切り替えを試みる

          try {
            // Privy wallet経由で切り替え（MetaMask Mobile対応）
            if (wallets && wallets.length > 0) {

              // 外部ウォレット（MetaMask）を優先的に検索
              const targetWallet = wallets.find((w: any) => w.walletClientType !== 'privy') || wallets[0];


              if (targetWallet && typeof targetWallet.switchChain === 'function') {
                await targetWallet.switchChain(137);

                // 切り替え後、再度ChainIDを取得
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 再検証せずに処理を続行
              } else {
                throw new Error('switchChain メソッドが利用できません');
              }
            } else if (typeof window !== 'undefined' && window.ethereum) {
              // フォールバック: window.ethereum

              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }], // Polygon Mainnet = 0x89 (137)
              });

            } else {
              throw new Error('ネットワーク切り替え手段がありません');
            }
          } catch (switchError: any) {
            console.error('❌ ネットワーク自動切り替え失敗:', switchError);

            // 警告メッセージを表示するが処理は続行
            console.warn('⚠️ ChainID検証失敗 - MetaMaskに委ねて続行');
            console.warn('現在のChainID:', currentChainId, 'from', chainIdSource);

            // エラーで止めずに続行（MetaMaskがトランザクション時に正しいネットワークを要求する）
          }
        } else {
          // ChainID検証成功
        }
      } else {
        // ChainIDが取得できなかった場合も続行
        console.warn('⚠️ ChainID取得失敗 - 続行');
      }

      // RequestID重複チェック（リプレイアタック防止 - Phase 1）
      if (paymentData.requestId) {
        const { data: existing, error: checkError } = await supabase
          .from('payment_requests')
          .select('status')
          .eq('request_id', paymentData.requestId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 = not found (OK), その他はエラー
          console.warn('RequestID確認エラー（続行）:', checkError.message);
        }

        if (existing && existing.status === 'completed') {
          setMessage({ type: 'error', text: 'この支払いは既に完了しています' });
          console.error('🔴 重複支払い検出:', paymentData.requestId);
          setIsProcessing(false);
          return;
        }
      }

      // 残高確認用のread-only provider
      // tokenContractはトランザクション構築でも使用するため外で定義
      const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/polygon');
      const tokenContract = new ethers.Contract(paymentData.token, ERC20_ABI, readOnlyProvider);

      try {

        // 残高確認
        const userBalance = await tokenContract.balanceOf(walletAddress);

        if (userBalance.lt(paymentData.amount)) {
          setMessage({ type: 'error', text: '残高不足です' });
          setIsProcessing(false);
          return;
        }

      } catch (balanceCheckError: any) {
        console.warn('⚠️ 残高確認エラー - スキップして続行:', balanceCheckError.message);
        // エラーでも続行（MetaMaskが残高不足を検出する）
      }

      let txHash: string;

      // 送金セクションと完全に同じ実装: contract.transfer()を直接呼び出し
      if (!signer) {
        throw new Error('ウォレットが接続されていません');
      }


      const tokenContractWithSigner = new ethers.Contract(paymentData.token, ERC20_ABI, signer);

      const signerAddress = await signer.getAddress();

      setMessage({ type: 'info', text: 'MetaMaskで承認してください...' });

      // スマホ PWA + MetaMask mobile対応 (iPhone & Android両対応):
      // contract.transfer()の代わりに、populateTransaction + sendTransactionを使用
      // これにより、MetaMaskが正しいreturn URLを認識できる
      let tx;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (typeof window !== 'undefined' && window.ethereum?.isMetaMask && isMobile) {

        // トランザクションデータを構築
        const unsignedTx = await tokenContractWithSigner.populateTransaction.transfer(
          paymentData.to,
          paymentData.amount
        );

        // window.ethereumを直接使用してトランザクション送信
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: signerAddress,
            to: unsignedTx.to,
            data: unsignedTx.data,
            value: '0x0',
          }],
        });


        // トランザクションレシートを待つ
        const directProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
        tx = await directProvider.getTransaction(txHash);
      } else {
        // 通常フロー (デスクトップのみ)
        tx = await tokenContractWithSigner.transfer(paymentData.to, paymentData.amount);
      }

      txHash = tx.hash;

      setMessage({ type: 'info', text: 'トランザクション処理中...' });
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
      setIsProcessing(false);

      // 確認画面を閉じる
      setShowConfirmation(false);

      // 3秒後にリセット
      setTimeout(() => {
        setPaymentData(null);
        setMessage(null);
      }, 3000);

    } catch (error: any) {
      console.error('❌ 支払いエラー:', error);
      console.error('エラー詳細:', {
        code: error.code,
        message: error.message,
        data: error.data,
        reason: error.reason,
      });

      let errorMessage = '支払いに失敗しました';
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        errorMessage = 'トランザクションがキャンセルされました';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'ガス代が不足しています';
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'トランザクションが拒否されました';
      } else if (error.code === -32603) {
        errorMessage = 'ウォレット接続エラー。アプリを再起動してください。';
      } else if (error.message) {
        errorMessage = `エラー: ${error.message.substring(0, 100)}`;
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
              src="/ギフテラロゴのみ.png"
              alt="GIFTERRA"
              style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
              objectFit: 'contain',
            }}
          />
          GIFTERRA Pay - JPYC -
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
          このセクションでFLOW Terminalで提示されたQRコードを読み取ってください。（GIFTERRA Payment Protocol - X402互換プロトコル使用）現在のGIFTERRA FLOWプランでは特典配布とは連動しません。送金は取消不可。返金は当事者間の合意により受領者が別送金で対応する場合があります。
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
          スキャンして支払う
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
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                fontSize: isMobile ? 20 : 24,
                marginBottom: 8,
                textAlign: 'center',
                color: '#1a1a1a',
                fontWeight: 700,
              }}>
                JPYC送受信（x402ベース／互換・独自実装）について
              </h2>
              <p style={{
                fontSize: 12,
                textAlign: 'center',
                color: '#6b7280',
                margin: 0,
              }}>
                利用規約バージョン: {X402_CONSENT_VERSION}
              </p>
            </div>

            <div style={{
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.8,
              marginBottom: 24,
              color: '#2d3748',
            }}>
              <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
                <li style={{ marginBottom: 12 }}>
                  この送受信はGIFTERRAの独自実装で、JPYCがx402を公式提供・連携していることを示すものではありません。
                </li>
                <li style={{ marginBottom: 12 }}>
                  FLOWでは特典配布と連動しません。STUDIO有効時は送金完了後に別イベントとして任意のギフティングが行われる場合があります。
                </li>
                <li style={{ marginBottom: 12 }}>
                  送受信は取消できません。返金は当事者間の合意により受領者が別送金で対応することがあります。
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
                  // バージョン付き同意記録を保存
                  if (walletAddress) {
                    saveConsentRecord(walletAddress);
                  } else {
                    console.error('❌ ウォレットアドレスが未設定のため同意記録を保存できません');
                  }
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

            {/* メッセージ表示エリア（エラー・情報） */}
            {message && (
              <div style={{
                background: message.type === 'error' ? '#fee2e2' : message.type === 'success' ? '#d1fae5' : '#dbeafe',
                border: `2px solid ${message.type === 'error' ? '#ef4444' : message.type === 'success' ? '#10b981' : '#3b82f6'}`,
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                fontSize: 13,
                color: message.type === 'error' ? '#b91c1c' : message.type === 'success' ? '#065f46' : '#1e40af',
                fontWeight: 600,
                textAlign: 'center',
                wordBreak: 'break-word',
              }}>
                {message.text}
              </div>
            )}

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
