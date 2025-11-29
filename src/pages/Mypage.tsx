// src/pages/Mypage.tsx
// GIFTERRAマイページ - 送受信ツール（Flowモード）+ テナント運用（Tenantモード）

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDisconnect, useSigner, useAddress, ConnectWallet, useChainId, useNetwork } from '@thirdweb-dev/react';
import { usePrivy, useCreateWallet, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { JPYC_TOKEN, NHT_TOKEN, CONTRACT_ABI, ERC20_MIN_ABI, getGifterraAddress } from '../contract';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { useUserNFTs } from '../hooks/useUserNFTs';
import { useTransactionHistory, type Transaction } from '../hooks/useTransactionHistory';
import { useIsMobile } from '../hooks/useIsMobile';
import { useDualAxisKodomi } from '../hooks/useDualAxisKodomi';
import { useMyTenantApplication, useSubmitTenantApplication } from '../hooks/useTenantApplications';
import { useRankPlanPricing, getPlanPrice } from '../hooks/useRankPlanPricing';
import { useTenantRankPlan } from '../hooks/useTenantRankPlan';
import { saveTransferMessage, useReceivedTransferMessages } from '../hooks/useTransferMessages';
import { useRecipientProfile, type RecipientProfile } from '../hooks/useRecipientProfile';
import { TenantPlanCard } from '../components/TenantPlanCard';
import { supabase } from '../lib/supabase';
import { isSuperAdminWithDebug } from '../config/superAdmin';
import { SettingsModal } from '../components/SettingsModal';
import { TransferMessageHistory } from '../components/TransferMessageHistory';
import { SentTransferMessageHistory } from '../components/SentTransferMessageHistory';
import { NotificationBell } from '../components/NotificationBell';
import { X402PaymentSection } from '../components/X402PaymentSection';
import { UserSearchModal } from '../components/UserSearchModal';
import { BookmarkUserModal } from '../components/BookmarkUserModal';
import { MypageAssistant } from '../components/MypageAssistant';
import { LegalCompliantDualAxisTank } from '../components/score/LegalCompliantDualAxisTank';
import type { UserRole } from '../types/profile';
import flowImage from '../assets/flow.png';
import studioImage from '../assets/studio.png';
import studioProImage from '../assets/studio-pro.png';
import studioProMaxImage from '../assets/studio-pro-max.png';

// window.ethereum型定義（MetaMaskなど）
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

type ViewMode = 'flow' | 'tenant';

// テナントランク定義
// R0: 非テナント（一般ユーザー）
// R1: 申請中
// R2: 審査中
// R3: 承認済みテナント
type TenantRank = 'R0' | 'R1' | 'R2' | 'R3';

// ========================================
// 一括送金の制限設定（Privyウォレットのみ適用）
// ========================================
const BULK_SEND_LIMITS = {
  maxRecipients: 5,         // 最大5人まで
  dailyLimit: 10,           // 1日10回まで
};

// LocalStorageキー
const BULK_SEND_HISTORY_KEY = 'gifterra_bulk_send_history';

// 一括送金履歴の型
interface BulkSendHistory {
  date: string;  // YYYY-MM-DD
  count: number; // その日の送信回数
}

// 今日の一括送金回数を取得
function getTodayBulkSendCount(): number {
  const today = new Date().toISOString().split('T')[0];
  const history: BulkSendHistory[] = JSON.parse(
    localStorage.getItem(BULK_SEND_HISTORY_KEY) || '[]'
  );
  const todayHistory = history.find(h => h.date === today);
  return todayHistory?.count || 0;
}

// 一括送金回数を増加
function incrementBulkSendCount(): void {
  const today = new Date().toISOString().split('T')[0];
  const history: BulkSendHistory[] = JSON.parse(
    localStorage.getItem(BULK_SEND_HISTORY_KEY) || '[]'
  );

  const todayIndex = history.findIndex(h => h.date === today);
  if (todayIndex >= 0) {
    history[todayIndex].count++;
  } else {
    history.push({ date: today, count: 1 });
  }

  // 過去7日間のみ保持
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const filtered = history.filter(h => new Date(h.date) >= sevenDaysAgo);

  localStorage.setItem(BULK_SEND_HISTORY_KEY, JSON.stringify(filtered));
}

// ========================================
// Privyウォレットからethers Signerを取得するヘルパー関数
// IMPORTANT: EOA (Externally Owned Account) として直接アクセス
// ========================================
async function getPrivyEthersSigner(privyWallet: any): Promise<ethers.Signer | null> {
  try {
    if (!privyWallet || typeof privyWallet.getEthereumProvider !== 'function') {
      console.error('❌ Invalid wallet object or missing getEthereumProvider');
      return null;
    }

    // MetaMask接続を検出してPrivyをバイパス（モバイル対応の最優先処理）
    if (privyWallet.walletClientType === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
      try {
        // MetaMask 7.59.0対応: selectedAddressがnullの場合は明示的に接続をリクエスト
        if (!window.ethereum.selectedAddress) {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
        }

        const directProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
        const directSigner = directProvider.getSigner();
        await directSigner.getAddress();

        return directSigner;
      } catch (error: any) {
        console.warn('⚠️ [Mypage] MetaMask直接接続失敗:', error.message);
        // フォールバックとしてPrivy経由を試行
      }
    }

    // Safeラッパーを経由せず、直接EOAプロバイダーを取得
    const provider = await privyWallet.getEthereumProvider();

    // 重要: リクエスト時にSafeを無効化するオプションを指定
    const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
    const signer = ethersProvider.getSigner();

    // デバッグ: アドレスがEOAかSafeかを確認
    const signerAddress = await signer.getAddress();

    // アドレスが一致しない場合は警告
    if (signerAddress.toLowerCase() !== privyWallet.address.toLowerCase()) {
      console.warn('⚠️ Address mismatch:', { signerAddress, walletAddress: privyWallet.address });
    }

    return signer;
  } catch (error) {
    console.error('❌ Failed to get Privy signer:', error);
    return null;
  }
}

export function MypagePage() {
  const isMobile = useIsMobile(); // Capacitorネイティブ & レスポンシブWeb対応

  // viewModeをlocalStorageから初期化（ProfilePageと共有）
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('gifterra_view_mode');
    return (saved === 'tenant' || saved === 'flow') ? saved : 'flow';
  });

  // viewMode変更時にlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('gifterra_view_mode', viewMode);
  }, [viewMode]);

  const [tenantRank, setTenantRank] = useState<TenantRank>('R0'); // TODO: 実データから取得
  const [showWalletSetupModal, setShowWalletSetupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [actualChainId, setActualChainId] = useState<number | undefined>(undefined);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]); // 新規ユーザー通知用のロール情報
  const [bulkSendRecipients, setBulkSendRecipients] = useState<Array<{ id: number; address: string; amount: string }>>([]);
  const [sendMode, setSendMode] = useState<SendMode | null>(null); // 送金モード管理
  const { user, authenticated } = usePrivy();
  const thirdwebAddress = useAddress(); // Thirdwebウォレット

  // Privyの全ウォレットを取得
  const { wallets, ready: walletsReady } = useWallets();

  // user.wallet を優先的に使用（Privy埋め込みウォレット）
  // useWallets() は外部ウォレット（MetaMask）を優先してしまうため、直接 user.wallet を使う
  const privyEmbeddedWalletAddress = user?.wallet?.address;

  // 表示するアドレス（Privy埋め込みウォレット優先、なければThirdweb）
  const displayAddress = privyEmbeddedWalletAddress || thirdwebAddress;

  // URLパラメータから view を取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'tenant' && tenantRank === 'R3') {
      // R3（承認済み）のみTenantモード切り替え可能
      setViewMode('tenant');
    }
  }, [tenantRank]);

  // URLパラメータからチップ送信情報を取得してスクロール
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isTip = params.get('isTip');

    if (isTip === 'true') {
      // チップ送信パラメータを sessionStorage に保存
      const to = params.get('to');
      const amount = params.get('amount');

      if (to && amount) {
        sessionStorage.setItem('gifterra_tip_to', to);
        sessionStorage.setItem('gifterra_tip_amount', amount);

        // URLパラメータをクリア（リロード時に再実行されないように）
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        // SendFormまでスクロール（100ms遅延で確実にDOMが描画されてから）
        setTimeout(() => {
          const sendFormElement = document.getElementById('send-form-section');
          if (sendFormElement) {
            sendFormElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, []);

  // TODO: 実際のテナントランク取得ロジック
  useEffect(() => {
    // const fetchTenantRank = async () => {
    //   const address = await getConnectedAddress();
    //   const rank = await getTenantRankFromContract(address);
    //   setTenantRank(rank);
    // };
    // fetchTenantRank();
  }, []);

  // ユーザーのロール情報を取得（新規ユーザー通知用）
  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!displayAddress) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('roles')
          .eq('wallet_address', displayAddress.toLowerCase())
          .single();

        if (error) {
          console.error('[Mypage] Failed to fetch user roles:', error);
          return;
        }

        if (data?.roles) {
          setUserRoles(data.roles as UserRole[]);
        }
      } catch (error) {
        console.error('[Mypage] Error fetching user roles:', error);
      }
    };

    fetchUserRoles();
  }, [displayAddress]);

  // ログイン直後にウォレット未作成の場合、セットアップモーダルを表示
  useEffect(() => {
    if (authenticated && user && !user.wallet) {
      // ログイン直後かどうかを判定（sessionStorageを使用）
      const hasSeenWalletSetup = sessionStorage.getItem('hasSeenWalletSetup');
      if (!hasSeenWalletSetup) {
        setShowWalletSetupModal(true);
        sessionStorage.setItem('hasSeenWalletSetup', 'true');
      }
    }
  }, [authenticated, user]);

  // ブックマークユーザーを一括送金に追加
  const handleAddToBulkSend = (userAddress: string, userName?: string) => {
    // 新しいIDを生成（既存のrecipientsの最大IDに+1）
    const newId = bulkSendRecipients.length > 0
      ? Math.max(...bulkSendRecipients.map(r => r.id)) + 1
      : 1;

    // 重複チェック（同じアドレスが既にある場合は追加しない）
    const isDuplicate = bulkSendRecipients.some(r => r.address.toLowerCase() === userAddress.toLowerCase());

    if (isDuplicate) {
      alert(`${userName || userAddress} は既に追加されています`);
      return;
    }

    // 新しい受取人を追加
    setBulkSendRecipients(prev => [
      ...prev,
      { id: newId, address: userAddress, amount: '' }
    ]);

    // 一括送金モードに切り替え
    setSendMode('bulk');

    // SendFormセクションまでスクロール
    setTimeout(() => {
      const sendFormElement = document.getElementById('send-form-section');
      if (sendFormElement) {
        sendFormElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    alert(`${userName || userAddress} を一括送金リストに追加しました`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #018a9a 0%, #017080 100%)',
      color: '#e0e0e0',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* CSSアニメーション定義 */}
      <style>{`
        @keyframes liquidWave {
          0%, 100% {
            transform: translateX(-50%) translateY(0px);
            border-radius: 45%;
          }
          50% {
            transform: translateX(-50%) translateY(-1.5px);
            border-radius: 46%;
          }
        }
        @keyframes breatheGlow {
          0%, 100% {
            opacity: 0.00;
          }
          50% {
            opacity: 0.06;
          }
        }
        @keyframes subtleBubbleRise {
          0% {
            bottom: 0;
            opacity: 0;
            transform: translateX(0);
          }
          10% {
            opacity: 0.35;
          }
          90% {
            opacity: 0.35;
          }
          100% {
            bottom: 100%;
            opacity: 0;
            transform: translateX(12px);
          }
        }
        @keyframes liquidShimmer {
          0%, 100% {
            transform: translateX(-10%);
            opacity: 0.3;
          }
          50% {
            transform: translateX(10%);
            opacity: 0.6;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* 前景オーバーレイ */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12, 16, 28, 0.44)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* グリッド背景 */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(234, 242, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(234, 242, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        opacity: 0.5,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* メインコンテンツ */}
      {/* [A] ヘッダー - ガラスモーフィズム */}
      <div style={{
        maxWidth: isMobile ? '100%' : 600,
        margin: isMobile ? '0 16px 16px' : '0 auto 20px',
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: isMobile ? 16 : 20,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        paddingTop: isMobile ? '8px' : '10px',
        paddingBottom: isMobile ? '8px' : '10px',
        paddingLeft: isMobile ? '16px' : '24px',
        paddingRight: isMobile ? '16px' : '24px',
      }}>
        <Header
          viewMode={viewMode}
          setViewMode={setViewMode}
          isMobile={isMobile}
          tenantRank={tenantRank}
          showSettingsModal={showSettingsModal}
          setShowSettingsModal={setShowSettingsModal}
          showUserSearchModal={showUserSearchModal}
          setShowUserSearchModal={setShowUserSearchModal}
          showBookmarkModal={showBookmarkModal}
          setShowBookmarkModal={setShowBookmarkModal}
          walletAddress={displayAddress || ''}
          handleAddToBulkSend={handleAddToBulkSend}
        />
      </div>

      {/* チェーン警告バナー */}
      {/* Capacitorアプリの場合は警告を表示しない（WalletConnect経由でchainIdが取得できないため） */}
      {actualChainId && actualChainId !== 137 && typeof (window as any).Capacitor === 'undefined' && (
        <div style={{
          maxWidth: isMobile ? '100%' : 600,
          margin: isMobile ? '0 16px 12px' : '0 auto 16px',
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? '12px 14px' : '16px 20px',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 10 : 12,
            marginBottom: isMobile ? 8 : 10,
          }}>
            <div style={{ fontSize: isMobile ? 24 : 28 }}>⚠️</div>
            <div style={{
              fontWeight: 700,
              fontSize: isMobile ? 14 : 16,
              color: '#92400e',
            }}>
              ネットワークを切り替えてください
            </div>
          </div>
          <div style={{
            fontSize: isMobile ? 12 : 13,
            color: '#78350f',
            lineHeight: 1.6,
            marginBottom: isMobile ? 6 : 8,
          }}>
            現在 <strong>{actualChainId === 1 ? 'Ethereum Mainnet' : `Chain ID: ${actualChainId}`}</strong> に接続されています。
            <br />
            GIFTERRAを使用するには <strong>Polygon Mainnet</strong> に切り替えてください。
          </div>
          <div style={{
            fontSize: isMobile ? 11 : 12,
            color: '#92400e',
            padding: isMobile ? '8px 10px' : '10px 12px',
            background: 'rgba(255, 255, 255, 0.5)',
            borderRadius: isMobile ? 6 : 8,
            border: '1px solid #fbbf24',
          }}>
            <strong>手動切り替え方法:</strong>
            <br />
            MetaMaskまたはウォレットのネットワーク選択から「Polygon Mainnet」を選択してください
          </div>
        </div>
      )}

      {/* [B] メインコンテンツエリア */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: isMobile ? '100%' : 600,
        margin: '0 auto',
        padding: isMobile ? '0 16px 16px' : '0 24px 24px',
      }}>

        {/* [B] コンテンツ */}
        {viewMode === 'flow' ? (
          <FlowModeContent isMobile={isMobile} tenantRank={tenantRank} address={displayAddress} onChainIdChange={setActualChainId} bulkSendRecipients={bulkSendRecipients} setBulkSendRecipients={setBulkSendRecipients} handleAddToBulkSend={handleAddToBulkSend} sendMode={sendMode} setSendMode={setSendMode} />
        ) : (
          <TenantModeContent isMobile={isMobile} />
        )}

        {/* [D] フッター */}
        <Footer isMobile={isMobile} />
      </div>

      {/* ウォレットセットアップモーダル */}
      {showWalletSetupModal && (
        <WalletSetupModal
          isMobile={isMobile}
          onClose={() => setShowWalletSetupModal(false)}
        />
      )}

      {/* AIアシスタント（モバイル・PC両対応） - ページ全体に固定表示 */}
      <MypageAssistant
        isMobile={isMobile}
        walletAddress={displayAddress}
        displayName={undefined}  // TODO: プロフィールから取得
        userRoles={userRoles}
      />
    </div>
  );
}

// ========================================
// [A] ヘッダー
// ========================================
function Header({ viewMode, setViewMode, isMobile, tenantRank, showSettingsModal, setShowSettingsModal, showUserSearchModal, setShowUserSearchModal, showBookmarkModal, setShowBookmarkModal, walletAddress, handleAddToBulkSend }: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isMobile: boolean;
  tenantRank: TenantRank;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showUserSearchModal: boolean;
  setShowUserSearchModal: (show: boolean) => void;
  showBookmarkModal: boolean;
  setShowBookmarkModal: (show: boolean) => void;
  walletAddress: string;
  handleAddToBulkSend: (address: string, name?: string) => void;
}) {
  const disconnect = useDisconnect();
  const { logout: privyLogout, authenticated, user } = usePrivy();
  const address = useAddress();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // 表示するアドレス（親コンポーネントから渡される）
  const displayAddress = walletAddress || user?.wallet?.address || address;

  // テナント申請情報取得
  const { application } = useMyTenantApplication();
  const tenantId = application?.status === 'approved' ? application.tenant_id : null;
  const { plan: tenantRankPlan } = useTenantRankPlan(tenantId);

  // プランに応じたロゴ画像を取得
  const getHeaderLogo = () => {
    // 承認済みテナントでプランが有効な場合のみ
    if (
      application?.status === 'approved' &&
      tenantId &&
      tenantRankPlan &&
      tenantRankPlan.is_active
    ) {
      const plan = tenantRankPlan.rank_plan;
      switch (plan) {
        case 'STUDIO':
          return studioImage;
        case 'STUDIO_PRO':
          return studioProImage;
        case 'STUDIO_PRO_MAX':
          return studioProMaxImage;
        default:
          return flowImage;
      }
    }
    // デフォルト（テナント申請していない、または承認されていないユーザー）
    return flowImage;
  };

  // 特定アドレスのみトグル表示（開発・テスト用）
  const ALLOWED_TOGGLE_ADDRESS = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  const showToggle = displayAddress?.toLowerCase() === ALLOWED_TOGGLE_ADDRESS.toLowerCase();

  const handleLogout = async () => {
    try {
      // Privy認証の場合はPrivyからもログアウト
      if (authenticated) {
        await privyLogout();
      }
      // Thirdwebウォレットをdisconnect
      await disconnect();
      // ローカルストレージをクリア
      localStorage.removeItem('gifterra_auth');
      // ログインページにリダイレクト（replaceを使用してブラウザ履歴を置き換え）
      window.location.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // エラーでもログインページにリダイレクト
      window.location.replace('/login');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* 左：ロゴ画像（プラン別） */}
      <img
        src={getHeaderLogo()}
        alt="Logo"
        onClick={() => {
          window.location.href = '/mypage';
        }}
        style={{
          height: isMobile ? 40 : 60,
          width: 'auto',
          maxWidth: isMobile ? '200px' : '300px',
          objectFit: 'contain',
          opacity: 1,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      />

      {/* 中央：FLOW/STUDIOトグル（スーパーアドミンのみ表示） */}
      {showToggle && (
        <div style={{
          display: 'flex',
          gap: 8,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 999,
          padding: 4,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <button
            onClick={() => setViewMode('flow')}
            style={{
              padding: isMobile ? '6px 16px' : '8px 20px',
              background: viewMode === 'flow' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              border: 'none',
              borderRadius: 999,
              color: '#EAF2FF',
              fontSize: isMobile ? 12 : 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: viewMode === 'flow' ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
            }}
          >
            FLOW
          </button>
          <button
            onClick={() => setViewMode('tenant')}
            style={{
              padding: isMobile ? '6px 16px' : '8px 20px',
              background: viewMode === 'tenant' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'transparent',
              border: 'none',
              borderRadius: 999,
              color: '#EAF2FF',
              fontSize: isMobile ? 12 : 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: viewMode === 'tenant' ? '0 2px 8px rgba(240, 147, 251, 0.3)' : 'none',
            }}
          >
            STUDIO
          </button>
        </div>
      )}

      {/* 右:通知ベル + ハンバーガーメニュー（スマホ・デスクトップ共通） */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* 通知ベル */}
        <NotificationBell userAddress={address} isMobile={isMobile} />

        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          style={{
            width: 36,
            height: 36,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#EAF2FF',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ☰
        </button>

          {showMobileMenu && createPortal(
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
              onClick={() => setShowMobileMenu(false)}
            >
              <div
                style={{
                  width: '70%',
                  maxWidth: 300,
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <span style={{ color: '#EAF2FF', fontSize: 18, fontWeight: 600 }}>メニュー</span>
                  <button
                    onClick={() => setShowMobileMenu(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#EAF2FF',
                      fontSize: 24,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <button
                  onClick={() => {
                    window.location.href = '/profile';
                    setShowMobileMenu(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>👤</span>
                  <span>プロフィール</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserSearchModal(true);
                    setShowMobileMenu(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🔍</span>
                  <span>ユーザー検索</span>
                </button>

                {/* ブックマークユーザー */}
                <button
                  onClick={() => {
                    setShowBookmarkModal(true);
                    setShowMobileMenu(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>⭐</span>
                  <span>ブックマークユーザー</span>
                </button>

                <button
                  onClick={() => {
                    setShowSettingsModal(true);
                    setShowMobileMenu(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>⚙️</span>
                  <span>設定</span>
                </button>

                {/* Admin管理画面（テナント所有者のみ） */}
                {application?.status === 'approved' && (
                  <button
                    onClick={() => {
                      window.location.href = '/admin/tenant-profile';
                      setShowMobileMenu(false);
                    }}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: 8,
                      color: '#C4B5FD',
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🏢</span>
                    <span>Admin管理画面</span>
                  </button>
                )}

                {/* ターミナルUI */}
                <button
                  onClick={() => {
                    window.location.href = '/terminal';
                    setShowMobileMenu(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 8,
                    color: '#93C5FD',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>💳</span>
                  <span>ターミナルUI</span>
                </button>

                {/* ログアウトボタン */}
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleLogout();
                  }}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: 8,
                    color: '#FCA5A5',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🚪</span>
                  <span>ログアウト</span>
                </button>

                {viewMode === 'tenant' && (
                  <button style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <span style={{ fontSize: 18 }}>🏢</span>
                    <span>Adminで開く</span>
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* 設定モーダル */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          isMobile={isMobile}
          onLogout={handleLogout}
        />
      )}

      {/* ユーザー検索モーダル */}
      {showUserSearchModal && (
        <UserSearchModal
          onClose={() => setShowUserSearchModal(false)}
          isMobile={isMobile}
        />
      )}

      {/* ブックマークユーザーモーダル */}
      {showBookmarkModal && (
        <BookmarkUserModal
          userAddress={walletAddress}
          onClose={() => setShowBookmarkModal(false)}
          isMobile={isMobile}
          mode="view"
          onSelectUser={(selectedAddress, userName) => {
            // マイページにユーザー選択情報を渡す
            const sendFormSection = document.getElementById('send-form-section');
            if (sendFormSection) {
              sendFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // URLパラメータでマイページに送信
            const params = new URLSearchParams({
              to: selectedAddress,
              mode: 'bookmark',
              userName: userName || '',
            });
            window.location.href = `/mypage?${params.toString()}`;
          }}
          onAddToBulkSend={handleAddToBulkSend}
        />
      )}
    </div>
  );
}

// ========================================
// ウォレット接続情報コンポーネント
// ========================================
function WalletConnectionInfo({ isMobile, onChainIdChange }: { isMobile: boolean; onChainIdChange: (chainId: number | undefined) => void }) {
  const address = useAddress(); // Thirdwebウォレット
  const thirdwebChainId = useChainId();
  const { user, authenticated, ready } = usePrivy(); // Privyユーザー情報
  const [actualChainId, setActualChainId] = useState<number | undefined>(undefined);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);

  // 実際のチェーンIDを取得（MetaMaskなど外部ウォレット対応）
  useEffect(() => {
    const fetchChainId = async () => {
      // Capacitorアプリかどうかを検出
      const isCapacitorApp = typeof (window as any).Capacitor !== 'undefined';

      // Privyウォレットの場合は常にPolygon Mainnet（137）
      if (user?.wallet?.address && !address) {
        setActualChainId(137);
        onChainIdChange(137);
        return;
      }

      // thirdwebChainIdが取得できている場合はそれを優先使用
      if (thirdwebChainId) {
        setActualChainId(thirdwebChainId);
        onChainIdChange(thirdwebChainId);
        return;
      }

      // Capacitorアプリの場合（iOS/Android）
      // WalletConnect経由なのでwindow.ethereumは存在しない
      // アドレスが取得できていれば、Polygon Mainnetとして扱う
      if (isCapacitorApp && address) {
        setActualChainId(137);
        onChainIdChange(137);
        return;
      }

      // window.ethereumが存在する場合（MetaMaskなど外部ウォレット - ブラウザのみ）
      if (typeof window.ethereum !== 'undefined' && address) {
        try {
          // 少し遅延を入れてウォレット接続が完了するのを待つ
          await new Promise(resolve => setTimeout(resolve, 500));
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const numericChainId = parseInt(chainId, 16);
          setActualChainId(numericChainId);
          onChainIdChange(numericChainId);
        } catch {
          // エラー時もthirdwebChainIdまたはデフォルト値を設定
          const fallbackChainId = thirdwebChainId || 137;
          setActualChainId(fallbackChainId);
          onChainIdChange(fallbackChainId);
        }
      } else if (!address) {
        // アドレスがまだ取得されていない場合は待機（undefinedのまま）
        return;
      } else {
        // window.ethereumが存在しない場合
        // thirdwebChainIdがundefinedの場合はPolygon Mainnet (137) をデフォルトとする
        const fallbackChainId = thirdwebChainId || 137;
        setActualChainId(fallbackChainId);
        onChainIdChange(fallbackChainId);
      }
    };

    fetchChainId();

    // チェーン変更イベントをリスニング
    if (typeof window.ethereum !== 'undefined') {
      const handleChainChanged = (chainId: string) => {
        const numericChainId = parseInt(chainId, 16);
        setActualChainId(numericChainId);
        onChainIdChange(numericChainId);
      };
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [address, thirdwebChainId, user, onChainIdChange]);

  // Privyウォレット作成フック
  const { createWallet } = useCreateWallet({
    onSuccess: (wallet) => {
    },
    onError: (error) => {
      console.error('❌ Failed to create wallet:', error);
      alert('ウォレットの作成に失敗しました。もう一度お試しください。\n\nエラー: ' + error.message);
    },
  });

  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // ウォレット読み込み状態の監視
  useEffect(() => {
    // Privyが準備完了していて、ユーザー認証済みまたはアドレスが取得できた場合
    if (ready && (authenticated || address)) {
      // 少し遅延を持たせてローディングを解除（UIの安定性のため）
      const timer = setTimeout(() => {
        setIsLoadingWallet(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    // Privyが準備完了していて、認証もアドレスもない場合
    else if (ready && !authenticated && !address) {
      setIsLoadingWallet(false);
    }
  }, [ready, authenticated, address, user]);

  // デバッグログ
  useEffect(() => {
  }, [authenticated, user, address, thirdwebChainId, actualChainId]);

  // ウォレット作成ハンドラー
  const handleCreateWallet = async () => {
    if (!authenticated || user?.wallet) return;

    setIsCreatingWallet(true);
    try {
      await createWallet();
      // 成功時のメッセージはonSuccessコールバックで処理
    } catch (error) {
      console.error('❌ Wallet creation error:', error);
      // エラーメッセージはonErrorコールバックで処理
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // Privyウォレットアドレスを取得
  const privyWalletAddress = user?.wallet?.address;

  // 表示するアドレス（Privy優先、なければThirdweb）
  const displayAddress = privyWalletAddress || address;

  // ウォレットタイプを判定
  const walletType = privyWalletAddress ? 'Privy Wallet' : address ? 'External Wallet' : null;

  // Capacitorアプリかどうかを検出
  const isCapacitorApp = typeof (window as any).Capacitor !== 'undefined';

  // チェーン名を取得
  const getChainName = (chainId: number | undefined) => {
    // Capacitorアプリの場合は固定でPolygon Mainnet
    if (isCapacitorApp && address) return 'Polygon Mainnet';
    // Privyウォレットの場合は固定でPolygon Mainnet
    if (privyWalletAddress && !chainId) return 'Polygon Mainnet';
    if (!chainId) return '未接続';
    if (chainId === 80002) return 'Polygon Amoy (Testnet)';
    if (chainId === 137) return 'Polygon Mainnet';
    return `Chain ID: ${chainId}`;
  };

  // 使用するchainId（実際のchainIdを優先、Capacitorアプリは137固定）
  const displayChainId = isCapacitorApp && address ? 137 : actualChainId;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: isMobile ? 8 : 12,
      marginBottom: isMobile ? 16 : 20,
    }}>
      {/* ウォレット接続ボタン */}
      <div style={{ flex: 1 }}>
        {isLoadingWallet ? (
          // ウォレット読み込み中表示
          <div style={{
            width: '100%',
            height: isMobile ? 40 : 44,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            fontSize: isMobile ? 12 : 14,
            fontWeight: 600,
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            gap: 8,
          }}>
            <div style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTop: '2px solid #ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ opacity: 0.8 }}>ウォレット接続中...</span>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : displayAddress ? (
          // ウォレットアドレス表示
          <div style={{
            width: '100%',
            height: isMobile ? 40 : 44,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            fontSize: isMobile ? 11 : 14,
            fontWeight: 600,
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            <span style={{ marginRight: isMobile ? 4 : 8, fontSize: isMobile ? 14 : 16 }}>
              {walletType === 'Privy Wallet' ? '🔐' : '👛'}
            </span>
            {isMobile
              ? `${displayAddress.slice(0, 4)}...${displayAddress.slice(-3)}`
              : `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
            }
          </div>
        ) : authenticated && user && !user.wallet ? (
          // Privy認証済みだがウォレット未生成の場合：ウォレット作成ボタン
          <button
            onClick={handleCreateWallet}
            disabled={isCreatingWallet}
            style={{
              width: '100%',
              height: isMobile ? 40 : 44,
              borderRadius: 8,
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
              background: isCreatingWallet
                ? 'rgba(100, 100, 100, 0.5)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              cursor: isCreatingWallet ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isCreatingWallet ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                ウォレット作成中...
              </>
            ) : (
              <>
                <span>🔨</span>
                ウォレットを作成
              </>
            )}
          </button>
        ) : (
          // ウォレット未接続時はConnectWalletボタン
          <ConnectWallet
            theme="dark"
            btnTitle="ウォレット接続"
            style={{
              width: '100%',
              height: isMobile ? 40 : 44,
              borderRadius: 8,
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
            }}
          />
        )}
      </div>

      {/* チェーン表示 */}
      <div style={{
        flex: isMobile ? '0 0 auto' : 1,
        height: isMobile ? 40 : 44,
        padding: isMobile ? '0 12px' : '0 16px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMobile ? 8 : 8,
        minWidth: isMobile ? 'auto' : undefined,
      }}>
        <div style={{
          width: isMobile ? 8 : 8,
          height: isMobile ? 8 : 8,
          borderRadius: '50%',
          // Privyウォレットまたは正しいチェーン(137: Polygon Mainnet)の場合は緑
          background: (privyWalletAddress || displayChainId === 137) ? '#10b981' : displayChainId === 80002 ? '#f59e0b' : '#ef4444',
        }} />
        <span style={{
          color: '#e0e0e0',
          fontSize: isMobile ? 12 : 14,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          {isMobile ? (displayChainId === 137 ? 'Polygon' : displayChainId === 80002 ? 'Amoy' : `#${displayChainId}`) : getChainName(displayChainId)}
        </span>
      </div>
    </div>
  );
}

// ========================================
// [B] Flowモードコンテンツ
// ========================================
function FlowModeContent({
  isMobile,
  tenantRank,
  address,
  onChainIdChange,
  bulkSendRecipients,
  setBulkSendRecipients,
  handleAddToBulkSend,
  sendMode,
  setSendMode
}: {
  isMobile: boolean;
  tenantRank: TenantRank;
  address: string | undefined;
  onChainIdChange: (chainId: number | undefined) => void;
  bulkSendRecipients: Array<{ id: number; address: string; amount: string }>;
  setBulkSendRecipients: (value: Array<{ id: number; address: string; amount: string }> | ((prev: Array<{ id: number; address: string; amount: string }>) => Array<{ id: number; address: string; amount: string }>)) => void;
  handleAddToBulkSend: (address: string, name?: string) => void;
  sendMode: SendMode | null;
  setSendMode: (mode: SendMode | null) => void;
}) {
  // useAddress()を呼び出して実際の接続アドレスを取得
  const thirdwebAddress = useAddress();
  // propsのaddressまたはthirdwebAddressを使用（優先順位: props > thirdweb）
  const connectedAddress = address || thirdwebAddress;

  // 承認済みテナントの申請情報を取得
  const { application } = useMyTenantApplication();

  // 承認済みテナントの場合、テナントIDでランクプランを取得
  const tenantId = application?.status === 'approved' ? application.tenant_id : null;
  const { plan: tenantRankPlan } = useTenantRankPlan(tenantId);

  // 承認済み申請とアクティブなランクプランがある場合はテナントプランカードを表示
  // 注: tenantRank は 'R3' でなくても、DBに承認済み申請があれば表示する（テスト用に緩和）
  const isApprovedTenant = application?.status === 'approved' && tenantId && tenantRankPlan?.is_active;
  const showLockCard = !isApprovedTenant;

  return (
    <>
      {/* 0. ウォレット接続情報（送金カードの上） */}
      <WalletConnectionInfo isMobile={isMobile} onChainIdChange={onChainIdChange} />

      {/* 1. 送金・受信（縦並び） */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 16 : 20,
        marginBottom: isMobile ? 40 : 48,
      }}>
        <SendForm isMobile={isMobile} bulkSendRecipients={bulkSendRecipients} setBulkSendRecipients={setBulkSendRecipients} handleAddToBulkSend={handleAddToBulkSend} sendMode={sendMode} setSendMode={setSendMode} />
        <X402PaymentSection isMobile={isMobile} />
        <ReceiveAddress isMobile={isMobile} />
      </div>

      {/* 2. 履歴 */}
      <HistorySection
        isMobile={isMobile}
        address={connectedAddress}
        tenantId={tenantId}
      />

      {/* 3. 全体kodomiタンク */}
      <OverallKodomiTank isMobile={isMobile} />

      {/* 4. ウォレット情報（残高とNFT） */}
      <WalletInfo isMobile={isMobile} />

      {/* 5. 応援テナント別カード */}
      <ContributionTenants isMobile={isMobile} />

      {/* 5. プランカード / ロックカード */}
      {(() => {
        if (isApprovedTenant && tenantId) {
          return (
            <TenantPlanCard
              isMobile={isMobile}
              currentPlan={tenantRankPlan}
              tenantId={tenantId}
            />
          );
        } else if (showLockCard) {
          return <LockCard isMobile={isMobile} />;
        } else {
          return null;
        }
      })()}
    </>
  );
}

// 送金モード定義
type SendMode = 'simple' | 'tenant' | 'bulk' | 'bookmark' | 'anonymous';

// 1. 送金フォーム
function SendForm({ isMobile, bulkSendRecipients, setBulkSendRecipients, handleAddToBulkSend, sendMode, setSendMode }: {
  isMobile: boolean;
  bulkSendRecipients: Array<{ id: number; address: string; amount: string }>;
  setBulkSendRecipients: (value: Array<{ id: number; address: string; amount: string }> | ((prev: Array<{ id: number; address: string; amount: string }>) => Array<{ id: number; address: string; amount: string }>)) => void;
  handleAddToBulkSend: (address: string, name?: string) => void;
  sendMode: SendMode | null;
  setSendMode: (mode: SendMode | null) => void;
}) {
  // Thirdwebウォレット
  const thirdwebSigner = useSigner();
  const thirdwebAddress = useAddress();
  const chainId = useChainId();

  // Privyウォレット
  const { user, authenticated, ready, createWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  // user.wallet から埋め込みウォレットを直接取得
  // useWallets() は外部ウォレット（MetaMask）を優先してしまうため、user.wallet を使う
  // ただし、wallets 配列からも同じアドレスのウォレットを探す必要がある（signer取得のため）
  const privyEmbeddedAddress = user?.wallet?.address;
  const privyWallet = privyEmbeddedAddress
    ? wallets.find(w => w.address.toLowerCase() === privyEmbeddedAddress.toLowerCase())
    : null;

  const [selectedToken, setSelectedToken] = useState<'JPYC' | 'POL'>('JPYC'); // トークン選択（JPYC or POL）
  const [showTokenDropdown, setShowTokenDropdown] = useState(false); // トークン選択ドロップダウン表示状態
  const [showModeModal, setShowModeModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showBookmarkSelectModal, setShowBookmarkSelectModal] = useState(false); // ブックマーク選択モーダル
  const [showPrepModal, setShowPrepModal] = useState(false); // JPYC/MATIC準備モーダル
  const [balanceVisible, setBalanceVisible] = useState(true); // 残高の目隠し状態
  const [isAnonymous, setIsAnonymous] = useState(false); // 匿名送金トグル
  const [shareOnX, setShareOnX] = useState(false); // Xシェアトグル
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedBookmarkUser, setSelectedBookmarkUser] = useState<{ address: string; name?: string } | null>(null);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [showReceiveMessageModal, setShowReceiveMessageModal] = useState(false);
  const [recipientReceiveMessage, setRecipientReceiveMessage] = useState<string>('');
  const [showFirstSendGuide, setShowFirstSendGuide] = useState(false);

  // 受取人プロフィールを取得（デバウンス500ms）
  // sendMode に関わらず常にアドレスが入力されたらプロフィールを取得
  const { profile: recipientProfile, isLoading: isLoadingProfile } = useRecipientProfile(
    address,
    500
  );

  // 現在のウォレットアドレスとsignerを取得
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [actualAddress, setActualAddress] = useState<string>('');

  // Signerを取得し、実際のアドレスを取得
  useEffect(() => {
    const getSigner = async () => {
      // MetaMaskブラウザを最優先で検出（Privy完全バイパス - モバイル対応）
      if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {

        try {
          // MetaMask 7.59.0対応: selectedAddressがnullの場合は明示的に接続をリクエスト
          if (!window.ethereum.selectedAddress) {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
          }

          const directProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
          const directSigner = directProvider.getSigner();
          const addr = await directSigner.getAddress();

          setSigner(directSigner);
          setActualAddress(addr);
          return;
        } catch (error: any) {
          console.warn('⚠️ [Mypage getSigner] MetaMask直接接続失敗:', error.message);
          // フォールバックとしてPrivy経由を試行
        }
      }

      // walletsReadyがfalseの場合は待機
      if (!walletsReady) {
        return;
      }

      // Privyの埋め込みウォレットを最優先
      // user.wallet にはアドレス情報のみ、実際のプロバイダーは wallets 配列から取得
      if (user?.wallet?.address) {
        try {
          // wallets配列から同じアドレスのウォレットを探す
          const embeddedWallet = wallets.find(
            w => w.address.toLowerCase() === user.wallet.address.toLowerCase()
          );


          if (embeddedWallet) {
            const privySigner = await getPrivyEthersSigner(embeddedWallet);
            setSigner(privySigner);
            if (privySigner) {
              const addr = await privySigner.getAddress();
              setActualAddress(addr);
            }
            return;
          } else {
            console.warn('⚠️ Embedded wallet not found in wallets array');
            console.warn('⚠️ This may happen if the wallet needs to be created first');
          }
        } catch (error) {
          console.error('❌ Failed to get Privy embedded wallet signer:', error);
        }
      }

      // フォールバック: 接続されているウォレット
      if (privyWallet) {
        const privySigner = await getPrivyEthersSigner(privyWallet);
        setSigner(privySigner);
        if (privySigner) {
          const addr = await privySigner.getAddress();
          setActualAddress(addr);
        }
      } else if (thirdwebSigner) {
        setSigner(thirdwebSigner);
        const addr = await thirdwebSigner.getAddress();
        setActualAddress(addr);
      } else {
        setSigner(null);
        setActualAddress('');
      }
    };
    getSigner();
  }, [user, wallets, privyWallet, thirdwebSigner, walletsReady]);

  // 使用するアドレス（Privyの埋め込みウォレットを最優先）
  const walletAddress = privyEmbeddedAddress || actualAddress || privyWallet?.address || thirdwebAddress || '';

  // デバッグログ: どのウォレットの残高を表示しているか確認
  useEffect(() => {
    // ウォレットアドレス変更時の処理（必要に応じて追加）
  }, [walletAddress, privyEmbeddedAddress, actualAddress, privyWallet, thirdwebAddress, signer]);

  // チップ送信情報 or ブックマークユーザー選択情報を読み込んで自動入力
  useEffect(() => {
    // URLパラメータから読み込み
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to');
    const mode = params.get('mode');
    const userName = params.get('userName');

    if (to && mode === 'bookmark') {
      // ブックマークユーザー選択の場合
      setAddress(to);
      setSendMode('bookmark');
      if (userName) {
        setSelectedBookmarkUser({ address: to, name: userName });
      }

      // URLパラメータをクリア（履歴を汚さないため）
      window.history.replaceState({}, '', '/mypage');

      // 送金フォームにスクロール
      setTimeout(() => {
        const sendFormSection = document.getElementById('send-form-section');
        if (sendFormSection) {
          sendFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      return;
    }

    // sessionStorageの読み込みを少し遅延させる（親コンポーネントのuseEffectが先に実行されるため）
    const timer = setTimeout(() => {
      const tipTo = sessionStorage.getItem('gifterra_tip_to');
      const tipAmount = sessionStorage.getItem('gifterra_tip_amount');

      if (tipTo && tipAmount) {
        // フォームに自動入力
        setAddress(tipTo);
        setAmount(tipAmount);
        setSendMode('simple'); // シンプル送金モードに設定

        // sessionStorage をクリア（1回のみ実行）
        sessionStorage.removeItem('gifterra_tip_to');
        sessionStorage.removeItem('gifterra_tip_amount');
      }
    }, 200); // 200ms遅延

    return () => clearTimeout(timer);
  }, []);

  // トークン残高を取得
  const { balances } = useTokenBalances(walletAddress, signer);

  // トークン情報の定義
  const tokenInfoMap = {
    JPYC: {
      name: 'JPYC',
      symbol: 'JPYC',
      description: 'ステーブルコイン',
      detail: '日本円と同価値、送金ツールとして利用',
      color: '#667eea',
      logo: '/JPYC-logo.png',
    },
    POL: {
      name: 'POL',
      symbol: 'POL',
      description: 'Polygon ネイティブトークン',
      detail: 'ガス代やネイティブ送金に利用',
      color: '#8247e5',
      logo: '/polygon-logo.png',
    },
  };

  const currentToken = tokenInfoMap[selectedToken];

  // Privyウォレット準備状態の監視
  useEffect(() => {

    if (walletsReady && wallets.length > 0) {
    } else if (walletsReady && wallets.length === 0 && authenticated && user) {
      // linkedAccountsに既にウォレットがあるかチェック
      const hasWalletInLinkedAccounts = user.linkedAccounts?.some(
        (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
      );

      if (hasWalletInLinkedAccounts) {
      } else {
      }
    } else if (authenticated && ready && !walletsReady) {
    }
  }, [authenticated, ready, walletsReady, wallets, privyWallet, user]);

  // テナント選択時の処理
  const handleTenantSelect = (tenant: any) => {
    setSelectedTenant(tenant);
    setAddress(tenant.walletAddress);
    setShowTenantModal(false);
  };

  // ガスレス送金処理
  const handleSend = async () => {
    // 初回送金チェック
    const hasSeenFirstSendGuide = localStorage.getItem('gifterra_first_send_guide_shown');
    if (!hasSeenFirstSendGuide) {
      setShowFirstSendGuide(true);
      return;
    }

    // 残高チェック（トランザクション実行前）
    if (amount && selectedToken) {
      const amountNum = parseFloat(amount);
      const currentBalance = selectedToken === 'JPYC'
        ? parseFloat(balances.jpyc.formatted)
        : selectedToken === 'POL'
        ? parseFloat(balances.matic.formatted)
        : parseFloat(balances.nht.formatted);

      if (amountNum > currentBalance) {
        alert(
          `❌ 残高不足です\n\n` +
          `送金額: ${amount} ${selectedToken}\n` +
          `現在の残高: ${currentBalance.toFixed(2)} ${selectedToken}\n\n` +
          `残高を確認してから再度お試しください。`
        );
        return;
      }
    }

    // Signerとアドレスの取得（PrivyまたはThirdweb）
    let signer: ethers.Signer | null = null;
    let userAddress: string | null = null;

    // Privyの埋め込みウォレットを最優先
    if (user?.wallet?.address) {
      try {
        // wallets配列から同じアドレスのウォレットを探す
        const embeddedWallet = wallets.find(
          w => w.address.toLowerCase() === user?.wallet?.address.toLowerCase()
        );

        if (embeddedWallet) {
          signer = await getPrivyEthersSigner(embeddedWallet);
          userAddress = user.wallet.address;

          if (signer) {
            const signerAddress = await signer.getAddress();
          }
        } else {
          console.warn('⚠️ Embedded wallet not found in wallets array (handleSend)');
          // walletsReady が false の可能性があるので、エラーメッセージを表示
          if (!walletsReady) {
            alert('ウォレットの初期化に失敗しました。ページをリロードしてください。\n\nPrivy iframe読み込みエラーの可能性があります。ブラウザのキャッシュをクリアしてお試しください。');
            return;
          }
        }
      } catch (error) {
        console.error('❌ Failed to get Privy embedded wallet signer:', error);
        signer = null;
        userAddress = null;
      }
    } else if (privyWallet) {
      try {
        signer = await getPrivyEthersSigner(privyWallet);
        userAddress = privyWallet.address || null;

        if (signer) {
          const signerAddress = await signer.getAddress();
        }
      } catch (error) {
        console.error('❌ Failed to get Privy signer:', error);
        signer = null;
        userAddress = null;
      }
    } else if (authenticated && user) {
      // walletsが空でも、userオブジェクトから直接ウォレット情報を取得

      // linkedAccountsから埋め込みウォレットを探す
      const embeddedWalletAccount = user.linkedAccounts?.find((account: any) =>
        account.type === 'wallet' && account.walletClientType === 'privy'
      );

      if (embeddedWalletAccount) {
        console.error('❌ Embedded wallet exists in linkedAccounts but not in wallets array');
        console.error('  - This indicates a Privy SDK issue');
        console.error('  - Wallet address from linkedAccounts:', embeddedWalletAccount.address);
        alert('ウォレットの接続に問題があります。ページを再読み込みしてください。');
      } else {
        console.error('❌ No embedded wallet found in linkedAccounts');
        alert('ウォレットが見つかりません。ログインし直してください。');
      }
    } else if (thirdwebSigner) {
      // Thirdwebウォレット
      signer = thirdwebSigner;
      userAddress = thirdwebAddress || null;
    } else {
      console.error('❌ No wallet found!');
    }

    if (!signer || !userAddress) {
      console.error('❌ Signer or address is null:', { signer, userAddress });
      alert('ウォレットが接続されていません。ページを再読み込みしてください。');
      return;
    }

    if (!address || !amount) {
      alert('宛先アドレスと数量を入力してください');
      return;
    }

    // アドレス検証（前後の空白を除去してから検証）
    const trimmedAddress = address.trim();

    if (!ethers.utils.isAddress(trimmedAddress)) {
      console.error('❌ Invalid address:', trimmedAddress);
      alert(`無効なアドレスです\n\n入力されたアドレス: ${trimmedAddress}\n\n正しいEthereumアドレス形式(0xで始まる42文字)を入力してください。`);
      return;
    }


    try {
      setIsSending(true);

      if (!signer) {
        throw new Error('Signerが見つかりません');
      }

      // アドレスを正規化（チェックサム形式に変換）
      const normalizedAddress = ethers.utils.getAddress(trimmedAddress);

      // 数量をwei単位に変換
      const amountWei = ethers.utils.parseUnits(amount, 18);

      // POL送信の場合
      if (selectedToken === 'POL') {
        // MATICバランスチェック
        const maticBalance = await signer.getBalance();

        if (maticBalance.lt(amountWei)) {
          alert(
            `❌ 残高不足です\n\n` +
            `送金額: ${amount} POL\n` +
            `残高: ${ethers.utils.formatEther(maticBalance)} POL`
          );
          setIsSending(false);
          return;
        }

        // POL(ネイティブトークン)を直接送信
        const tx = await signer.sendTransaction({
          to: normalizedAddress,
          value: amountWei,
          gasLimit: 21000, // POL/MATIC送金の標準ガスリミット
        });


        const receipt = await tx.wait();


        // トランザクション成功後、Supabaseに送金メッセージを保存
        try {
          await saveTransferMessage({
            fromAddress: actualAddress,
            toAddress: normalizedAddress,
            amount: amount,
            message: message,
            txHash: receipt.transactionHash,
            tokenSymbol: 'POL',
            tenantId: 'default',
            isAnonymous: isAnonymous, // 匿名送金フラグ
          });
        } catch (saveError) {
          console.error('❌ 送金メッセージの保存に失敗:', saveError);
          alert(
            `⚠️ 送金は成功しましたが、履歴の保存に失敗しました\n\n` +
            `トランザクションハッシュ:\n${receipt.transactionHash}\n\n` +
            `送金先: ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}\n` +
            `数量: ${amount} POL`
          );
          setIsSending(false);
          return;
        }

        alert(
          `✅ 送金が完了しました！\n\n` +
          `送金先: ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}\n` +
          `数量: ${amount} POL\n` +
          `トランザクションハッシュ:\n${receipt.transactionHash}`
        );

        // POL送金後もXシェア処理を実行するため、returnせずに処理を継続
      } else {
        // JPYC/NHT送信の場合
        const tokenAddress = JPYC_TOKEN.ADDRESS;

      // テナントチップモードの場合は従来のコントラクトを使用
      if (sendMode === 'tenant') {
        // 1. トークンコントラクトを準備
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_MIN_ABI,
          signer
        );

        // 2. SBTコントラクトにapprove
        const gifterraAddress = getGifterraAddress();
        const approveTx = await tokenContract.approve(
          gifterraAddress,
          amountWei
        );
        await approveTx.wait();

        // 3. SBTコントラクトのtip関数を呼び出し（kodomiポイント加算 + SBT自動ミント）
        const sbtContract = new ethers.Contract(
          gifterraAddress,
          CONTRACT_ABI,
          signer
        );

        const tipTx = await sbtContract.tip(amountWei);
        const receipt = await tipTx.wait();

        alert(
          `✅ テナントチップ送金が完了しました！\n\n` +
          `送金先: ${selectedTenant?.name || 'テナント'}\n` +
          `アドレス: ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}\n` +
          `数量: ${amount} ${selectedToken}\n\n` +
          `🎁 kodomiポイントが加算されました！\n` +
          `累積ポイントに応じてSBTが自動ミントされます。`
        );
      } else {
        // シンプル送金モード - 通常送金（MATICガス必要）

        // ERC20 Interface を使用して transfer データを手動エンコード
        const erc20Interface = new ethers.utils.Interface(ERC20_MIN_ABI);
        const transferData = erc20Interface.encodeFunctionData('transfer', [
          normalizedAddress,
          amountWei
        ]);

        // MATICバランスチェック
        const maticBalance = await signer.getBalance();

        // トランザクション送信
        // モバイルでもデスクトップでも同じsigner.sendTransaction()を使用
        const tx = await signer.sendTransaction({
          to: tokenAddress,
          data: transferData,
          gasLimit: 100000, // 余裕を持ったガスリミット
        });

        const receipt = await tx.wait();

        // 残高は10秒ごとに自動更新されます

        // トランザクション成功後、Supabaseに送金メッセージを保存（リトライ機能付き）
        let saveSuccess = false;
        try {
          await saveTransferMessage({
            tenantId: 'default', // 送金メッセージは常にdefaultテナントに保存（グローバル機能のため）
            fromAddress: walletAddress || '',
            toAddress: trimmedAddress,
            tokenSymbol: selectedToken,
            amount: amount,
            message: message || undefined,
            txHash: receipt.transactionHash,
            isAnonymous: isAnonymous, // 匿名送金フラグ
          });
          saveSuccess = true;
        } catch (saveError: any) {
          console.error('❌ 送金メッセージの保存に失敗:', saveError);
          // 保存失敗をユーザーに通知（トランザクション自体は成功）
          alert(
            `⚠️ 送金は成功しましたが、履歴の保存に失敗しました\n\n` +
            `トランザクション: ${receipt.transactionHash}\n` +
            `送金先: ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}\n` +
            `数量: ${amount} ${selectedToken}\n\n` +
            `履歴に表示されない場合は、トランザクションハッシュで確認できます。\n` +
            `エラー: ${saveError.message || '不明なエラー'}`
          );
          // 保存失敗してもトランザクション自体は成功しているので処理を継続
        }

        // 送金完了後、GIFTERRAユーザーへの送金なら受取メッセージを表示
        if (recipientProfile?.isGifterraUser && recipientProfile?.receive_message) {
          setRecipientReceiveMessage(recipientProfile.receive_message);
          setShowReceiveMessageModal(true);
        } else if (saveSuccess) {
          // 履歴保存が成功した場合のみ通常のメッセージを表示
          alert(
            `✅ 送金が完了しました！\n\n` +
            `送金先: ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}\n` +
            `数量: ${amount} ${selectedToken}\n\n` +
            `💡 MATICガス代が必要です。残高が更新されました。`
          );
        }
      }
      } // else (JPYC/NHT送信) の終了

      // Xシェアが有効な場合は自動的に投稿画面を開く
      console.log('🔍 X Share Check:', { shareOnX, message: message?.substring(0, 20), address: address?.substring(0, 10) });

      if (shareOnX && message && message.trim()) {
        try {
          console.log('✅ X Share条件を満たしました。プロフィールを取得中...');
          const { data: recipientProfile } = await supabase
            .from('user_profiles')
            .select('twitter_id, display_name')
            .eq('tenant_id', 'default')
            .eq('wallet_address', address.toLowerCase())
            .maybeSingle();

          console.log('📝 受信者プロフィール:', recipientProfile);

          // X投稿テキストを生成
          let tweetText = '';
          if (recipientProfile?.twitter_id) {
            tweetText += `@${recipientProfile.twitter_id}`;
          } else if (recipientProfile?.display_name) {
            tweetText += `${recipientProfile.display_name}さん`;
          }
          tweetText += `\n${message}\n\n`;
          tweetText += `💝 ${amount} ${selectedToken} を送りました\n\n`;
          tweetText += `https://gifterra-safe.vercel.app/\n\n`;
          tweetText += `#GIFTERRA #投げ銭`;

          console.log('📤 ツイートテキスト:', tweetText);

          // X投稿画面を開く
          const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
          console.log('🌐 Opening X with URL:', tweetUrl);
          window.open(tweetUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
          console.error('❌ Failed to open X share:', err);
        }
      } else {
        console.log('❌ X Share条件を満たしていません');
      }

      // フォームをリセット
      setAddress('');
      setAmount('');
      setMessage('');
      setShareOnX(false);
      setSendMode(null);
      setSelectedTenant(null);

    } catch (error: any) {
      console.error('❌ 送金エラー:', error.message || error);
      alert(`❌ 送金に失敗しました\n\nエラー: ${error.message || '不明なエラー'}\nコード: ${error.code || 'N/A'}`);
    } finally {
      setIsSending(false);
    }
  };

  // 一括送金モードの場合は専用UIを表示
  if (sendMode === 'bulk') {
    return (
      <BulkSendForm
        isMobile={isMobile}
        onChangeMode={() => setSendMode(null)}
        recipients={bulkSendRecipients}
        setRecipients={setBulkSendRecipients}
      />
    );
  }

  return (
    <div
      id="send-form-section"
      style={{
        background: 'linear-gradient(135deg, #f0f7ff 0%, #e0f0ff 100%)',
        border: '2px solid rgba(59, 130, 246, 0.2)',
        borderRadius: isMobile ? 16 : 24,
        padding: isMobile ? 14 : 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        position: 'relative',
      }}
    >
      <h2 style={{ margin: '0 0 14px 0', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#1a1a1a' }}>
        送金
      </h2>

      {/* コンパクトな残高表示 */}
      <div style={{
        marginBottom: 20,
        padding: isMobile ? '12px 14px' : '14px 16px',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
        border: '1px solid rgba(102, 126, 234, 0.2)',
        borderRadius: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{
            fontSize: isMobile ? 11 : 13,
            fontWeight: 700,
            color: '#1a1a1a',
          }}>
            {isMobile ? '🔓 ウォレット資産（読み取りのみ）' : '🔓 あなたのウォレット内の資産（読み取りのみ）'}
          </div>
          <button
            onClick={() => setBalanceVisible(!balanceVisible)}
            style={{
              padding: '4px 10px',
              background: 'rgba(102, 126, 234, 0.1)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: 6,
              color: '#667eea',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
            }}
          >
            {balanceVisible ? '👁️ 隠す' : '👁️ 表示'}
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          {/* JPYC */}
          <div style={{
            padding: isMobile ? '8px 10px' : '10px 12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 8,
            color: '#ffffff',
            position: 'relative',
          }}>
            <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>JPYC</div>
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700 }}>
              {balanceVisible
                ? (balances.jpyc.loading ? '...' : balances.jpyc.error ? '⚠️' : balances.jpyc.formatted)
                : '****'}
            </div>
            {balanceVisible && balances.jpyc.error && (
              <div style={{ fontSize: 8, color: '#fecaca', marginTop: 2 }}>
                {balances.jpyc.error}
              </div>
            )}
            <img
              src="/JPYC-logo.png"
              alt="JPYC"
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                width: 24,
                height: 24,
                objectFit: 'contain',
                opacity: 0.9,
              }}
            />
          </div>

          {/* POL (旧MATIC) */}
          <div style={{
            padding: isMobile ? '8px 10px' : '10px 12px',
            background: 'linear-gradient(135deg, #8247e5 0%, #6d28d9 100%)',
            borderRadius: 8,
            color: '#ffffff',
            position: 'relative',
          }}>
            <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>POL</div>
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700 }}>
              {balanceVisible
                ? (balances.matic.loading ? '...' : balances.matic.formatted)
                : '****'}
            </div>
            <img
              src="/polygon-logo.png"
              alt="Polygon"
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                width: 24,
                height: 24,
                objectFit: 'contain',
                opacity: 0.9,
              }}
            />
          </div>
        </div>
      </div>

      {/* JPYC/MATIC準備ボタン */}
      <button
        onClick={() => setShowPrepModal(true)}
        style={{
          width: '100%',
          padding: isMobile ? '14px 18px' : '16px 20px',
          marginBottom: 20,
          background: parseFloat(balances.jpyc.formatted) === 0 || parseFloat(balances.matic.formatted) < 0.02
            ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: 12,
          color: '#ffffff',
          fontSize: isMobile ? 14 : 15,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        {parseFloat(balances.jpyc.formatted) === 0 || parseFloat(balances.matic.formatted) < 0.02 ? '🟡' : '💡'}
        <span>JPYCやガス(MATIC)がまだの方はこちら</span>
      </button>

      {/* 送金モード表示 */}
      {sendMode && (
        <div style={{
          marginBottom: 20,
          padding: isMobile ? '14px 16px' : '16px 20px',
          background: sendMode === 'tenant'
            ? 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
            : sendMode === 'simple'
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          border: sendMode === 'tenant'
            ? '3px solid #764ba2'
            : sendMode === 'simple'
            ? '3px solid #10b981'
            : '3px solid #3b82f6',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
        }}>
          <div>
            <div style={{
              fontSize: isMobile ? 16 : 18,
              fontWeight: 800,
              marginBottom: 4,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              {sendMode === 'simple' && '💸 シンプル送金'}
              {sendMode === 'anonymous' && '🕶️ 匿名送金'}
              {sendMode === 'tenant' && '🎁 テナントへチップ'}
              {sendMode === 'bulk' && '📤 一括送金'}
              {sendMode === 'bookmark' && '⭐ ブックマークユーザーへ送金'}
            </div>
            {sendMode === 'tenant' && selectedTenant && (
              <div style={{ fontSize: isMobile ? 12 : 13, color: '#ffffff', fontWeight: 600, opacity: 0.95 }}>
                {selectedTenant.icon} {selectedTenant.name}
              </div>
            )}
            {sendMode === 'bookmark' && selectedBookmarkUser && (
              <div style={{ fontSize: isMobile ? 12 : 13, color: '#ffffff', fontWeight: 600, opacity: 0.95 }}>
                👤 {selectedBookmarkUser.name || 'User'}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSendMode(null);
              setSelectedTenant(null);
              setSelectedBookmarkUser(null);
              setAddress('');
            }}
            style={{
              padding: isMobile ? '8px 14px' : '10px 18px',
              background: '#ffffff',
              border: '2px solid rgba(255,255,255,0.9)',
              borderRadius: 8,
              color: sendMode === 'tenant' ? '#764ba2' : sendMode === 'simple' ? '#10b981' : '#3b82f6',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            }}
          >
            変更
          </button>
        </div>
      )}

      {/* テナントチップ時の説明 */}
      {sendMode === 'tenant' && (
        <div style={{
          marginBottom: 16,
          padding: isMobile ? '10px 12px' : '12px 14px',
          background: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          borderRadius: 8,
          fontSize: isMobile ? 11 : 12,
          lineHeight: 1.5,
        }}>
          💡 メッセージを書くとkodomi算出に有利になります
        </div>
      )}

      {/* 匿名送金時の警告メッセージ */}
      {isAnonymous && (
        <div style={{
          marginBottom: 16,
          padding: isMobile ? '12px 14px' : '14px 16px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 12,
        }}>
          <div style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            marginBottom: 8,
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>⚠️</span>
            <span>匿名送金について</span>
          </div>
          <div style={{
            fontSize: isMobile ? 11 : 12,
            lineHeight: 1.6,
            color: '#92400e',
          }}>
            • アプリ内では送信者情報が非表示になります<br />
            • ブロックチェーン上は公開されます（Polygonscan等で確認可能）<br />
            • 完全な匿名性は保証されません
          </div>
        </div>
      )}

      {/* 匿名送金拒否エラー */}
      {isAnonymous && recipientProfile?.reject_anonymous_transfers && (
        <div style={{
          marginBottom: 16,
          padding: isMobile ? '12px 14px' : '14px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '2px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 12,
        }}>
          <div style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            marginBottom: 8,
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>🚫</span>
            <span>匿名送金はできません</span>
          </div>
          <div style={{
            fontSize: isMobile ? 11 : 12,
            lineHeight: 1.6,
            color: '#991b1b',
          }}>
            この受信者は匿名送金を拒否しています。<br />
            匿名送金トグルをOFFにして、通常の送金（氏名表示あり）に切り替えてください。
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: isMobile ? 13 : 14, color: '#1a1a1a', fontWeight: 700, marginBottom: 8 }}>
          宛先アドレス {(sendMode === 'tenant' || sendMode === 'bookmark') && '（自動入力済み）'}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={
              sendMode === 'tenant' ? 'テナントを選択してください' :
              sendMode === 'bookmark' ? 'ブックマークユーザーを選択してください' :
              '0x...'
            }
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={sendMode === 'tenant' || sendMode === 'bookmark'}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '12px 14px',
              paddingRight: (sendMode !== 'tenant' && sendMode !== 'bookmark') ? (isMobile ? '50px' : '60px') : (isMobile ? '10px 12px' : '12px 14px'),
              background: (sendMode === 'tenant' || sendMode === 'bookmark') ? '#f5f5f5' : '#ffffff',
              border: '2px solid #3b82f6',
              borderRadius: 8,
              color: '#1a1a1a',
              fontSize: isMobile ? 14 : 15,
              opacity: (sendMode === 'tenant' || sendMode === 'bookmark') ? 0.6 : 1,
              cursor: (sendMode === 'tenant' || sendMode === 'bookmark') ? 'not-allowed' : 'text',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          />
        </div>

        {/* 受取人プロフィール表示 */}
        {(sendMode === 'simple' || sendMode === 'anonymous' || sendMode === 'bulk' || sendMode === 'bookmark') && address && address.trim().length === 42 && (
          <div style={{
            marginTop: 12,
            padding: isMobile ? '12px' : '14px',
            background: recipientProfile?.isGifterraUser
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(156, 163, 175, 0.1)',
            border: `1px solid ${recipientProfile?.isGifterraUser ? 'rgba(16, 185, 129, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`,
            borderRadius: 8,
          }}>
            {isLoadingProfile ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#6b7280',
                fontSize: isMobile ? 13 : 14,
              }}>
                <div style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(107, 114, 128, 0.3)',
                  borderTop: '2px solid #6b7280',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                確認中...
              </div>
            ) : recipientProfile?.isGifterraUser ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: recipientProfile.avatar_url
                    ? 'transparent'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 20 : 24,
                  flexShrink: 0,
                }}>
                  {recipientProfile.avatar_url ? (
                    <img
                      src={recipientProfile.avatar_url}
                      alt={recipientProfile.display_name || 'User'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) parent.innerHTML = '👤';
                      }}
                    />
                  ) : (
                    '👤'
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 600,
                      color: '#10b981',
                    }}>
                      GIFTERRAユーザー
                    </span>
                  </div>
                  <div style={{
                    fontSize: isMobile ? 15 : 16,
                    fontWeight: 700,
                    color: '#1a1a1a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {recipientProfile.display_name || '名前未設定'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  fontSize: isMobile ? 18 : 20,
                }}>
                  ⚠️
                </span>
                <div style={{
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#6b7280',
                }}>
                  外部ウォレット（GIFTERRA未登録）
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: isMobile ? 13 : 14, color: '#1a1a1a', fontWeight: 700, marginBottom: 8 }}>
          数量
        </label>

        {/* テナントチップ時は固定金額ボタン表示 */}
        {sendMode === 'tenant' && selectedToken === 'JPYC' && (
          <div style={{
            display: 'flex',
            gap: isMobile ? 6 : 8,
            marginBottom: 12,
          }}>
            {[100, 500, 1000].map((presetAmount) => (
              <button
                key={presetAmount}
                onClick={() => setAmount(presetAmount.toString())}
                style={{
                  flex: 1,
                  padding: isMobile ? '8px 10px' : '10px 12px',
                  background: amount === presetAmount.toString()
                    ? `${currentToken.color}33`
                    : '#ffffff',
                  border: amount === presetAmount.toString()
                    ? `2px solid ${currentToken.color}`
                    : '2px solid #3b82f6',
                  borderRadius: 8,
                  color: amount === presetAmount.toString() ? currentToken.color : '#1a1a1a',
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                {presetAmount} {currentToken.symbol}
              </button>
            ))}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <input
            type="number"
            placeholder={`0 ${currentToken.symbol}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '12px 14px',
              paddingRight: isMobile ? '90px' : '110px',
              background: '#ffffff',
              border: '2px solid #3b82f6',
              borderRadius: 8,
              color: '#1a1a1a',
              fontSize: isMobile ? 14 : 15,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          />
          <button
            onClick={() => setShowTokenDropdown(!showTokenDropdown)}
            style={{
              position: 'absolute',
              right: isMobile ? 8 : 10,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              color: '#ffffff',
              background: currentToken.color,
              padding: isMobile ? '4px 8px' : '5px 10px',
              borderRadius: 6,
              border: `1.5px solid ${currentToken.color}`,
              boxShadow: `0 2px 8px ${currentToken.color}66`,
              cursor: 'pointer',
              zIndex: 10,
              letterSpacing: '0.3px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {currentToken.symbol}
            <span style={{ fontSize: 10 }}>▼</span>
          </button>

          {/* トークン選択ドロップダウン */}
          {showTokenDropdown && (
            <div
              style={{
                position: 'absolute',
                right: isMobile ? 8 : 10,
                top: 'calc(50% + 25px)',
                background: '#ffffff',
                border: '2px solid #3b82f6',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 20,
                minWidth: 120,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  setSelectedToken('JPYC');
                  setShowTokenDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: selectedToken === 'JPYC' ? '#667eea' : '#ffffff',
                  color: selectedToken === 'JPYC' ? '#ffffff' : '#1a1a1a',
                  border: 'none',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (selectedToken !== 'JPYC') {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedToken !== 'JPYC') {
                    e.currentTarget.style.background = '#ffffff';
                  }
                }}
              >
                <img src="/JPYC-logo.png" alt="JPYC" style={{ width: 20, height: 20 }} />
                JPYC
              </button>
              <button
                onClick={() => {
                  setSelectedToken('POL');
                  setShowTokenDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: selectedToken === 'POL' ? '#8247e5' : '#ffffff',
                  color: selectedToken === 'POL' ? '#ffffff' : '#1a1a1a',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (selectedToken !== 'POL') {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedToken !== 'POL') {
                    e.currentTarget.style.background = '#ffffff';
                  }
                }}
              >
                <img src="/polygon-logo.png" alt="POL" style={{ width: 20, height: 20 }} />
                POL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* メッセージ欄 */}
      {sendMode && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: isMobile ? 13 : 14, color: '#1a1a1a', fontWeight: 700, marginBottom: 8 }}>
            メッセージ（任意）
          </label>
          <textarea
            placeholder="メッセージを入力..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '12px 14px',
              background: '#ffffff',
              border: '2px solid #3b82f6',
              borderRadius: 8,
              color: '#1a1a1a',
              fontSize: isMobile ? 14 : 15,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
          {/* Xシェアトグル */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 8,
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: isMobile ? 13 : 14,
              color: '#666',
              userSelect: 'none',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1DA1F2' }}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>Xにメッセージをシェア</span>
              {/* スライドトグル */}
              <div
                onClick={() => setShareOnX(!shareOnX)}
                style={{
                  position: 'relative',
                  width: 44,
                  height: 24,
                  background: shareOnX
                    ? 'linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%)'
                    : '#ddd',
                  borderRadius: 12,
                  transition: 'background 0.3s',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: shareOnX ? 22 : 2,
                    width: 20,
                    height: 20,
                    background: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </label>
          </div>
        </div>
      )}

      {!sendMode ? (
        <button
          onClick={() => setShowModeModal(true)}
          style={{
            width: '100%',
            padding: isMobile ? '14px' : '16px',
            background: '#ffffff',
            border: `3px solid #3b82f6`,
            borderRadius: 12,
            color: '#1a1a1a',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}
        >
          送金タイプを選択
        </button>
      ) : (
        <button
          onClick={() => {
            handleSend();
          }}
          disabled={isSending || !address || !amount || (isAnonymous && recipientProfile?.reject_anonymous_transfers)}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '14px',
            background: isSending || !address || !amount || (isAnonymous && recipientProfile?.reject_anonymous_transfers)
              ? '#cccccc'
              : `linear-gradient(135deg, ${currentToken.color} 0%, ${currentToken.color}dd 100%)`,
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600,
            cursor: isSending || !address || !amount || (isAnonymous && recipientProfile?.reject_anonymous_transfers) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            opacity: isSending || !address || !amount || (isAnonymous && recipientProfile?.reject_anonymous_transfers) ? 0.6 : 1,
          }}
        >
          {isSending ? '送金中...' : (isAnonymous && recipientProfile?.reject_anonymous_transfers) ? '送金不可（匿名拒否）' : '送金する'}
        </button>
      )}

      {/* 匿名送金トグル */}
      {sendMode !== 'bulk' && sendMode !== 'tenant' && (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: isMobile ? 13 : 14,
              color: '#666',
              userSelect: 'none',
            }}
          >
            <span>🕶️</span>
            <span>匿名送金</span>
            {/* スライドトグル */}
            <div
              onClick={() => setIsAnonymous(!isAnonymous)}
              style={{
                position: 'relative',
                width: 44,
                height: 24,
                background: isAnonymous
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#ddd',
                borderRadius: 12,
                transition: 'background 0.3s',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: isAnonymous ? 22 : 2,
                  width: 20,
                  height: 20,
                  background: '#fff',
                  borderRadius: '50%',
                  transition: 'left 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </label>
        </div>
      )}

      {/* 送金モード選択モーダル */}
      {showModeModal && (
        <SendModeModal
          isMobile={isMobile}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode) => {
            setSendMode(mode);
            setShowModeModal(false);
            if (mode === 'tenant') {
              setShowTenantModal(true);
            } else if (mode === 'bookmark') {
              setShowBookmarkSelectModal(true);
            }
          }}
        />
      )}

      {/* テナント選択モーダル */}
      {showTenantModal && (
        <TenantSelectModal
          isMobile={isMobile}
          onClose={() => {
            setShowTenantModal(false);
            if (!selectedTenant) {
              setSendMode(null); // テナント未選択でキャンセルした場合はモードもリセット
            }
          }}
          onSelectTenant={handleTenantSelect}
        />
      )}

      {/* ブックマークユーザー選択モーダル */}
      {showBookmarkSelectModal && (
        <BookmarkUserModal
          userAddress={actualAddress}
          isMobile={isMobile}
          mode="select"
          onClose={() => {
            setShowBookmarkSelectModal(false);
            if (!selectedBookmarkUser) {
              setSendMode(null); // ユーザー未選択でキャンセルした場合はモードもリセット
            }
          }}
          onSelectUser={(userAddress, userName) => {

            // モーダルを閉じる前に状態を更新
            setShowBookmarkSelectModal(false);

            // 状態更新を確実に反映させるため、少し遅延してから設定
            setTimeout(() => {
              setSelectedBookmarkUser({ address: userAddress, name: userName });
              setAddress(userAddress);
              setSendMode('bookmark');

              // さらに遅延してスクロール（プロフィール取得を待つ）
              setTimeout(() => {
                const sendFormSection = document.getElementById('send-form-section');
                if (sendFormSection) {
                  sendFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 200);
            }, 50);
          }}
          onAddToBulkSend={handleAddToBulkSend}
        />
      )}

      {/* 受取メッセージモーダル */}
      {showReceiveMessageModal && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: isMobile ? 16 : 24,
          }}
          onClick={() => setShowReceiveMessageModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              maxWidth: 500,
              width: '100%',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <div style={{
                fontSize: isMobile ? 48 : 56,
                marginBottom: 16,
              }}>
                ✅
              </div>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? 20 : 24,
                fontWeight: 700,
                color: '#1a1a1a',
              }}>
                送金が完了しました！
              </h3>
              <div style={{
                padding: isMobile ? '16px 20px' : '20px 24px',
                background: 'rgba(255, 255, 255, 0.8)',
                borderRadius: 12,
                border: '1px solid rgba(59, 130, 246, 0.2)',
                marginTop: 20,
              }}>
                <div style={{
                  fontSize: isMobile ? 13 : 14,
                  color: '#6b7280',
                  marginBottom: 8,
                  fontWeight: 600,
                }}>
                  受取人からのメッセージ
                </div>
                <div style={{
                  fontSize: isMobile ? 16 : 18,
                  color: '#1a1a1a',
                  fontWeight: 600,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {recipientReceiveMessage}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowReceiveMessageModal(false)}
              style={{
                width: '100%',
                padding: isMobile ? '14px' : '16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: isMobile ? 15 : 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              閉じる
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 初回送金ガイドモーダル */}
      {showFirstSendGuide && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: isMobile ? 16 : 24,
          }}
          onClick={() => {
            setShowFirstSendGuide(false);
            localStorage.setItem('gifterra_first_send_guide_shown', 'true');
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #fff5e6 0%, #ffe4cc 100%)',
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              maxWidth: 500,
              width: '100%',
              border: '2px solid rgba(251, 146, 60, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <div style={{
                fontSize: isMobile ? 48 : 56,
                marginBottom: 16,
              }}>
                💡
              </div>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? 20 : 24,
                fontWeight: 700,
                color: '#1a1a1a',
              }}>
                初めての送金について
              </h3>
              <div style={{
                padding: isMobile ? '16px 20px' : '20px 24px',
                background: 'rgba(255, 255, 255, 0.8)',
                borderRadius: 12,
                border: '1px solid rgba(251, 146, 60, 0.2)',
                marginTop: 20,
                textAlign: 'left',
              }}>
                <div style={{
                  fontSize: isMobile ? 14 : 15,
                  color: '#1a1a1a',
                  lineHeight: 1.8,
                  marginBottom: 16,
                }}>
                  送金を実行すると、英語の承認画面が表示されます。
                </div>
                <div style={{
                  fontSize: isMobile ? 14 : 15,
                  color: '#1a1a1a',
                  lineHeight: 1.8,
                  marginBottom: 16,
                }}>
                  <strong style={{ color: '#f97316', fontSize: isMobile ? 15 : 16 }}>
                    「Approve」ボタン
                  </strong>
                  をタップして、送金を承認してください。
                </div>
                <div style={{
                  padding: 12,
                  background: 'rgba(251, 146, 60, 0.1)',
                  borderRadius: 8,
                  border: '1px solid rgba(251, 146, 60, 0.2)',
                }}>
                  <div style={{
                    fontSize: isMobile ? 13 : 14,
                    color: '#666',
                    lineHeight: 1.6,
                  }}>
                    ⚠️ この承認画面は初回のみ表示されます。2回目以降の送金では表示されません。
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowFirstSendGuide(false);
                localStorage.setItem('gifterra_first_send_guide_shown', 'true');
                // ガイドを閉じた後、送金処理を再実行
                handleSend();
              }}
              style={{
                width: '100%',
                padding: isMobile ? '14px' : '16px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: isMobile ? 15 : 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              理解しました。送金を続ける
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* JPYC準備モーダル */}
      {showPrepModal && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: isMobile ? 16 : 24,
          }}
          onClick={() => setShowPrepModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: isMobile ? 20 : 32,
              maxWidth: 600,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: isMobile ? 17 : 19,
                fontWeight: 700,
                color: '#1a1a1a',
              }}>
                JPYCの準備と初回ガス（MATIC/POL）
              </h3>
              <button
                onClick={() => setShowPrepModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* 手順説明 */}
            <div style={{
              padding: 12,
              background: '#f0f9ff',
              borderRadius: 12,
              marginBottom: 12,
              fontSize: 12,
              color: '#0c4a6e',
              lineHeight: 1.5,
            }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ display: 'block', marginBottom: 4, color: '#075985', fontSize: 13 }}>Step A：JPYCを入手</strong>
                JPYC公式サイトからJPYCを購入、またはJPYC社からの送金履歴があるウォレットを用意します。
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ display: 'block', marginBottom: 4, color: '#075985', fontSize: 13 }}>Step B：残高を確認</strong>
                ウォレット内のMATIC（POL）が 0.02 以下であることを確認してください。
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                ※ 詳細・最新情報は各リンク先でご確認ください。
              </div>
            </div>

            {/* Step A: JPYC入手 */}
            <div style={{
              padding: 12,
              background: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: 12,
              marginBottom: 12,
            }}>
              <h4 style={{
                margin: '0 0 8px 0',
                fontSize: 14,
                fontWeight: 700,
                color: '#92400e',
              }}>
                Step A: JPYCを入手する
              </h4>
              <p style={{
                margin: '0 0 10px 0',
                fontSize: 12,
                color: '#78350f',
                lineHeight: 1.5,
              }}>
                JPYC公式サイトでアカウント開設（要KYC）を行い、JPYCを取得してください。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <a
                  href="https://jpyc.co.jp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 10,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    textAlign: 'center',
                    borderRadius: 8,
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontSize: 13,
                  }}
                >
                  <img
                    src="/JPYC-logo.png"
                    alt="JPYC"
                    style={{
                      width: 20,
                      height: 20,
                      objectFit: 'contain'
                    }}
                  />
                  JPYC公式サイトへ
                </a>
                <button
                  onClick={() => {
                    const addressToUse = actualAddress || walletAddress || address;
                    if (addressToUse) {
                      navigator.clipboard.writeText(addressToUse);
                      alert('ウォレットアドレスをコピーしました！\n' + addressToUse);
                    } else {
                      alert('ウォレットアドレスが取得できません');
                    }
                  }}
                  style={{
                    padding: 10,
                    background: '#ffffff',
                    border: '2px solid #f59e0b',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#92400e',
                  }}
                >
                  📋 ウォレットアドレスをコピー
                </button>
              </div>
            </div>

            {/* Step B: ガス代サポート */}
            <div style={{
              padding: 12,
              background: '#dbeafe',
              border: '2px solid #3b82f6',
              borderRadius: 12,
              marginBottom: 12,
            }}>
              <h4 style={{
                margin: '0 0 8px 0',
                fontSize: 14,
                fontWeight: 700,
                color: '#1e3a8a',
              }}>
                Step B: 初回ガス代（MATIC/POL）のサポート
              </h4>
              <p style={{
                margin: '0 0 10px 0',
                fontSize: 12,
                color: '#1e40af',
                lineHeight: 1.5,
              }}>
                JPYCユーザーガス代支援が初回のガス代（約0.02MATIC/POL）をサポートします。
              </p>
              <button
                onClick={() => {
                  const addressToUse = actualAddress || walletAddress || address;
                  const supportUrl = `https://jpyc-volunteer.vercel.app/?address=${addressToUse}&network=polygon`;

                  // ChainIDが取得できている場合のみチェック
                  if (chainId && chainId !== 137) {
                    alert('⚠️ Polygon Mainnet (ChainID: 137) に接続してください。現在のネットワーク: ' + chainId);
                    return;
                  }

                  window.open(supportUrl, '_blank');
                }}
                style={{
                  width: '100%',
                  padding: 10,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                🆘 ガス代サポートページへ
              </button>
            </div>

            {/* 注意事項 */}
            <div style={{
              padding: 10,
              background: '#f1f5f9',
              borderRadius: 8,
              fontSize: 10,
              color: '#64748b',
              lineHeight: 1.4,
            }}>
              ※ JPYC公式サイトおよびJPYCユーザーのガス代支援による外部サービスへの案内です。
              <br />
              ※ GIFTERRAはJPYCの販売・送金代行・ガス支援を行っておりません。
              <br />
              ※ サービスの詳細・最新情報は各リンク先でご確認ください。
              <br />
              ※ 各サービスの利用・トークンの送受信は自己責任で行ってください。
              <br />
              ※ 本サービス（コンテンツ・作品等）はJPYC株式会社による公式コンテンツではありません。
              <br />
              ※ 「JPYC」はJPYC株式会社の提供するステーブルコインです。
              <br />
              ※ JPYC及びJPYCロゴは、JPYC株式会社の登録商標です。
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// 送金モード選択モーダル
function SendModeModal({ isMobile, onClose, onSelectMode }: {
  isMobile: boolean;
  onClose: () => void;
  onSelectMode: (mode: SendMode) => void;
}) {
  const modes = [
    {
      id: 'simple' as SendMode,
      icon: '💸',
      title: 'シンプル送金',
      description: '個人アドレスへ自由に送金',
      features: ['自由なアドレス入力', 'kodomi記録なし'],
    },
    {
      id: 'bookmark' as SendMode,
      icon: '⭐',
      title: 'ブックマークユーザーへ送金',
      description: 'よく送金するユーザーから選択',
      features: ['ブックマーク一覧から選択', '簡単・スピーディー', 'アドレス入力不要'],
    },
    {
      id: 'bulk' as SendMode,
      icon: '📤',
      title: '一括送金',
      description: '複数人へ同時に送金',
      features: ['複数アドレス対応', 'シンプルな操作', '効率的な送金'],
    },
    // STUDIOプラン完全実装まで一時的に無効化
    // {
    //   id: 'tenant' as SendMode,
    //   icon: '🎁',
    //   title: 'テナントへチップ',
    //   description: 'テナントを選んで応援',
    //   features: ['テナント一覧から選択', 'kodomi（貢献熱量ポイント）が記録される', '各テナントごとの特典配布が受けられる', 'メッセージ推奨'],
    // },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a24',
          borderRadius: isMobile ? 16 : 24,
          maxWidth: isMobile ? '100%' : 600,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 固定ヘッダー */}
        <div style={{
          padding: isMobile ? 20 : 32,
          paddingBottom: isMobile ? 16 : 24,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
            }}>
              送金タイプを選択
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: 20,
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* スクロール可能なコンテンツ */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 12 : 16,
          padding: isMobile ? 20 : 32,
          paddingTop: isMobile ? 16 : 24,
          overflow: 'auto',
          flex: 1,
        }}>
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: isMobile ? 12 : 16,
                padding: isMobile ? 16 : 20,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 32 }}>{mode.icon}</div>
                {mode.badge && (
                  <div style={{
                    background: mode.badge.color,
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 4,
                  }}>
                    {mode.badge.text}
                  </div>
                )}
              </div>
              <h4 style={{
                margin: '0 0 8px 0',
                fontSize: isMobile ? 16 : 18,
                fontWeight: 700,
                color: '#ffffff',
              }}>
                {mode.title}
              </h4>
              <p style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? 13 : 14,
                opacity: 0.7,
                color: '#ffffff',
              }}>
                {mode.description}
              </p>
              {mode.id === 'tenant' ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 193, 7, 0.15) 100%)',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: 8,
                  padding: isMobile ? '10px 12px' : '12px 14px',
                  marginTop: 8,
                }}>
                  <ul style={{
                    margin: 0,
                    padding: '0 0 0 20px',
                    fontSize: isMobile ? 12 : 13,
                    color: '#ffffff',
                    fontWeight: 600,
                    lineHeight: 1.6,
                  }}>
                    {mode.features.map((feature, i) => (
                      <li key={i}>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul style={{
                  margin: 0,
                  padding: '0 0 0 20px',
                  fontSize: isMobile ? 12 : 13,
                  opacity: 0.6,
                  color: '#ffffff',
                  lineHeight: 1.6,
                }}>
                  {mode.features.map((feature, i) => (
                    <li key={i}>
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// テナント選択モーダル
function TenantSelectModal({ isMobile, onClose, onSelectTenant }: {
  isMobile: boolean;
  onClose: () => void;
  onSelectTenant: (tenant: any) => void;
}) {
  const [tenants, setTenants] = useState<any[]>([]);

  // localStorageからフォロー中のテナント一覧を読み込み
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a24',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? 20 : 32,
          maxWidth: isMobile ? '100%' : 500,
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? 20 : 24,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: isMobile ? 18 : 22,
            fontWeight: 700,
          }}>
            テナントを選択
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: 20,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
          {tenants.length === 0 ? (
            <div style={{
              padding: isMobile ? 16 : 20,
              textAlign: 'center',
              opacity: 0.6,
              color: '#ffffff',
              fontSize: isMobile ? 14 : 15,
            }}>
              テナントをフォローすると、ここに表示されます
            </div>
          ) : (
            tenants.map((tenant) => (
              <button
                key={tenant.tenantId}
                onClick={() => onSelectTenant(tenant)}
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: isMobile ? 12 : 14,
                padding: isMobile ? 12 : 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              {tenant.thumbnail ? (
                <img
                  src={tenant.thumbnail}
                  alt={tenant.name}
                  style={{
                    width: isMobile ? 48 : 56,
                    height: isMobile ? 48 : 56,
                    borderRadius: 8,
                    objectFit: 'cover',
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}
                />
              ) : (
                <div style={{
                  width: isMobile ? 48 : 56,
                  height: isMobile ? 48 : 56,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  border: '2px solid rgba(255,255,255,0.2)',
                }}>
                  {tenant.icon}
                </div>
              )}
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: '#ffffff',
                }}>
                  {tenant.name}
                </div>
                <div style={{
                  fontSize: isMobile ? 11 : 12,
                  opacity: 0.6,
                  fontFamily: 'monospace',
                  color: '#ffffff',
                }}>
                  {tenant.walletAddress}
                </div>
              </div>
              <div style={{
                padding: '4px 10px',
                background: 'rgba(255, 215, 0, 0.2)',
                border: '1px solid rgba(255, 215, 0, 0.4)',
                borderRadius: 999,
                fontSize: isMobile ? 10 : 11,
                fontWeight: 600,
                color: '#ffd700',
              }}>
                {tenant.rank}
              </div>
            </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 一括送金フォーム
function BulkSendForm({ isMobile, onChangeMode, recipients, setRecipients }: {
  isMobile: boolean;
  onChangeMode: () => void;
  recipients: Array<{ id: number; address: string; amount: string }>;
  setRecipients: (value: Array<{ id: number; address: string; amount: string }> | ((prev: Array<{ id: number; address: string; amount: string }>) => Array<{ id: number; address: string; amount: string }>)) => void;
}) {
  // Thirdwebウォレット
  const thirdwebSigner = useSigner();
  const thirdwebAddress = useAddress();

  // Privyウォレット
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // user.wallet から埋め込みウォレットを直接取得
  const privyEmbeddedAddress = user?.wallet?.address;
  const privyWallet = privyEmbeddedAddress
    ? wallets.find(w => w.address.toLowerCase() === privyEmbeddedAddress.toLowerCase())
    : null;

  const [selectedToken, setSelectedToken] = useState<'JPYC' | 'POL'>('JPYC');
  const [isSending, setIsSending] = useState(false);

  // 受取人リストが空の場合は初期レコードを追加
  useEffect(() => {
    if (recipients.length === 0) {
      setRecipients([{ id: 1, address: '', amount: '' }]);
    }
  }, [recipients.length, setRecipients]);

  // 各受取人のプロフィールを管理
  const [recipientProfiles, setRecipientProfiles] = useState<Record<number, RecipientProfile | null>>({});

  const tokenInfoMap: Record<'JPYC' | 'POL', { name: string; symbol: string; description: string; detail: string; color: string; logo?: string }> = {
    JPYC: {
      name: 'JPYC',
      symbol: 'JPYC',
      description: 'ステーブルコイン',
      detail: '日本円と同価値、送金ツールとして利用',
      color: '#667eea',
    },
    POL: {
      name: 'POL',
      symbol: 'POL',
      description: 'Polygon ネイティブトークン',
      detail: 'Polygon エコシステムの基軸通貨',
      color: '#8247e5',
      logo: '/polygon-logo.png',
    },
  };

  const currentToken = tokenInfoMap[selectedToken];

  const addRecipient = () => {
    const newId = Math.max(...recipients.map(r => r.id)) + 1;
    setRecipients([...recipients, { id: newId, address: '', amount: '' }]);
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

  const totalAmount = recipients.reduce((sum, r) => {
    const amount = parseFloat(r.amount) || 0;
    return sum + amount;
  }, 0);

  // 各受取人のプロフィールを取得（デバウンス付き）
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    recipients.forEach((recipient) => {
      if (recipient.address && recipient.address.trim().startsWith('0x') && recipient.address.trim().length === 42) {
        const timer = setTimeout(async () => {
          try {
            const { data, error } = await supabase
              .from('user_profiles')
              .select('wallet_address, display_name, avatar_url, receive_message')
              .eq('wallet_address', recipient.address.trim().toLowerCase())
              .maybeSingle();

            if (!error && data) {
              setRecipientProfiles(prev => ({
                ...prev,
                [recipient.id]: {
                  wallet_address: data.wallet_address,
                  display_name: data.display_name,
                  avatar_url: data.avatar_url,
                  receive_message: data.receive_message || 'ありがとうございました。',
                  isGifterraUser: true,
                },
              }));
            } else {
              setRecipientProfiles(prev => ({
                ...prev,
                [recipient.id]: null,
              }));
            }
          } catch (error) {
            console.error('Failed to fetch profile:', error);
          }
        }, 500);
        timers.push(timer);
      } else {
        // アドレスが無効な場合はプロフィールをクリア
        setRecipientProfiles(prev => {
          const newProfiles = { ...prev };
          delete newProfiles[recipient.id];
          return newProfiles;
        });
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [recipients]);

  // 一括送金処理（Privyは制限付きガスレス、外部ウォレットは通常送金）
  const handleBulkSend = async () => {
    // Signerとアドレスの取得（PrivyまたはThirdweb）
    let signer: ethers.Signer | null = null;
    let userAddress: string | null = null;
    const isPrivyWallet = !!user?.wallet;

    if (user?.wallet?.address) {
      // Privy埋め込みウォレット: wallets配列から同じアドレスのウォレットを探す
      const embeddedWallet = wallets.find(
        w => w.address.toLowerCase() === user.wallet.address.toLowerCase()
      );
      if (embeddedWallet) {
        signer = await getPrivyEthersSigner(embeddedWallet);
        userAddress = user.wallet.address;
      }
    } else if (privyWallet) {
      signer = await getPrivyEthersSigner(privyWallet);
      userAddress = privyWallet.address;
    } else if (thirdwebSigner) {
      signer = thirdwebSigner;
      userAddress = thirdwebAddress || null;
    }

    if (!signer || !userAddress) {
      alert('ウォレットが接続されていません');
      return;
    }

    // バリデーション
    const invalidRecipients = recipients.filter(r => !r.address || !r.amount);
    if (invalidRecipients.length > 0) {
      alert('全ての受取人のアドレスと数量を入力してください');
      return;
    }

    // アドレス検証
    for (const recipient of recipients) {
      if (!ethers.utils.isAddress(recipient.address)) {
        alert(`無効なアドレス: ${recipient.address}`);
        return;
      }
    }

    // Privyウォレットの場合は制限チェック
    if (isPrivyWallet) {
      // 1. 受取人数の制限
      if (recipients.length > BULK_SEND_LIMITS.maxRecipients) {
        alert(
          `⚠️ Privyウォレットでの一括送金は最大${BULK_SEND_LIMITS.maxRecipients}人までです。\n\n` +
          `外部ウォレット（MetaMask等）では制限なく送金できます。`
        );
        return;
      }

      // 2. 1日の送金回数制限
      const todayCount = getTodayBulkSendCount();
      if (todayCount >= BULK_SEND_LIMITS.dailyLimit) {
        alert(
          `⚠️ 本日の一括送金制限に達しました（${BULK_SEND_LIMITS.dailyLimit}回/日）。\n\n` +
          `明日以降、再度お試しください。\n\n` +
          `外部ウォレット（MetaMask等）では制限なく送金できます。`
        );
        return;
      }
    }

    try {
      setIsSending(true);

      const txHashes: string[] = [];

      for (const recipient of recipients) {
        const amountWei = ethers.utils.parseUnits(recipient.amount, 18);

        // アドレスを正規化（チェックサム形式に変換）
        const normalizedAddress = ethers.utils.getAddress(recipient.address);

        let receipt;

        if (selectedToken === 'POL') {
          // POL(ネイティブトークン)を直接送信
          const tx = await signer.sendTransaction({
            to: normalizedAddress,
            value: amountWei,
            gasLimit: 21000, // POL/MATIC送金の標準ガスリミット
          });
          receipt = await tx.wait();
        } else {
          // JPYC: ERC20トークン送信
          const tokenAddress = JPYC_TOKEN.ADDRESS;
          const erc20Interface = new ethers.utils.Interface(ERC20_MIN_ABI);

          // transfer データをエンコード
          const transferData = erc20Interface.encodeFunctionData('transfer', [
            normalizedAddress,
            amountWei
          ]);

          // トランザクションを直接送信
          const tx = await signer.sendTransaction({
            to: tokenAddress,
            data: transferData,
            gasLimit: 65000,
          });
          receipt = await tx.wait();
        }

        txHashes.push(receipt.transactionHash);

        // 送金メッセージを保存（各受信者に対して）
        try {
          await saveTransferMessage({
            tenantId: 'default', // 送金メッセージは常にdefaultテナントに保存（グローバル機能のため）
            fromAddress: userAddress,
            toAddress: normalizedAddress,
            tokenSymbol: selectedToken,
            amount: recipient.amount,
            message: undefined, // 一括送金ではメッセージは保存しない
            txHash: receipt.transactionHash,
          });
        } catch (msgError) {
          console.error('送金メッセージ保存エラー:', msgError);
          // メッセージ保存失敗は送金自体には影響させない
        }
      }

      // Privyウォレットの場合は送金回数をカウント
      if (isPrivyWallet) {
        incrementBulkSendCount();
      }

      alert(
        `✅ ${recipients.length}件の送金が完了しました！\n\n` +
        `送金先:\n${recipients.map(r => `${r.address.slice(0, 6)}...${r.address.slice(-4)} (${r.amount} ${selectedToken})`).join('\n')}\n\n` +
        `💡 MATICガス代が必要です。` +
        (isPrivyWallet ? `\n本日の残り送金回数: ${BULK_SEND_LIMITS.dailyLimit - getTodayBulkSendCount()}回` : '')
      );

      // フォームをリセット
      setRecipients([{ id: 1, address: '', amount: '' }]);

    } catch (error: any) {
      console.error('一括送金エラー:', error);
      alert(`❌ 一括送金に失敗しました\n\nエラー: ${error.message || '不明なエラー'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{
      background: '#ffffff',
      border: '2px solid rgba(59, 130, 246, 0.2)',
      borderRadius: isMobile ? 16 : 24,
      padding: isMobile ? 20 : 28,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#1a1a1a' }}>
        一括送金
      </h2>

      {/* 一括送金の説明と変更ボタン */}
      <div style={{
        marginBottom: 20,
        padding: isMobile ? '14px 16px' : '16px 20px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        border: '3px solid #3b82f6',
        borderRadius: 12,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div>
            <div style={{
              fontSize: isMobile ? 14 : 16,
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: 8,
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              📤 一括送金モード
            </div>
            <div style={{
              fontSize: isMobile ? 11 : 12,
              color: '#ffffff',
              lineHeight: 1.6,
              opacity: 0.95,
            }}>
              複数のアドレスに一度にトークンを送金できます
              {privyWallet && (
                <>
                  <br />
                  <strong>制限:</strong> 最大{BULK_SEND_LIMITS.maxRecipients}人 / {BULK_SEND_LIMITS.dailyLimit}回/日
                  <br />
                  <strong>本日の残り:</strong> {BULK_SEND_LIMITS.dailyLimit - getTodayBulkSendCount()}回
                </>
              )}
            </div>
          </div>
          <button
            onClick={onChangeMode}
            style={{
              padding: isMobile ? '8px 14px' : '10px 18px',
              background: '#ffffff',
              border: '2px solid rgba(255,255,255,0.9)',
              borderRadius: 8,
              color: '#3b82f6',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              flexShrink: 0,
              marginLeft: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            }}
          >
            変更
          </button>
        </div>
      </div>

      {/* トークン選択 */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: isMobile ? 13 : 14, color: '#1a1a1a', fontWeight: 700, marginBottom: 12 }}>
          送金するトークン
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* JPYC */}
          <button
            onClick={() => setSelectedToken('JPYC')}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '14px',
              background: selectedToken === 'JPYC' ? '#667eea' : '#ffffff',
              color: selectedToken === 'JPYC' ? '#ffffff' : '#1a1a1a',
              border: selectedToken === 'JPYC' ? '2px solid #667eea' : '2px solid #e5e7eb',
              borderRadius: 12,
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (selectedToken !== 'JPYC') {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.background = '#f0f4ff';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedToken !== 'JPYC') {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.background = '#ffffff';
              }
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>JPYC</div>
            <img src="/JPYC-logo.png" alt="JPYC" style={{ width: 20, height: 20 }} />
          </button>

          {/* POL */}
          <button
            onClick={() => setSelectedToken('POL')}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '14px',
              background: selectedToken === 'POL' ? '#8247e5' : '#ffffff',
              color: selectedToken === 'POL' ? '#ffffff' : '#1a1a1a',
              border: selectedToken === 'POL' ? '2px solid #8247e5' : '2px solid #e5e7eb',
              borderRadius: 12,
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (selectedToken !== 'POL') {
                e.currentTarget.style.borderColor = '#8247e5';
                e.currentTarget.style.background = '#f5f0ff';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedToken !== 'POL') {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.background = '#ffffff';
              }
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>POL</div>
            <img src="/polygon-logo.png" alt="POL" style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </div>

      {/* 送金先リスト */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: isMobile ? 13 : 14, color: '#1a1a1a', fontWeight: 700, marginBottom: 12 }}>
          送金先（{recipients.length}件）
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recipients.map((recipient, index) => (
            <div
              key={recipient.id}
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: isMobile ? 12 : 14,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, opacity: 0.6 }}>
                  #{index + 1}
                </span>
                {recipients.length > 1 && (
                  <button
                    onClick={() => removeRecipient(recipient.id)}
                    style={{
                      background: 'rgba(255, 100, 100, 0.2)',
                      border: '1px solid rgba(255, 100, 100, 0.3)',
                      borderRadius: 6,
                      color: '#ff6666',
                      fontSize: 11,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    削除
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient.address}
                  onChange={(e) => updateRecipient(recipient.id, 'address', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '8px 10px' : '10px 12px',
                    paddingRight: recipientProfiles[recipient.id]?.display_name ? '120px' : undefined,
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: isMobile ? 13 : 14,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                />
                {recipientProfiles[recipient.id]?.display_name && (
                  <div style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'rgba(16, 185, 129, 1)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    {recipientProfiles[recipient.id]?.display_name}
                  </div>
                )}
              </div>
              <input
                type="number"
                placeholder="数量"
                value={recipient.amount}
                onChange={(e) => updateRecipient(recipient.id, 'amount', e.target.value)}
                min="0"
                step="0.01"
                style={{
                  width: '100%',
                  padding: isMobile ? '8px 10px' : '10px 12px',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: isMobile ? 13 : 14,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 追加ボタン */}
      <button
        onClick={addRecipient}
        style={{
          width: '100%',
          padding: isMobile ? '10px' : '12px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          border: '1px dashed rgba(0,0,0,0.2)',
          borderRadius: 12,
          color: '#ffffff',
          fontSize: isMobile ? 13 : 14,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 20,
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        + 送金先を追加
      </button>

      {/* 合計金額 */}
      <div style={{
        marginBottom: 20,
        padding: isMobile ? '12px' : '14px',
        background: `${currentToken.color}11`,
        border: `1px solid ${currentToken.color}33`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: isMobile ? 13 : 14, opacity: 0.7 }}>
          合計送金額
        </span>
        <span style={{
          fontSize: isMobile ? 18 : 22,
          fontWeight: 900,
          color: currentToken.color,
        }}>
          {totalAmount.toLocaleString()} {selectedToken}
        </span>
      </div>

      {/* 送金ボタン */}
      <button
        onClick={handleBulkSend}
        disabled={isSending || recipients.some(r => !r.address || !r.amount)}
        style={{
          width: '100%',
          padding: isMobile ? '12px' : '14px',
          background: isSending || recipients.some(r => !r.address || !r.amount)
            ? '#cccccc'
            : `linear-gradient(135deg, ${currentToken.color} 0%, ${currentToken.color}dd 100%)`,
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          fontSize: isMobile ? 14 : 15,
          fontWeight: 600,
          cursor: isSending || recipients.some(r => !r.address || !r.amount) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          opacity: isSending || recipients.some(r => !r.address || !r.amount) ? 0.6 : 1,
        }}
      >
        {isSending ? '送金中...' : '一括送金する'}
      </button>
    </div>
  );
}

// 2. JPYC送金リクエスト（EIP-681形式QRコード）
function ReceiveAddress({ isMobile }: { isMobile: boolean }) {
  // Thirdwebウォレット
  const thirdwebAddress = useAddress();

  // Privyウォレット
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // user.wallet から埋め込みウォレットを直接取得
  const privyEmbeddedAddress = user?.wallet?.address;
  const privyWallet = privyEmbeddedAddress
    ? wallets.find(w => w.address.toLowerCase() === privyEmbeddedAddress.toLowerCase())
    : null;

  // 優先順位: Privyの埋め込みウォレット > 接続されたPrivyウォレット > Thirdwebウォレット
  const address = privyEmbeddedAddress || privyWallet?.address || thirdwebAddress;

  const [showModal, setShowModal] = useState(false);
  const [qrDataURL, setQrDataURL] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [urlCopySuccess, setUrlCopySuccess] = useState(false);

  // 受け取りアドレス用QRコード生成（Web URL形式）
  const generateQR = async (recipientAddress: string) => {
    try {
      const QRCode = (await import('qrcode')).default;

      // Web URL形式: スキャンしたらブラウザで受け取りページを開く
      // ReceivePageでアドレスのコピーとMetaMask起動が可能
      const qrContent = `${window.location.origin}/receive?address=${recipientAddress}`;


      const dataURL = await QRCode.toDataURL(qrContent, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrDataURL(dataURL);
    } catch (err) {
      console.error('QRコード生成エラー:', err);
    }
  };

  // モーダルを開く
  const handleOpen = async () => {
    if (!address) {
      alert('ウォレットが接続されていません');
      return;
    }
    await generateQR(address);
    setShowModal(true);
  };

  // アドレスをコピー
  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
      alert('コピーに失敗しました');
    }
  };

  // URLをコピー
  const handleUrlCopy = async () => {
    if (!address) return;
    try {
      const receiveUrl = `${window.location.origin}/receive?address=${address}`;
      await navigator.clipboard.writeText(receiveUrl);
      setUrlCopySuccess(true);
      setTimeout(() => setUrlCopySuccess(false), 2000);
    } catch (err) {
      console.error('URLコピーエラー:', err);
      alert('URLコピーに失敗しました');
    }
  };

  // QRコードをダウンロード
  const handleDownload = () => {
    if (!qrDataURL) return;
    const link = document.createElement('a');
    link.download = `gifterra-address-${address?.slice(0, 6)}.png`;
    link.href = qrDataURL;
    link.click();
  };

  return (
    <>
      <div style={{
        background: '#ffffff',
        border: '2px solid rgba(59, 130, 246, 0.2)',
        borderRadius: isMobile ? 16 : 20,
        padding: isMobile ? '16px 20px' : '20px 28px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#1a1a1a' }}>
          💴 受け取りアドレス
        </h2>

        {/* アドレス表示ボックス - メイン機能 */}
        {address && (
          <div
            onClick={handleCopy}
            style={{
              padding: isMobile ? '10px' : '12px',
              background: copySuccess ? '#d1fae5' : '#f7fafc',
              border: copySuccess ? '2px solid #10b981' : '2px solid #e2e8f0',
              borderRadius: 12,
              marginBottom: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              fontSize: isMobile ? 11 : 12,
              color: '#718096',
              marginBottom: 4,
              fontWeight: 600,
            }}>
              {copySuccess ? '✅ コピーしました！' : '📋 タップしてコピー'}
            </div>
            <div style={{
              wordBreak: 'break-all',
              fontSize: isMobile ? 13 : 14,
              fontFamily: 'monospace',
              color: '#1a1a1a',
              fontWeight: 500,
            }}>
              {address}
            </div>
          </div>
        )}

        <button
          onClick={handleOpen}
          disabled={!address}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '14px',
            background: address
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : '#cccccc',
            border: 'none',
            borderRadius: 12,
            color: '#ffffff',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 700,
            cursor: address ? 'pointer' : 'not-allowed',
            boxShadow: address ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
            opacity: address ? 1 : 0.6,
          }}
        >
          {address ? '📱 QRコードを表示' : 'ウォレット未接続'}
        </button>
      </div>

      {/* QRコード表示モーダル */}
      {showModal && address && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}
        onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: isMobile ? 16 : 24,
              padding: isMobile ? 16 : 32,
              maxWidth: isMobile ? '90%' : 480,
              width: '100%',
              maxHeight: isMobile ? '85vh' : '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 36,
                height: 36,
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>

            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              color: '#1a1a1a',
              textAlign: 'center',
            }}>
              💴 受け取りアドレス
            </h2>

            {/* 説明文 */}
            <div style={{
              margin: '0 0 12px 0',
              fontSize: isMobile ? 11 : 12,
              color: '#4a5568',
              textAlign: 'center',
              lineHeight: 1.5,
              background: '#ecfdf5',
              padding: isMobile ? '10px' : '12px',
              borderRadius: '10px',
              border: '1px solid #10b981',
            }}>
              <div style={{ fontWeight: 600, color: '#065f46', marginBottom: '6px', fontSize: isMobile ? 11 : 12 }}>
                📱 QRコードの使い方
              </div>
              <div style={{ fontSize: isMobile ? 10 : 11, color: '#047857', marginBottom: '8px' }}>
                スマートフォンのカメラやQRコードリーダーで読み取ると、<br />
                受け取り専用ページが開きます。<br />
                アドレスのコピーやMetaMaskアプリの起動が簡単にできます。
              </div>

              {/* URLコピーボタン */}
              <button
                onClick={handleUrlCopy}
                style={{
                  width: '100%',
                  background: urlCopySuccess ? '#d1fae5' : '#ffffff',
                  border: urlCopySuccess ? '2px solid #10b981' : '2px solid #10b981',
                  borderRadius: '8px',
                  padding: isMobile ? '8px 12px' : '10px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  color: urlCopySuccess ? '#065f46' : '#047857',
                }}
              >
                {urlCopySuccess ? '✅ URLをコピーしました！' : '🔗 受け取りURLをコピー'}
              </button>
            </div>

            {/* QRコード */}
            {qrDataURL && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: isMobile ? 12 : 16,
              }}>
                <div style={{
                  padding: isMobile ? 12 : 14,
                  background: '#ffffff',
                  border: '2px solid #10b981',
                  borderRadius: 12,
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.2)',
                }}>
                  <img
                    src={qrDataURL}
                    alt="JPYC Payment Request QR Code"
                    style={{
                      width: isMobile ? 240 : 280,
                      height: isMobile ? 240 : 280,
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            )}

            {/* アドレス表示（タップでコピー） */}
            <div
              onClick={handleCopy}
              style={{
                padding: isMobile ? '10px 12px' : '12px 14px',
                background: copySuccess ? '#d1fae5' : '#f7fafc',
                border: copySuccess ? '2px solid #10b981' : '2px solid #e2e8f0',
                borderRadius: 10,
                marginBottom: isMobile ? 12 : 16,
                wordBreak: 'break-all',
                fontSize: isMobile ? 12 : 13,
                fontFamily: 'monospace',
                color: '#1a1a1a',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {address}
            </div>

            {/* コピー成功メッセージ */}
            {copySuccess && (
              <div style={{
                textAlign: 'center',
                color: '#10b981',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 600,
                marginBottom: isMobile ? 10 : 12,
                marginTop: isMobile ? -8 : -10,
              }}>
                ✓ アドレスをコピーしました！
              </div>
            )}

            {/* ボタン */}
            <div style={{
              display: 'flex',
              gap: isMobile ? 8 : 10,
              flexDirection: isMobile ? 'column' : 'row',
            }}>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  background: copySuccess ? '#10b981' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#ffffff',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {copySuccess ? '✓ コピーしました！' : '📋 アドレスをコピー'}
              </button>

              <button
                onClick={handleDownload}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#ffffff',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                💾 QRコードを保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 2.5. ウォレット情報（残高とNFT）
function WalletInfo({ isMobile }: { isMobile: boolean }) {
  // Thirdwebウォレット
  const thirdwebAddress = useAddress();
  const thirdwebSigner = useSigner();

  // Privyウォレット
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // user.wallet から埋め込みウォレットを直接取得
  const privyEmbeddedAddress = user?.wallet?.address;
  const privyWallet = privyEmbeddedAddress
    ? wallets.find(w => w.address.toLowerCase() === privyEmbeddedAddress.toLowerCase())
    : null;

  // Signerを取得
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [actualAddress, setActualAddress] = useState<string>('');

  useEffect(() => {
    const getSigner = async () => {
      // MetaMaskブラウザを最優先で検出（Privy完全バイパス - モバイル対応）
      if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {

        try {
          // MetaMask 7.59.0対応: selectedAddressがnullの場合は明示的に接続をリクエスト
          if (!window.ethereum.selectedAddress) {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
          }

          const directProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
          const directSigner = directProvider.getSigner();
          const addr = await directSigner.getAddress();

          setSigner(directSigner);
          setActualAddress(addr);
          return;
        } catch (error: any) {
          console.warn('⚠️ [WalletInfo getSigner] MetaMask直接接続失敗:', error.message);
          // フォールバックとしてPrivy経由を試行
        }
      }

      // Privyの埋め込みウォレットを最優先
      // user.wallet にはアドレス情報のみ、実際のプロバイダーは wallets 配列から取得
      if (user?.wallet?.address) {
        try {
          // wallets配列から同じアドレスのウォレットを探す
          const embeddedWallet = wallets.find(
            w => w.address.toLowerCase() === user.wallet.address.toLowerCase()
          );

          if (embeddedWallet) {
            const privySigner = await getPrivyEthersSigner(embeddedWallet);
            setSigner(privySigner);
            if (privySigner) {
              const addr = await privySigner.getAddress();
              setActualAddress(addr);
            }
            return;
          }
        } catch (error) {
          console.error('❌ Failed to get Privy embedded wallet signer (WalletInfo):', error);
        }
      }

      // フォールバック: 接続されているウォレット
      if (privyWallet) {
        const privySigner = await getPrivyEthersSigner(privyWallet);
        setSigner(privySigner);
        if (privySigner) {
          const addr = await privySigner.getAddress();
          setActualAddress(addr);
        }
      } else if (thirdwebSigner) {
        setSigner(thirdwebSigner);
        const addr = await thirdwebSigner.getAddress();
        setActualAddress(addr);
      } else {
        setSigner(null);
        setActualAddress('');
      }
    };
    getSigner();
  }, [user, wallets, privyWallet, thirdwebSigner]);

  // 使用するアドレス（Privyの埋め込みウォレットを最優先）
  const address = privyEmbeddedAddress || actualAddress || privyWallet?.address || thirdwebAddress;

  // ウォレットアドレス変更時の処理
  useEffect(() => {
    // アドレス変更時の処理（必要に応じて追加）
  }, [address, privyEmbeddedAddress, actualAddress, privyWallet, thirdwebAddress, signer]);

  // トークン残高を取得
  const { balances, refetch: refetchBalances } = useTokenBalances(address, signer);

  // NFT/SBTを取得
  const { nfts, loading: nftsLoading } = useUserNFTs(address, signer);

  if (!address) {
    return null; // ウォレット未接続時は非表示
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? 16 : 20,
      marginBottom: isMobile ? 40 : 48,
    }}>
      {/* NFT/SBT一覧 */}
      <div style={{
        background: '#ffffff',
        border: '2px solid rgba(102, 126, 234, 0.2)',
        borderRadius: isMobile ? 16 : 24,
        padding: isMobile ? 20 : 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#1a1a1a' }}>
          🎨 保有NFT/SBT
        </h2>
        {nftsLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#718096' }}>
            読み込み中...
          </div>
        ) : nfts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#718096' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14 }}>まだNFT/SBTを保有していません</div>
            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
              テナントにチップを送ると、SBTが獲得できます
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {nfts.map((nft) => (
              <div
                key={nft.tokenId}
                style={{
                  border: '2px solid #e2e8f0',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#f7fafc',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  aspectRatio: '1',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 64,
                }}>
                  {nft.isSBT ? '🏅' : '🎨'}
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                    {nft.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#718096' }}>
                    {nft.description}
                  </div>
                  <div style={{
                    marginTop: 8,
                    padding: '4px 8px',
                    background: '#667eea',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 6,
                    display: 'inline-block',
                  }}>
                    {nft.rank}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 3. 全体kodomiタンク（法務対応版:JPYC/NHT分離表示）
function OverallKodomiTank({ isMobile }: { isMobile: boolean }) {
  console.log('🎯🎯🎯 [TANK-DEBUG-v2] OverallKodomiTank - コンポーネントレンダリング');
  const { jpyc, resonance, overall, loading, error } = useDualAxisKodomi();

  console.log('[TANK-DEBUG-v2] フック結果:');
  console.log('  loading:', loading);
  console.log('  error:', error);
  console.log('  JPYC総額:', jpyc.totalAmount, 'JPYC');
  console.log('  JPYCランク:', jpyc.rank, 'Lv.' + jpyc.displayLevel, `(${jpyc.level}%)`);
  console.log('  Resonanceランク:', resonance.rank, 'Lv.' + resonance.displayLevel, `(${resonance.level}%)`);
  console.log('  総合スコア:', overall.totalScore, '/', overall.rank, 'Lv.' + overall.displayLevel, `(${overall.level}%)`);

  if (loading) {
    console.log('[TANK-DEBUG-v2] ⏳ 読み込み中表示...');
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? 40 : 60 }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    console.error('[TANK-DEBUG-v2] ❌ エラー:', error);
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? 40 : 60 }}>
        <div style={{ color: 'rgba(255,100,100,0.8)', fontSize: 14 }}>データ取得エラー: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: isMobile ? 40 : 60 }}>
      <LegalCompliantDualAxisTank
        jpycAmount={jpyc.totalAmount}
        jpycTipCount={jpyc.tipCount}
        jpycLevel={jpyc.level}
        jpycDisplayLevel={jpyc.displayLevel}
        jpycRank={jpyc.rank}
        jpycColor={jpyc.color}
        supportCount={resonance.supportCount}
        streakDays={resonance.streakDays}
        engagementScore={resonance.engagementScore}
        resonanceLevel={resonance.level}
        resonanceDisplayLevel={resonance.displayLevel}
        resonanceRank={resonance.rank}
        resonanceColor={resonance.color}
        overallScore={overall.totalScore}
        overallRank={overall.rank}
        overallColor={overall.color}
        overallLevel={overall.level}
        overallDisplayLevel={overall.displayLevel}
        showDetails={true}
        size={isMobile ? 'small' : 'medium'}
      />
    </div>
  );
}

// 4. 応援テナント別カード
function ContributionTenants({ isMobile }: { isMobile: boolean }) {
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [followedTenants, setFollowedTenants] = useState<any[]>([]);

  // localStorageからフォロー中のテナントを読み込み
  useEffect(() => {
    const saved = localStorage.getItem('followed_tenants');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFollowedTenants(parsed);
      } catch (error) {
        console.error('Failed to parse followed tenants:', error);
        setFollowedTenants([]);
      }
    } else {
      // 初期データ（デモ用）
      const initialTenants = [
        { tenantId: 'TN001', name: 'カフェX', kodomi: 2000, rank: 'Silver', sbtCount: 2, icon: '🏪', thumbnail: '', description: 'コーヒーとスイーツのお店', walletAddress: '0x1234...5678' },
        { tenantId: 'TN002', name: 'アーティストY', kodomi: 1500, rank: 'Bronze', sbtCount: 1, icon: '🎨', thumbnail: '', description: 'デジタルアート作品を展開', walletAddress: '0xabcd...ef01' },
        { tenantId: 'TN003', name: 'ショップZ', kodomi: 1734, rank: 'Bronze', sbtCount: 3, icon: '☕', thumbnail: '', description: 'こだわりのコーヒー豆専門店', walletAddress: '0x9876...5432' },
      ];
      setFollowedTenants(initialTenants);
      localStorage.setItem('followed_tenants', JSON.stringify(initialTenants));
    }
  }, []);

  // テナントを追加
  const handleAddTenant = (tenant: any) => {
    // 重複チェック
    const isDuplicate = followedTenants.some(t => t.tenantId === tenant.tenantId);
    if (isDuplicate) {
      alert('このテナントは既にフォローしています');
      return;
    }

    const updatedTenants = [...followedTenants, tenant];
    setFollowedTenants(updatedTenants);
    localStorage.setItem('followed_tenants', JSON.stringify(updatedTenants));
  };

  // テナントを削除
  const handleRemoveTenant = (tenantId: string) => {
    if (confirm('このテナントのフォローを解除しますか？')) {
      const updatedTenants = followedTenants.filter(t => t.tenantId !== tenantId);
      setFollowedTenants(updatedTenants);
      localStorage.setItem('followed_tenants', JSON.stringify(updatedTenants));
    }
  };

  return (
    <>
      <div style={{
        position: 'relative',
        marginBottom: isMobile ? 40 : 60,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? 20 : 28,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: isMobile ? 18 : 22,
            fontWeight: 700,
            color: '#ffffff',
          }}>
            応援テナント
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: isMobile ? '8px 14px' : '10px 18px',
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: 8,
              color: '#ffffff',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
            }}
          >
            ➕ テナント追加
          </button>
        </div>

        {/* 説明文（目立つように） */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '2px solid rgba(255, 255, 255, 0.6)',
          borderRadius: 8,
          padding: isMobile ? '12px 14px' : '14px 16px',
          marginBottom: 20,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <p style={{
              margin: 0,
              fontSize: isMobile ? 13 : 14,
              color: '#4c1d95',
              fontWeight: 600,
              lineHeight: 1.6,
            }}>
              各テナントはユーティリティートークンによるチップも可能です
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: isMobile ? 12 : 16,
          overflowX: 'auto',
          paddingBottom: 8,
        }}>
          {followedTenants.map((tenant, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                minWidth: isMobile ? 160 : 200,
              }}
            >
              <button
                onClick={() => setSelectedTenant(tenant)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: isMobile ? 16 : 20,
                  padding: isMobile ? 16 : 20,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                }}
              >
              {tenant.thumbnail ? (
                <img
                  src={tenant.thumbnail}
                  alt={tenant.name}
                  style={{
                    width: '100%',
                    height: isMobile ? 120 : 140,
                    objectFit: 'cover',
                    borderRadius: 8,
                    marginBottom: 12,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: isMobile ? 120 : 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  marginBottom: 12,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  border: '2px solid rgba(255,255,255,0.2)',
                }}>
                  {tenant.icon}
                </div>
              )}
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? 14 : 16,
                fontWeight: 700,
                textAlign: 'left',
                color: '#ffffff',
              }}>
                {tenant.name}
              </h3>
              <div style={{
                fontSize: isMobile ? 20 : 24,
                fontWeight: 900,
                marginBottom: 4,
                textAlign: 'left',
                color: '#ffffff',
              }}>
                {tenant.kodomi.toLocaleString()}
              </div>
              <div style={{
                fontSize: isMobile ? 11 : 12,
                opacity: 0.6,
                marginBottom: 12,
                textAlign: 'left',
                color: '#ffffff',
              }}>
                pt
              </div>
              <div style={{
                padding: '4px 12px',
                background: 'rgba(255, 215, 0, 0.2)',
                border: '1px solid rgba(255, 215, 0, 0.4)',
                borderRadius: 999,
                fontSize: isMobile ? 11 : 12,
                fontWeight: 600,
                marginBottom: 8,
                display: 'inline-block',
                color: '#ffd700',
              }}>
                {tenant.rank}
              </div>
              <div style={{
                fontSize: isMobile ? 11 : 12,
                opacity: 0.6,
                textAlign: 'left',
                color: '#ffffff',
              }}>
                SBT: {tenant.sbtCount}個
              </div>
              </button>

              {/* 削除ボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTenant(tenant.tenantId);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  background: 'rgba(239, 68, 68, 0.9)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="フォロー解除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        </div>

        {/* オーバーレイ */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          borderRadius: isMobile ? 16 : 24,
          textAlign: 'center',
          padding: isMobile ? 20 : 30,
          zIndex: 10,
        }}>
          <div style={{
            fontSize: isMobile ? 18 : 24,
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: isMobile ? 8 : 12,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            lineHeight: 1.4,
          }}>
            GIFTERRA STUDIOで全機能解放🔥
          </div>
          <div style={{
            fontSize: isMobile ? 16 : 20,
            fontWeight: 700,
            color: '#fbbf24',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}>
            近日公開！
          </div>
        </div>
      </div>

      {/* テナント詳細モーダル */}
      {selectedTenant && (
        <TenantDetailModal
          isMobile={isMobile}
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}

      {/* テナント追加モーダル */}
      {showAddModal && (
        <AddTenantModal
          isMobile={isMobile}
          onClose={() => setShowAddModal(false)}
          onAddTenant={handleAddTenant}
        />
      )}
    </>
  );
}

// テナント詳細モーダル
function TenantDetailModal({ isMobile, tenant, onClose }: {
  isMobile: boolean;
  tenant: any;
  onClose: () => void;
}) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label}をコピーしました`);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3d 100%)',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? 24 : 32,
          maxWidth: isMobile ? '100%' : 600,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? 20 : 24,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            color: '#EAF2FF',
          }}>
            テナント詳細
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: 24,
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            ×
          </button>
        </div>

        {/* サムネイル */}
        {tenant.thumbnail ? (
          <img
            src={tenant.thumbnail}
            alt={tenant.name}
            style={{
              width: '100%',
              height: isMobile ? 200 : 300,
              objectFit: 'cover',
              borderRadius: 12,
              marginBottom: 20,
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: isMobile ? 200 : 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
            marginBottom: 20,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            {tenant.icon}
          </div>
        )}

        {/* テナント名 */}
        <h2 style={{
          margin: '0 0 12px 0',
          fontSize: isMobile ? 24 : 28,
          fontWeight: 700,
          color: '#EAF2FF',
        }}>
          {tenant.name}
        </h2>

        {/* ランク */}
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          background: 'rgba(255, 215, 0, 0.2)',
          border: '1px solid rgba(255, 215, 0, 0.4)',
          borderRadius: 999,
          fontSize: isMobile ? 13 : 14,
          fontWeight: 600,
          marginBottom: 20,
          color: '#ffd700',
        }}>
          🏆 {tenant.rank}
        </div>

        {/* 説明 */}
        {tenant.description && (
          <div style={{
            marginBottom: 24,
            padding: isMobile ? 16 : 20,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{
              fontSize: isMobile ? 13 : 14,
              fontWeight: 600,
              marginBottom: 8,
              color: '#EAF2FF',
              opacity: 0.7,
            }}>
              説明
            </div>
            <div style={{
              fontSize: isMobile ? 14 : 15,
              lineHeight: 1.6,
              color: '#EAF2FF',
            }}>
              {tenant.description}
            </div>
          </div>
        )}

        {/* 統計情報 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 12,
          marginBottom: 24,
        }}>
          <div style={{
            padding: isMobile ? 16 : 20,
            background: 'rgba(102, 126, 234, 0.1)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: isMobile ? 12 : 13,
              opacity: 0.7,
              marginBottom: 4,
              color: '#EAF2FF',
            }}>
              kodomi
            </div>
            <div style={{
              fontSize: isMobile ? 24 : 28,
              fontWeight: 900,
              color: '#667eea',
            }}>
              {tenant.kodomi?.toLocaleString() || 0}
            </div>
            <div style={{
              fontSize: isMobile ? 11 : 12,
              opacity: 0.5,
              color: '#EAF2FF',
            }}>
              pt
            </div>
          </div>
          <div style={{
            padding: isMobile ? 16 : 20,
            background: 'rgba(118, 75, 162, 0.1)',
            border: '1px solid rgba(118, 75, 162, 0.2)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: isMobile ? 12 : 13,
              opacity: 0.7,
              marginBottom: 4,
              color: '#EAF2FF',
            }}>
              保有SBT
            </div>
            <div style={{
              fontSize: isMobile ? 24 : 28,
              fontWeight: 900,
              color: '#764ba2',
            }}>
              {tenant.sbtCount || 0}
            </div>
            <div style={{
              fontSize: isMobile ? 11 : 12,
              opacity: 0.5,
              color: '#EAF2FF',
            }}>
              個
            </div>
          </div>
        </div>

        {/* テナントID */}
        <div style={{
          marginBottom: 16,
          padding: isMobile ? 16 : 20,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            marginBottom: 8,
            color: '#EAF2FF',
            opacity: 0.7,
          }}>
            テナントID
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              flex: 1,
              fontSize: isMobile ? 13 : 14,
              fontFamily: 'monospace',
              color: '#EAF2FF',
              wordBreak: 'break-all',
            }}>
              {tenant.tenantId}
            </div>
            <button
              onClick={() => copyToClipboard(tenant.tenantId, 'テナントID')}
              style={{
                padding: '8px 12px',
                background: 'rgba(102, 126, 234, 0.2)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: 6,
                color: '#667eea',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📋 コピー
            </button>
          </div>
        </div>

        {/* ウォレットアドレス */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 16 : 20,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            marginBottom: 8,
            color: '#EAF2FF',
            opacity: 0.7,
          }}>
            ウォレットアドレス
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              flex: 1,
              fontSize: isMobile ? 13 : 14,
              fontFamily: 'monospace',
              color: '#EAF2FF',
              wordBreak: 'break-all',
            }}>
              {tenant.walletAddress}
            </div>
            <button
              onClick={() => copyToClipboard(tenant.walletAddress, 'アドレス')}
              style={{
                padding: '8px 12px',
                background: 'rgba(102, 126, 234, 0.2)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: 6,
                color: '#667eea',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📋 コピー
            </button>
          </div>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: isMobile ? 14 : 16,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            color: '#EAF2FF',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// テナント追加モーダル
function AddTenantModal({ isMobile, onClose, onAddTenant }: {
  isMobile: boolean;
  onClose: () => void;
  onAddTenant: (tenantId: string) => void;
}) {
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [previewTenant, setPreviewTenant] = useState<any>(null);

  // テナントIDで検索（実際にはAPIやlocalStorageから取得）
  const searchTenant = async () => {
    if (!tenantId.trim()) {
      setError('テナントIDを入力してください');
      return;
    }

    setIsSearching(true);
    setError('');
    setPreviewTenant(null);

    // TODO: 実際にはAPIから取得
    // 今はモックデータで検索
    await new Promise(resolve => setTimeout(resolve, 500));

    // localStorageから検索
    const savedProfile = localStorage.getItem('tenant_profile');
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      if (profile.tenantId === tenantId.trim()) {
        setPreviewTenant({
          tenantId: profile.tenantId,
          name: profile.tenantName,
          description: profile.description,
          thumbnail: profile.thumbnail,
          icon: '🏪',
          walletAddress: '0x1234...5678', // TODO: 実際のアドレスを取得
          kodomi: 0,
          rank: 'Bronze',
          sbtCount: 0,
        });
        setIsSearching(false);
        return;
      }
    }

    // モックデータで検索
    const mockTenants: any = {
      'TN001': { tenantId: 'TN001', name: 'カフェX', icon: '🏪', thumbnail: '', walletAddress: '0x1234...5678', kodomi: 2000, rank: 'Silver', description: 'コーヒーとスイーツのお店', sbtCount: 2 },
      'TN002': { tenantId: 'TN002', name: 'アーティストY', icon: '🎨', thumbnail: '', walletAddress: '0xabcd...ef01', kodomi: 1500, rank: 'Bronze', description: 'デジタルアート作品を展開', sbtCount: 1 },
      'TN003': { tenantId: 'TN003', name: 'ショップZ', icon: '☕', thumbnail: '', walletAddress: '0x9876...5432', kodomi: 1734, rank: 'Bronze', description: 'こだわりのコーヒー豆専門店', sbtCount: 3 },
      'TN004': { tenantId: 'TN004', name: 'クリエイターA', icon: '🎭', thumbnail: '', walletAddress: '0xfedc...ba98', kodomi: 3200, rank: 'Gold', description: '音楽とアートのクリエイター', sbtCount: 4 },
    };

    const found = mockTenants[tenantId.trim()];
    if (found) {
      setPreviewTenant(found);
    } else {
      setError('テナントが見つかりませんでした');
    }

    setIsSearching(false);
  };

  const handleAdd = () => {
    if (previewTenant) {
      onAddTenant(previewTenant);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3d 100%)',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? 24 : 32,
          maxWidth: isMobile ? '100%' : 600,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? 20 : 24,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            color: '#EAF2FF',
          }}>
            テナントを追加
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: 24,
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* 説明 */}
        <p style={{
          margin: '0 0 20px 0',
          fontSize: isMobile ? 14 : 15,
          opacity: 0.7,
          color: '#EAF2FF',
          lineHeight: 1.6,
        }}>
          フォローしたいテナントのIDを入力してください。
        </p>

        {/* テナントID入力 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            marginBottom: 8,
            color: '#EAF2FF',
          }}>
            テナントID
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setError('');
                setPreviewTenant(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchTenant();
                }
              }}
              placeholder="例: TN001"
              style={{
                flex: 1,
                padding: isMobile ? '10px 12px' : '12px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
              }}
            />
            <button
              onClick={searchTenant}
              disabled={isSearching}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                background: isSearching ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.5)',
                border: '1px solid rgba(102, 126, 234, 0.5)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: isSearching ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {isSearching ? '検索中...' : '🔍 検索'}
            </button>
          </div>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div style={{
            padding: isMobile ? '10px 12px' : '12px 16px',
            marginBottom: 20,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: isMobile ? 13 : 14,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* プレビュー */}
        {previewTenant && (
          <div style={{
            marginBottom: 24,
            padding: isMobile ? 16 : 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              marginBottom: 12,
              color: '#EAF2FF',
              opacity: 0.7,
            }}>
              プレビュー
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {previewTenant.thumbnail ? (
                <img
                  src={previewTenant.thumbnail}
                  alt={previewTenant.name}
                  style={{
                    width: isMobile ? 60 : 72,
                    height: isMobile ? 60 : 72,
                    borderRadius: 8,
                    objectFit: 'cover',
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}
                />
              ) : (
                <div style={{
                  width: isMobile ? 60 : 72,
                  height: isMobile ? 60 : 72,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  border: '2px solid rgba(255,255,255,0.2)',
                }}>
                  {previewTenant.icon}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: '#EAF2FF',
                }}>
                  {previewTenant.name}
                </div>
                <div style={{
                  fontSize: isMobile ? 12 : 13,
                  opacity: 0.6,
                  marginBottom: 4,
                  fontFamily: 'monospace',
                  color: '#EAF2FF',
                }}>
                  {previewTenant.tenantId}
                </div>
                {previewTenant.description && (
                  <div style={{
                    fontSize: isMobile ? 12 : 13,
                    opacity: 0.7,
                    color: '#EAF2FF',
                  }}>
                    {previewTenant.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ボタン */}
        <div style={{
          display: 'flex',
          gap: 12,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: isMobile ? 14 : 16,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12,
              color: '#EAF2FF',
              fontSize: isMobile ? 15 : 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleAdd}
            disabled={!previewTenant}
            style={{
              flex: 1,
              padding: isMobile ? 14 : 16,
              background: previewTenant ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 12,
              color: '#ffffff',
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              cursor: previewTenant ? 'pointer' : 'not-allowed',
              opacity: previewTenant ? 1 : 0.5,
            }}
          >
            追加する
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. 履歴セクション（タブ式）
function HistorySection({
  isMobile,
  address,
  tenantId,
}: {
  isMobile: boolean;
  address: string | undefined;
  tenantId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: isMobile ? 16 : 24,
      padding: isMobile ? 20 : 28,
      marginBottom: isMobile ? 24 : 32,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>
        📥📤 送受信履歴
      </h2>

      {/* タブボタン */}
      <div style={{
        display: 'flex',
        gap: isMobile ? 8 : 12,
        marginBottom: 16,
      }}>
        <button
          onClick={() => setActiveTab('received')}
          style={{
            flex: 1,
            padding: isMobile ? '10px 16px' : '12px 20px',
            background: activeTab === 'received'
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: activeTab === 'received'
              ? 'none'
              : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            color: '#ffffff',
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'received') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'received') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          <span>📥 受信履歴</span>
          {unreadCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 700,
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          style={{
            flex: 1,
            padding: isMobile ? '10px 16px' : '12px 20px',
            background: activeTab === 'sent'
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: activeTab === 'sent'
              ? 'none'
              : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            color: '#ffffff',
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'sent') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'sent') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          📤 送信履歴
        </button>
      </div>

      {/* コンテンツ表示 */}
      {activeTab === 'received' ? (
        <TransferMessageHistory
          tenantId={tenantId || undefined}
          walletAddress={address}
          isMobile={isMobile}
          onUnreadCountChange={setUnreadCount}
        />
      ) : (
        <SentTransferMessageHistory
          tenantId={tenantId || undefined}
          walletAddress={address}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ========================================
// [C] 共通コンポーネント
// ========================================
function LockCard({ isMobile }: { isMobile: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tenant_name: '',
    description: '',
    rank_plan: 'STUDIO' as import('../types/tenantApplication').RankPlan,
  });

  const { application, loading: checkingApplication } = useMyTenantApplication();
  const { submit, submitting, error } = useSubmitTenantApplication();
  const { pricing, loading: pricingLoading } = useRankPlanPricing();

  const handleSubmit = async () => {
    if (!formData.tenant_name.trim() || formData.tenant_name.length < 3) {
      alert('テナント名は3文字以上で入力してください');
      return;
    }

    const success = await submit(formData);
    if (success) {
      alert('テナント申請を送信しました。承認をお待ちください。');
      setShowForm(false);
      setFormData({
        tenant_name: '',
        description: '',
        rank_plan: 'STUDIO',
      });
    } else if (error) {
      alert(`申請に失敗しました: ${error}`);
    }
  };

  // 既に申請中の場合は申請状況を表示
  if (application) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: isMobile ? 16 : 24,
        padding: isMobile ? 24 : 32,
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 16, textAlign: 'center' }}>⏳</div>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: isMobile ? 18 : 22,
          fontWeight: 700,
          textAlign: 'center',
          color: '#10b981',
        }}>
          申請受付中
        </h3>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: isMobile ? 16 : 20,
          marginBottom: 16,
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>テナント名</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{application.tenant_name}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>プラン</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{application.rank_plan}</div>
          </div>
          {application.description && (
            <div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>説明</div>
              <div style={{ fontSize: 14 }}>{application.description}</div>
            </div>
          )}
        </div>
        <p style={{
          fontSize: isMobile ? 13 : 14,
          opacity: 0.8,
          textAlign: 'center',
          margin: 0,
        }}>
          SuperAdminによる承認をお待ちください
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      border: '1px solid rgba(102, 126, 234, 0.2)',
      borderRadius: isMobile ? 16 : 24,
      padding: isMobile ? 24 : 32,
      pointerEvents: 'none',
    }}>
      {!showForm ? (
        <>
          <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 16, textAlign: 'center' }}>✨</div>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: isMobile ? 18 : 22,
            fontWeight: 700,
            textAlign: 'center',
          }}>
            もっと活用しませんか？
          </h3>
          <p style={{
            fontSize: isMobile ? 13 : 14,
            opacity: 0.8,
            margin: '0 0 20px 0',
            textAlign: 'center',
          }}>
            テナント申請で解放される機能
          </p>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? '10px 12px' : '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 20 }}>🎁</div>
              <div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>自動配布</div>
                <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>送金時に特典を自動付与</div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? '10px 12px' : '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 20 }}>🏪</div>
              <div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>GIFT HUB</div>
                <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>デジタル特典自動配布システム（1基につき3種類のデジタル特典）</div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? '10px 12px' : '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 20 }}>🚩</div>
              <div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>フラグNFT</div>
                <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>到達証明の発行</div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? '10px 12px' : '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 20 }}>🏅</div>
              <div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>SBTランク</div>
                <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>累積チップ数に応じたMINT&BURN式ランクアップSBT付与</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={checkingApplication}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '16px',
              background: checkingApplication ? 'rgba(102, 126, 234, 0.5)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              cursor: checkingApplication ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!checkingApplication) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {checkingApplication ? '確認中...' : 'テナントを申請する（GIFTERRA STUDIO公開後に申請可能となります）'}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h3 style={{
              margin: 0,
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
            }}>
              テナント申請フォーム
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>

          {/* テナント名 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              テナント名 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.tenant_name}
              onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
              placeholder="3〜50文字"
              maxLength={50}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '12px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
              }}
            />
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
              {formData.tenant_name.length}/50文字
            </div>
          </div>

          {/* 説明 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              説明（任意）
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="テナントの説明を入力してください"
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '12px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
              {formData.description.length}/500文字
            </div>
          </div>

          {/* ランクプラン */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              ランクプラン <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['STUDIO', 'STUDIO_PRO', 'STUDIO_PRO_MAX'] as const).map((plan) => {
                const details = {
                  STUDIO: { maxHubs: 1, sbtRanks: 3 },
                  STUDIO_PRO: { maxHubs: 3, sbtRanks: 5 },
                  STUDIO_PRO_MAX: { maxHubs: 10, sbtRanks: 10 },
                }[plan];
                const monthlyFee = getPlanPrice(pricing, plan);
                return (
                  <label
                    key={plan}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: isMobile ? '12px' : '14px 16px',
                      background: formData.rank_plan === plan ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${formData.rank_plan === plan ? 'rgba(102, 126, 234, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="rank_plan"
                      value={plan}
                      checked={formData.rank_plan === plan}
                      onChange={(e) => setFormData({ ...formData, rank_plan: e.target.value as any })}
                      style={{ marginRight: 12 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{plan.replace('_', ' ')}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {details.maxHubs}基のGIFT HUB / {details.sbtRanks}段階ランクアップSBT(ミント&バーン) / ¥{monthlyFee.toLocaleString()}/月
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 送信ボタン */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setShowForm(false)}
              disabled={submitting}
              style={{
                flex: 1,
                padding: isMobile ? '12px' : '14px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !formData.tenant_name.trim()}
              style={{
                flex: 2,
                padding: isMobile ? '12px' : '14px',
                background: submitting || !formData.tenant_name.trim()
                  ? 'rgba(102, 126, 234, 0.3)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || !formData.tenant_name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '送信中...' : '申請する'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              color: '#fca5a5',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ========================================
// [C] Tenantモードコンテンツ
// ========================================
function TenantModeContent({ isMobile }: { isMobile: boolean }) {
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  // TODO: 実データから取得（複数テナントを運営している場合）
  const myTenants = [
    { tenantId: 'TN001', name: '本店カフェX', icon: '🏪', thumbnail: '', kodomi: 2000, rank: 'Silver', description: '本店のカフェです', walletAddress: '0x1234...5678', sbtCount: 5, totalReceived: 50000 },
    { tenantId: 'TN005', name: '2号店カフェX新宿', icon: '🏪', thumbnail: '', kodomi: 1200, rank: 'Bronze', description: '新宿2号店', walletAddress: '0xabcd...ef01', sbtCount: 3, totalReceived: 25000 },
  ];

  return (
    <>
      {/* 受取タンク */}
      <ReceiveTank isMobile={isMobile} />

      {/* テナント一覧 */}
      <div style={{ marginBottom: isMobile ? 40 : 60 }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: isMobile ? 18 : 22,
          fontWeight: 700,
        }}>
          管理中のテナント
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: isMobile ? 12 : 16,
        }}>
          {myTenants.map((tenant, i) => (
            <button
              key={i}
              onClick={() => setSelectedTenant(tenant)}
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: isMobile ? 12 : 16,
                padding: isMobile ? 16 : 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              {tenant.thumbnail ? (
                <img
                  src={tenant.thumbnail}
                  alt={tenant.name}
                  style={{
                    width: '100%',
                    height: isMobile ? 140 : 160,
                    objectFit: 'cover',
                    borderRadius: 8,
                    marginBottom: 16,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: isMobile ? 140 : 160,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 56,
                  marginBottom: 16,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  border: '2px solid rgba(255,255,255,0.2)',
                }}>
                  {tenant.icon}
                </div>
              )}
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: isMobile ? 16 : 18,
                fontWeight: 700,
                color: '#ffffff',
              }}>
                {tenant.name}
              </h3>
              <div style={{
                fontSize: isMobile ? 12 : 13,
                opacity: 0.7,
                marginBottom: 12,
                fontFamily: 'monospace',
                color: '#ffffff',
              }}>
                {tenant.tenantId}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <div>
                  <div style={{
                    fontSize: isMobile ? 11 : 12,
                    opacity: 0.6,
                    marginBottom: 2,
                    color: '#ffffff',
                  }}>
                    総受取
                  </div>
                  <div style={{
                    fontSize: isMobile ? 18 : 20,
                    fontWeight: 900,
                    color: '#ffffff',
                  }}>
                    {tenant.totalReceived?.toLocaleString() || 0}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 10 : 11,
                    opacity: 0.5,
                    color: '#ffffff',
                  }}>
                    JPYC
                  </div>
                </div>
                <div style={{
                  padding: '6px 14px',
                  background: 'rgba(255, 215, 0, 0.2)',
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                  borderRadius: 999,
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  color: '#ffd700',
                }}>
                  {tenant.rank}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* テナント統計カード */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 16 : 20,
        marginBottom: isMobile ? 40 : 48,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? 20 : 28,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#ffffff' }}>
            キャンペーン稼働状況
          </h3>
          <p style={{ fontSize: isMobile ? 13 : 14, opacity: 0.6, color: '#ffffff' }}>
            詳細はAdminで確認
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? 20 : 28,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#ffffff' }}>
            サポーター動向
          </h3>
          <p style={{ fontSize: isMobile ? 13 : 14, opacity: 0.6, color: '#ffffff' }}>
            詳細はAdminで確認
          </p>
        </div>
      </div>

      {/* テナント詳細モーダル */}
      {selectedTenant && (
        <TenantDetailModal
          isMobile={isMobile}
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </>
  );
}

// 受取タンク（Tenantモード専用）
function ReceiveTank({ isMobile }: { isMobile: boolean }) {
  const color = '#764ba2';
  const percentage = 78; // TODO: 実データ
  const totalReceived = 12345; // TODO: 実データ

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginBottom: isMobile ? 40 : 60,
    }}>
      <div style={{
        position: 'relative',
        width: isMobile ? '100%' : 400,
        height: isMobile ? 320 : 420,
      }}>
        {/* タンク本体 */}
        <div style={{
          position: 'relative',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: '50% 50% 40% 40% / 10% 10% 40% 40%',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4), 0 10px 40px rgba(0,0,0,0.5)',
        }}>
          {/* 液体 */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${percentage}%`,
            transition: 'height 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to top, ${color} 0%, ${color}dd 50%, ${color}aa 100%)`,
              overflow: 'hidden',
            }}>
              {/* 2層波 */}
              <div style={{
                position: 'absolute',
                top: -20,
                left: '50%',
                width: '200%',
                height: 40,
                background: `radial-gradient(ellipse at center, ${color} 0%, ${color}ee 50%, transparent 70%)`,
                animation: 'liquidWave 10s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute',
                top: -15,
                left: '50%',
                width: '200%',
                height: 40,
                background: `radial-gradient(ellipse at center, ${color}aa 0%, ${color}66 50%, transparent 70%)`,
                animation: 'liquidWave 12s ease-in-out infinite reverse',
              }} />

              {/* 微細なバブル */}
              <div style={{
                position: 'absolute',
                left: '35%',
                width: 5,
                height: 5,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                animation: 'subtleBubbleRise 14s ease-in-out infinite',
                animationDelay: '0s',
              }} />
              <div style={{
                position: 'absolute',
                left: '65%',
                width: 4,
                height: 4,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '50%',
                animation: 'subtleBubbleRise 16s ease-in-out infinite',
                animationDelay: '7s',
              }} />

              {/* 呼吸発光 */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(ellipse at center, ${color}ff 0%, transparent 70%)`,
                animation: 'breatheGlow 12s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* 中央ラベル */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}>
            <div style={{
              fontSize: isMobile ? 14 : 16,
              opacity: 0.6,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              総受取
            </div>
            <div style={{
              fontSize: isMobile ? 48 : 64,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              textShadow: '0 4px 20px rgba(0,0,0,0.8)',
              marginBottom: 8,
            }}>
              {totalReceived.toLocaleString()}
            </div>
            <div style={{
              fontSize: isMobile ? 14 : 16,
              opacity: 0.8,
            }}>
              JPYC
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// [D] フッター
// ========================================
function Footer({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{
      marginTop: isMobile ? 60 : 80,
      paddingTop: isMobile ? 24 : 32,
      borderTop: '1px solid rgba(255,255,255,0.08)',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: isMobile ? 11 : 12,
        opacity: 0.5,
        marginBottom: 12,
        lineHeight: 1.6,
        textAlign: 'left',
      }}>
        GIFTERRAは資産の保管・両替・投資の勧誘を行いません。
        <br />
        ※ 各サービスの利用・トークンの送受信は自己責任で行ってください。
        <br />
        ※ 本サービス（コンテンツ・作品等）はJPYC株式会社による公式コンテンツではありません。
        <br />
        ※ 「JPYC」はJPYC株式会社の提供するステーブルコインです。
        <br />
        ※ JPYC及びJPYCロゴは、JPYC株式会社の登録商標です。
      </div>
      <div style={{
        fontSize: isMobile ? 10 : 11,
        opacity: 0.3,
        marginBottom: 8,
      }}>
        特許出願中
      </div>
      <div style={{
        fontSize: isMobile ? 10 : 11,
        opacity: 0.4,
        marginBottom: 4,
      }}>
        Powerd by GIFTERRA
      </div>
      <div style={{
        fontSize: isMobile ? 10 : 11,
        opacity: 0.4,
      }}>
        Presented by METATRON.
      </div>
    </div>
  );
}

// ========================================
// ウォレットセットアップモーダル
// ========================================
function WalletSetupModal({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const { createWallet } = useCreateWallet({
    onSuccess: (wallet) => {
      setIsSuccess(true);
      // ウォレット作成成功後、モーダルを閉じる
      setTimeout(() => {
        onClose();
      }, 1500); // 1.5秒後に自動で閉じる
    },
    onError: (error) => {
      console.error('❌ Failed to create wallet:', error);
      alert('ウォレットの作成に失敗しました。もう一度お試しください。\n\nエラー: ' + error.message);
    },
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      await createWallet();
    } catch (error) {
      console.error('❌ Wallet creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={!isCreating && !isSuccess ? onClose : undefined}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? 20 : 40,
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* モーダルコンテンツ */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
            borderRadius: 24,
            padding: isMobile ? '32px 24px' : '40px 36px',
            maxWidth: 480,
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 100px rgba(2, 187, 209, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            position: 'relative',
          }}
        >
          {/* 閉じるボタン */}
          {!isCreating && !isSuccess && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0, 0, 0, 0.05)',
                color: '#4a5568',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
              }}
            >
              ×
            </button>
          )}

          {/* アイコン */}
          <div style={{
            textAlign: 'center',
            marginBottom: 24,
          }}>
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              background: isSuccess
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #02bbd1 0%, #018a9a 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              boxShadow: isSuccess
                ? '0 8px 24px rgba(16, 185, 129, 0.3)'
                : '0 8px 24px rgba(2, 187, 209, 0.3)',
            }}>
              {isSuccess ? '✅' : '👛'}
            </div>

            <h2 style={{
              fontSize: isMobile ? 22 : 24,
              fontWeight: 700,
              color: '#1a202c',
              margin: '0 0 12px 0',
            }}>
              {isSuccess ? 'ウォレット作成完了！' : 'ウォレットを作成しましょう'}
            </h2>

            <p style={{
              fontSize: isMobile ? 14 : 15,
              color: '#4a5568',
              lineHeight: 1.7,
              margin: 0,
            }}>
              {isSuccess
                ? 'これでJPYCやNFT特典の送受信ができます'
                : 'ウォレット（デジタル財布）を作成すると、JPYCの送受信やNFT特典の受け取りができるようになります'
              }
            </p>
          </div>

          {!isSuccess && (
            <>
              {/* 説明セクション */}
              <div style={{
                background: '#f0f9ff',
                border: '2px solid #bae6fd',
                borderRadius: 12,
                padding: isMobile ? 16 : 20,
                marginBottom: 24,
              }}>
                <div style={{
                  fontSize: isMobile ? 13 : 14,
                  color: '#0c4a6e',
                  lineHeight: 1.8,
                }}>
                  <div style={{ marginBottom: 12, fontWeight: 600 }}>
                    💡 ウォレットとは？
                  </div>
                  <div>
                    デジタル上の財布のようなものです。あなただけのアドレス（口座番号のようなもの）が発行され、安全にJPYCやNFTなどを管理できます。
                  </div>
                </div>
              </div>

              {/* 作成ボタン */}
              <button
                onClick={handleCreateWallet}
                disabled={isCreating}
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  background: isCreating
                    ? 'rgba(100, 100, 100, 0.5)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  boxShadow: isCreating
                    ? 'none'
                    : '0 4px 16px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!isCreating) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCreating) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                {isCreating ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    ウォレット作成中...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20 }}>🔨</span>
                    ウォレットを作成する
                  </>
                )}
              </button>

              {/* 後で作成リンク */}
              <div style={{
                textAlign: 'center',
                marginTop: 16,
              }}>
                <button
                  onClick={onClose}
                  disabled={isCreating}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: 13,
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    opacity: isCreating ? 0.5 : 1,
                  }}
                >
                  後で作成する
                </button>
              </div>
            </>
          )}

          {isSuccess && (
            <div style={{
              textAlign: 'center',
              padding: '20px 0',
            }}>
              <div style={{
                fontSize: 14,
                color: '#059669',
                fontWeight: 600,
              }}>
                自動的に閉じます...
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
