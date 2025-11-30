// src/admin/contexts/TenantContext.tsx
// テナントオーナー認証とコントラクトアクセス管理

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAddress, useContract, ConnectWallet } from '@thirdweb-dev/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_MIN_ABI } from '../../contract';
import { getDefaultToken } from '../../config/tokenHelpers';
import { useMyTenantApplication } from '../../hooks/useTenantApplications';
import PendingApprovalScreen from '../components/PendingApprovalScreen';
import RejectedApplicationScreen from '../components/RejectedApplicationScreen';
import ApplicationPromptScreen from '../components/ApplicationPromptScreen';

/* =========================================
   開発環境用デバッグスーパーアドミン設定

   開発・テスト段階では運営側がフルアクセス可能
   VITE_ENABLE_ADMIN_WHITELIST=true で本番でも有効化可能
========================================= */
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const ADMIN_WHITELIST_ENABLED = DEV_MODE || import.meta.env.VITE_ENABLE_ADMIN_WHITELIST === 'true';

// スーパーアドミンアドレス（ホワイトリスト）
const METATRON_OWNER = '0xfcea8435dcbba7f3b1da01e8ea3f4af234a20bcb'; // METATRON管理者
const DEV_SUPER_ADMIN_ADDRESSES = [
  METATRON_OWNER,
  // 開発チームのアドレスを追加可能
];

// ローカルストレージから保存された管理者アドレスを取得
function getConfiguredAdminAddresses(): string[] {
  try {
    const savedConfig = localStorage.getItem('gifterra_tenant_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      return (config.adminAddresses || []).map((addr: string) => addr.toLowerCase());
    }
  } catch (error) {
    console.error('Failed to load admin addresses from config:', error);
  }
  return [];
}

/* =========================================
   テナントコントラクト設定

   ファクトリー化後は各テナントが以下を保持：
   - Gifterra (SBT)
   - RandomRewardEngine
   - FlagNFT
   - RewardToken (ERC20)
   - TipManager
========================================= */

export interface TenantContracts {
  gifterra: string;        // Gifterra SBT contract
  rewardEngine?: string;   // RandomRewardEngine contract
  flagNFT?: string;        // FlagNFT contract
  rewardToken: string;     // RewardToken (ERC20)
  tipManager?: string;     // TipManager contract
  paymentSplitter?: string; // PaymentSplitter contract (GIFT HUB収益分配用)
}

export interface TenantConfig {
  id: string;
  name: string;
  contracts: TenantContracts;
  createdAt?: string;
}

// デフォルトテナント（現在の単一コントラクト環境）
// 環境に応じてトークンアドレスが自動的に切り替わる（testnet: tNHT, mainnet: NHT）
const DEFAULT_TENANT: TenantConfig = {
  id: 'default',
  name: 'GIFTERRA official',
  contracts: {
    gifterra: CONTRACT_ADDRESS,
    rewardToken: getDefaultToken().currentAddress,
    // TODO: GifterraFactoryから実際のPaymentSplitterアドレスを取得
    // 現時点では仮アドレス（後で実際のデプロイアドレスに置き換え）
    paymentSplitter: '0x0000000000000000000000000000000000000000', // PLACEHOLDER
  }
};

/* =========================================
   テナントコンテキストの型定義
========================================= */
export interface TenantContextType {
  // テナント情報
  tenant: TenantConfig | null;
  setTenant: (tenant: TenantConfig) => void;

  // 認証アドレス
  finalAddress: string;  // Thirdweb または Privy の統合アドレス

  // アクセス制御
  hasAccess: boolean;  // デフォルトテナントまたは承認済みテナントへのアクセス権
  isMETATRONOwner: boolean;  // METATRON Ownerかどうか
  isApprovedTenant: boolean;  // 承認済みテナントオーナーかどうか

  // オーナー権限
  isOwner: boolean;
  isCheckingOwner: boolean;
  ownerError: string | null;

  // 開発環境用デバッグ情報
  isDevSuperAdmin: boolean;  // 開発環境でのスーパーアドミン
  devMode: boolean;          // 開発モードかどうか

  // 各コントラクトのオーナー状態
  ownerStatus: {
    gifterra: boolean;
    rewardEngine: boolean;
    flagNFT: boolean;
    rewardToken: boolean;
    tipManager: boolean;
    paymentSplitter: boolean;
  };

  // コントラクトアクセス
  contracts: {
    gifterra: any;
    rewardEngine: any;
    flagNFT: any;
    rewardToken: any;
    tipManager: any;
    paymentSplitter: any;
  };

  // ヘルパー関数
  checkOwnership: () => Promise<void>;
  hasContractAccess: (contractType: keyof TenantContracts) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/* =========================================
   TenantProvider: 管理画面全体を包む
========================================= */
export function TenantProvider({ children }: { children: ReactNode }) {
  const address = useAddress(); // Thirdweb wallet address
  const { authenticated: privyAuthenticated } = usePrivy();
  const { wallets } = useWallets();

  // Privy wallet address state
  const [privyAddress, setPrivyAddress] = useState<string>('');

  // Get address from Privy wallet
  useEffect(() => {
    async function getPrivyAddress() {
      console.log('🔑 [getPrivyAddress] Starting...', {
        privyAuthenticated,
        walletsCount: wallets?.length || 0,
        wallets: wallets?.map(w => ({
          address: w.address,
          walletClientType: w.walletClientType,
          connectorType: w.connectorType,
        })),
      });

      if (!privyAuthenticated) {
        console.log('❌ [getPrivyAddress] Not authenticated with Privy');
        setPrivyAddress('');
        return;
      }

      if (!wallets || wallets.length === 0) {
        console.log('❌ [getPrivyAddress] No wallets found');
        setPrivyAddress('');
        return;
      }

      try {
        const wallet = wallets[0];
        console.log('🔍 [getPrivyAddress] Using wallet:', {
          address: wallet.address,
          walletClientType: wallet.walletClientType,
          connectorType: wallet.connectorType,
        });

        // Try to get address directly from wallet object first
        if (wallet.address) {
          console.log('✅ [getPrivyAddress] Got address directly from wallet:', wallet.address);
          setPrivyAddress(wallet.address);
          return;
        }

        // Fallback: try to get from provider
        console.log('🔄 [getPrivyAddress] No direct address, trying provider...');
        const provider = await wallet.getEthereumProvider();
        console.log('📡 [getPrivyAddress] Got provider:', typeof provider);

        const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        const signer = ethersProvider.getSigner();
        const addr = await signer.getAddress();

        console.log('✅ [getPrivyAddress] Got address from signer:', addr);
        setPrivyAddress(addr);
      } catch (error) {
        console.error('❌ [getPrivyAddress] Failed to get Privy address:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        setPrivyAddress('');
      }
    }
    getPrivyAddress();
  }, [privyAuthenticated, wallets]);

  // Combined address: prefer Thirdweb, fallback to Privy
  const finalAddress = address || privyAddress;

  // ✅ テナント申請情報を取得
  const { application, loading: loadingApplication } = useMyTenantApplication();

  // ✅ METATRON Ownerチェック
  const isMETATRONOwner = finalAddress ? finalAddress.toLowerCase() === METATRON_OWNER.toLowerCase() : false;

  // ✅ 承認済みテナントチェック
  const isApprovedTenant = application?.status === 'approved' && !!application?.gifterra_address;

  // ✅ アクセス権判定
  const hasAccess = isMETATRONOwner || isApprovedTenant;

  // ✅ テナント設定（アクセス権に基づいて動的に決定）
  const [tenant, setTenant] = useState<TenantConfig | null>(() => {
    // 初期化時はローディング中なので null
    return null;
  });

  // テナント情報を更新（application が変わったら再計算）
  useEffect(() => {
    if (loadingApplication) {
      // ローディング中は何もしない
      return;
    }

    // 承認済みテナントがある場合は常にそちらを優先
    if (isApprovedTenant && application) {
      // 承認済みテナント → 申請データからテナント作成
      console.log('✅ Setting tenant from approved application:', application);
      setTenant({
        id: application.tenant_id || 'unknown',
        name: application.tenant_name,
        contracts: {
          gifterra: application.gifterra_address!,
          rewardEngine: application.random_reward_engine_address || undefined,
          flagNFT: application.flag_nft_address || undefined,
          rewardToken: application.custom_token_address || getDefaultToken().currentAddress,
          paymentSplitter: application.pay_splitter_address || undefined,
        },
        createdAt: application.created_at,
      });
    } else if (isMETATRONOwner) {
      // METATRON Owner かつ承認済みテナントなし → デフォルトテナント
      console.log('✅ Setting DEFAULT_TENANT for METATRON Owner (no approved tenant)');
      setTenant(DEFAULT_TENANT);
    } else {
      // アクセス権なし → null
      console.log('❌ No access - setting tenant to null');
      setTenant(null);
    }
  }, [isMETATRONOwner, isApprovedTenant, application, loadingApplication]);

  // オーナー権限状態
  const [isCheckingOwner, setIsCheckingOwner] = useState(true);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerStatus, setOwnerStatus] = useState({
    gifterra: false,
    rewardEngine: false,
    flagNFT: false,
    rewardToken: false,
    tipManager: false,
    paymentSplitter: false,
  });

  // コントラクトインスタンス（tenantがnullの場合はundefinedを渡す）
  const { contract: gifterraContract } = useContract(tenant?.contracts.gifterra, CONTRACT_ABI);
  const { contract: rewardEngineContract } = useContract(tenant?.contracts.rewardEngine);
  const { contract: flagNFTContract } = useContract(tenant?.contracts.flagNFT);
  const { contract: rewardTokenContract } = useContract(tenant?.contracts.rewardToken, ERC20_MIN_ABI);
  const { contract: tipManagerContract } = useContract(tenant?.contracts.tipManager);
  const { contract: paymentSplitterContract } = useContract(tenant?.contracts.paymentSplitter);

  /* ================= 開発環境スーパーアドミンチェック ================ */
  // スーパーアドミン（運営）の判定のみ - テナント管理者は含まない
  const isDevSuperAdmin = ADMIN_WHITELIST_ENABLED && finalAddress ?
    DEV_SUPER_ADMIN_ADDRESSES.some(
      adminAddr => adminAddr.toLowerCase() === finalAddress.toLowerCase()
    ) : false;

  // テナント管理者アドレスを取得（設定から）
  const configuredTenantAdmins = useMemo(() => {
    return getConfiguredAdminAddresses();
  }, [finalAddress]); // finalAddressが変わったときに再計算（設定が更新された可能性）

  // デバッグログ - アドレス変更を詳細に追跡
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`🔐 [${timestamp}] Admin Auth Debug:`, {
      thirdwebAddress: address,
      privyAddress,
      finalAddress,
      addressType: typeof finalAddress,
      addressDefined: finalAddress !== undefined,
      addressNull: finalAddress === null,
      ADMIN_WHITELIST_ENABLED,
      DEV_MODE,
      isDevSuperAdmin,
      configuredTenantAdmins,
      addressLower: finalAddress?.toLowerCase(),
    });

    // アドレスがundefinedになった場合は警告
    if (finalAddress === undefined) {
      console.warn('⚠️ Wallet address became UNDEFINED!');
    }
  }, [address, privyAddress, finalAddress, isDevSuperAdmin]);

  /* ================= オーナー権限チェック ================ */
  const checkOwnership = async () => {
    setIsCheckingOwner(true);

    if (!finalAddress) {
      setOwnerStatus({
        gifterra: false,
        rewardEngine: false,
        flagNFT: false,
        rewardToken: false,
        tipManager: false,
        paymentSplitter: false,
      });
      setIsCheckingOwner(false);
      return;
    }

    setOwnerError(null);

    // スーパーアドミンは全権限を持つ
    if (isDevSuperAdmin) {
      console.log('✅ Super Admin detected - granting all permissions');
      setOwnerStatus({
        gifterra: true,
        rewardEngine: true,
        flagNFT: true,
        rewardToken: true,
        tipManager: true,
        paymentSplitter: true,
      });
      setIsCheckingOwner(false);
      return;
    }

    // 設定されたテナント管理者も全権限を持つ
    const isTenantAdmin = configuredTenantAdmins.some(
      adminAddr => adminAddr.toLowerCase() === finalAddress.toLowerCase()
    );
    if (isTenantAdmin) {
      console.log('✅ Configured Tenant Admin detected - granting all permissions');
      setOwnerStatus({
        gifterra: true,
        rewardEngine: true,
        flagNFT: true,
        rewardToken: true,
        tipManager: true,
        paymentSplitter: true,
      });
      setIsCheckingOwner(false);
      return;
    }

    console.log('⚠️ Not a super admin or configured tenant admin - checking contract ownership...');

    const newOwnerStatus = {
      gifterra: false,
      rewardEngine: false,
      flagNFT: false,
      rewardToken: false,
      tipManager: false,
      paymentSplitter: false,
    };

    try {
      // Gifterra (SBT) のオーナー確認
      if (gifterraContract) {
        try {
          const owner = await gifterraContract.call("owner");
          const isOwner = owner.toLowerCase() === finalAddress.toLowerCase();
          newOwnerStatus.gifterra = isOwner;
          console.log('🔍 Gifterra Owner Check:', {
            contractOwner: owner,
            currentAddress: finalAddress,
            isOwner,
          });
        } catch (error) {
          console.warn("Gifterra owner check failed:", error);
        }
      } else {
        console.log('⚠️ Gifterra contract not loaded');
      }

      // RewardEngine のオーナー確認
      if (rewardEngineContract) {
        try {
          const owner = await rewardEngineContract.call("owner");
          newOwnerStatus.rewardEngine = owner.toLowerCase() === finalAddress.toLowerCase();
        } catch (error) {
          console.warn("RewardEngine owner check failed:", error);
        }
      }

      // FlagNFT のオーナー確認
      if (flagNFTContract) {
        try {
          const owner = await flagNFTContract.call("owner");
          newOwnerStatus.flagNFT = owner.toLowerCase() === finalAddress.toLowerCase();
        } catch (error) {
          console.warn("FlagNFT owner check failed:", error);
        }
      }

      // RewardToken のオーナー確認
      if (rewardTokenContract) {
        try {
          const owner = await rewardTokenContract.call("owner");
          newOwnerStatus.rewardToken = owner.toLowerCase() === finalAddress.toLowerCase();
        } catch (error) {
          console.warn("RewardToken owner check failed:", error);
        }
      }

      // TipManager のオーナー確認
      if (tipManagerContract) {
        try {
          const owner = await tipManagerContract.call("owner");
          newOwnerStatus.tipManager = owner.toLowerCase() === finalAddress.toLowerCase();
        } catch (error) {
          console.warn("TipManager owner check failed:", error);
        }
      }

      // PaymentSplitter のオーナー確認
      if (paymentSplitterContract) {
        try {
          const owner = await paymentSplitterContract.call("owner");
          newOwnerStatus.paymentSplitter = owner.toLowerCase() === finalAddress.toLowerCase();
        } catch (error) {
          console.warn("PaymentSplitter owner check failed:", error);
        }
      }

      setOwnerStatus(newOwnerStatus);
    } catch (error) {
      console.error("❌ Owner check error:", error);
      setOwnerError(error instanceof Error ? error.message : "オーナー確認に失敗しました");
    } finally {
      setIsCheckingOwner(false);
    }
  };

  // アドレスまたはコントラクトが変更されたら権限チェック
  useEffect(() => {
    checkOwnership();
  }, [finalAddress, gifterraContract, rewardEngineContract, flagNFTContract, rewardTokenContract, tipManagerContract, paymentSplitterContract]);

  // 全体のオーナー権限（いずれか1つでもオーナーならtrue、またはスーパーアドミンならtrue）
  const isOwner = isDevSuperAdmin || Object.values(ownerStatus).some(status => status);

  // デバッグ: オーナー状態をログ出力（タイムスタンプ付き）
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`👤 [${timestamp}] Owner Status:`, {
      isOwner,
      isCheckingOwner,
      isDevSuperAdmin,
      ownerStatus,
    });

    // isOwnerがfalseになった場合は警告
    if (!isOwner && !isCheckingOwner) {
      console.warn('⚠️ isOwner is FALSE and not checking!');
    }
  }, [isOwner, isCheckingOwner, isDevSuperAdmin, ownerStatus]);

  // 特定コントラクトへのアクセス権があるか
  const hasContractAccess = (contractType: keyof TenantContracts): boolean => {
    switch (contractType) {
      case 'gifterra':
        return ownerStatus.gifterra;
      case 'rewardEngine':
        return ownerStatus.rewardEngine;
      case 'flagNFT':
        return ownerStatus.flagNFT;
      case 'rewardToken':
        return ownerStatus.rewardToken;
      case 'tipManager':
        return ownerStatus.tipManager;
      case 'paymentSplitter':
        return ownerStatus.paymentSplitter;
      default:
        return false;
    }
  };

  const value: TenantContextType = {
    tenant,
    setTenant,
    finalAddress,
    hasAccess,
    isMETATRONOwner,
    isApprovedTenant,
    isOwner,
    isCheckingOwner,
    ownerError,
    isDevSuperAdmin,
    devMode: DEV_MODE,
    ownerStatus,
    contracts: {
      gifterra: gifterraContract,
      rewardEngine: rewardEngineContract,
      flagNFT: flagNFTContract,
      rewardToken: rewardTokenContract,
      tipManager: tipManagerContract,
      paymentSplitter: paymentSplitterContract,
    },
    checkOwnership,
    hasContractAccess,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

/* =========================================
   useTenant: コンテキストフック
========================================= */
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

/* =========================================
   オーナー権限が必要なコンポーネントを包むHOC
========================================= */
interface RequireOwnerProps {
  children: ReactNode;
  contractType?: keyof TenantContracts;
  fallback?: ReactNode;
}

export function RequireOwner({ children, contractType, fallback }: RequireOwnerProps) {
  const { isOwner, isCheckingOwner, ownerError, hasContractAccess, isDevSuperAdmin, finalAddress, hasAccess } = useTenant();
  const { login: privyLogin, authenticated: privyAuthenticated } = usePrivy();
  const address = useAddress(); // Thirdweb address
  const { application, loading: loadingApplication } = useMyTenantApplication();

  // デバッグ：RequireOwnerの状態をログ出力
  console.log('🔒 RequireOwner rendering:', {
    thirdwebAddress: address,
    privyAuthenticated,
    finalAddress,
    addressUndefined: finalAddress === undefined,
    addressNull: finalAddress === null,
    hasAccess,
    isOwner,
    isCheckingOwner,
    isDevSuperAdmin,
    applicationStatus: application?.status,
    loadingApplication,
    contractType,
  });

  // ウォレット未接続の場合は、接続を促す専用画面を表示
  if (!finalAddress) {
    console.log('🔌 RequireOwner: Wallet not connected - showing connection screen');
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 40,
        textAlign: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}>
        <div style={{
          maxWidth: 500,
          padding: 40,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 12,
          color: '#fff'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <p style={{ fontSize: 24, marginBottom: 16, fontWeight: 700 }}>管理者ダッシュボード</p>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 24, lineHeight: 1.6 }}>
            管理機能にアクセスするには、管理者権限を持つウォレットを接続してください
          </p>

          {/* ウォレット接続ボタン */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 24
          }}>
            <ConnectWallet
              theme="dark"
              btnTitle="ウォレットを接続 (MetaMask等)"
              modalTitle="管理者ダッシュボード接続"
              modalTitleIconUrl=""
              style={{
                fontSize: 15,
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                width: '100%',
              }}
            />

            <div style={{
              textAlign: 'center',
              fontSize: 12,
              opacity: 0.5,
              padding: '8px 0',
            }}>
              または
            </div>

            <button
              onClick={() => privyLogin()}
              style={{
                fontSize: 15,
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                width: '100%',
                background: '#667eea',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#5568d3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#667eea';
              }}
            >
              メール/SNSでログイン
            </button>
          </div>

          <div style={{
            padding: 16,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            marginBottom: 24
          }}>
            <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
              MetaMaskなどの外部ウォレット、またはメール/SNSでログインできます
            </p>
          </div>
          <p style={{ fontSize: 11, opacity: 0.5 }}>
            接続後、自動的にオーナー権限を確認します
          </p>
        </div>
      </div>
    );
  }

  // ローディング中（申請情報またはオーナー権限の確認中）
  if (isCheckingOwner || loadingApplication) {
    console.log('⏳ RequireOwner: Showing checking owner screen');
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 40,
        textAlign: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff'
      }}>
        <div>
          <div style={{
            width: 48,
            height: 48,
            margin: '0 auto 16px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 16, marginBottom: 8, fontWeight: 600 }}>🔍 権限を確認中...</p>
          <p style={{ fontSize: 13, opacity: 0.6 }}>
            {loadingApplication ? 'テナント申請状況を確認しています' : 'コントラクトオーナー権限をチェックしています'}
          </p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (ownerError) {
    console.log('❌ RequireOwner: Showing error screen:', ownerError);
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#fff'
      }}>
        <p style={{ fontSize: 16, marginBottom: 8, color: '#EF4444' }}>❌ エラー</p>
        <p style={{ fontSize: 13, opacity: 0.7 }}>{ownerError}</p>
      </div>
    );
  }

  // 特定コントラクトへのアクセス権チェック
  if (contractType) {
    const hasAccess = hasContractAccess(contractType);
    if (!hasAccess) {
      return fallback || (
        <div style={{
          padding: 40,
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 12,
          color: '#fff'
        }}>
          <p style={{ fontSize: 18, marginBottom: 12, fontWeight: 700 }}>🔒 アクセス権限がありません</p>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
            この機能は{contractType}コントラクトのオーナーのみが利用できます
          </p>
          <p style={{ fontSize: 13, opacity: 0.6 }}>
            オーナーウォレットで接続してください
          </p>
        </div>
      );
    }
  }

  // ✅ アクセス権チェック（デフォルトテナントまたは承認済みテナント）
  if (!hasAccess) {
    console.log('🚫 RequireOwner: No access - checking application status');

    // 申請状態に応じて画面を出し分け
    if (application?.status === 'pending') {
      console.log('⏳ Application pending - showing pending screen');
      return <PendingApprovalScreen application={application} />;
    }

    if (application?.status === 'rejected') {
      console.log('❌ Application rejected - showing rejection screen');
      return <RejectedApplicationScreen application={application} />;
    }

    // 未申請またはその他の状態
    console.log('📝 No application - showing application prompt');
    return <ApplicationPromptScreen />;
  }

  // ✅ アクセス権はあるが、オーナー権限チェックで失敗した場合
  if (!isOwner) {
    console.log('🚫 RequireOwner: Has access but not owner - showing permission error');
    return fallback || (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 40,
        textAlign: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}>
        <div style={{
          maxWidth: 500,
          padding: 40,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 12,
          color: '#fff'
        }}>
          <p style={{ fontSize: 18, marginBottom: 12, fontWeight: 700 }}>🔒 管理者権限がありません</p>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
            接続しているウォレット ({finalAddress?.slice(0, 6)}...{finalAddress?.slice(-4)}) には管理者権限がありません
          </p>
          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 24 }}>
            管理者権限を持つウォレットに切り替えてください
          </p>

          {/* ウォレット切り替えボタン */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <ConnectWallet
              theme="dark"
              btnTitle="ウォレットを切り替え"
              modalTitle="管理者ダッシュボード接続"
              modalTitleIconUrl=""
              style={{
                fontSize: 15,
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            />
          </div>

          <div style={{
            padding: 16,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
          }}>
            <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
              管理者権限を持つウォレットで接続し直してください
            </p>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ RequireOwner: User is owner - rendering children');
  return <>{children}</>;
}
