// src/admin/contexts/TenantContext.tsx
// テナントオーナー認証とコントラクトアクセス管理

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAddress, useContract } from '@thirdweb-dev/react';
import { CONTRACT_ADDRESS, TOKEN } from '../../contract';

/* =========================================
   開発環境用デバッグスーパーアドミン設定

   開発・テスト段階では運営側がフルアクセス可能
   VITE_ENABLE_ADMIN_WHITELIST=true で本番でも有効化可能
========================================= */
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const ADMIN_WHITELIST_ENABLED = DEV_MODE || import.meta.env.VITE_ENABLE_ADMIN_WHITELIST === 'true';

// スーパーアドミンアドレス（ホワイトリスト）
const DEV_SUPER_ADMIN_ADDRESSES = [
  '0x66f1274ad5d042b7571c2efa943370dbcd3459ab', // METATRON管理者
  // 開発チームのアドレスを追加可能
];

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
const DEFAULT_TENANT: TenantConfig = {
  id: 'default',
  name: 'METATRON Default',
  contracts: {
    gifterra: CONTRACT_ADDRESS,
    rewardToken: TOKEN.ADDRESS,
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
  tenant: TenantConfig;
  setTenant: (tenant: TenantConfig) => void;

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
  const address = useAddress();

  // テナント設定（将来的にはlocalStorageやAPIから取得）
  const [tenant, setTenant] = useState<TenantConfig>(DEFAULT_TENANT);

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

  // コントラクトインスタンス
  const { contract: gifterraContract } = useContract(tenant.contracts.gifterra);
  const { contract: rewardEngineContract } = useContract(tenant.contracts.rewardEngine);
  const { contract: flagNFTContract } = useContract(tenant.contracts.flagNFT);
  const { contract: rewardTokenContract } = useContract(tenant.contracts.rewardToken);
  const { contract: tipManagerContract } = useContract(tenant.contracts.tipManager);
  const { contract: paymentSplitterContract } = useContract(tenant.contracts.paymentSplitter);

  /* ================= 開発環境スーパーアドミンチェック ================ */
  const isDevSuperAdmin = ADMIN_WHITELIST_ENABLED && address ?
    DEV_SUPER_ADMIN_ADDRESSES.some(
      adminAddr => adminAddr.toLowerCase() === address.toLowerCase()
    ) : false;

  /* ================= オーナー権限チェック ================ */
  const checkOwnership = async () => {
    if (!address) {
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

    setIsCheckingOwner(true);
    setOwnerError(null);

    // スーパーアドミンは全権限を持つ
    if (isDevSuperAdmin) {
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
          newOwnerStatus.gifterra = owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
          console.warn("Gifterra owner check failed:", error);
        }
      }

      // RewardEngine のオーナー確認
      if (rewardEngineContract) {
        try {
          const owner = await rewardEngineContract.call("owner");
          newOwnerStatus.rewardEngine = owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
          console.warn("RewardEngine owner check failed:", error);
        }
      }

      // FlagNFT のオーナー確認
      if (flagNFTContract) {
        try {
          const owner = await flagNFTContract.call("owner");
          newOwnerStatus.flagNFT = owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
          console.warn("FlagNFT owner check failed:", error);
        }
      }

      // RewardToken のオーナー確認
      if (rewardTokenContract) {
        try {
          const owner = await rewardTokenContract.call("owner");
          newOwnerStatus.rewardToken = owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
          console.warn("RewardToken owner check failed:", error);
        }
      }

      // TipManager のオーナー確認
      if (tipManagerContract) {
        try {
          const owner = await tipManagerContract.call("owner");
          newOwnerStatus.tipManager = owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
          console.warn("TipManager owner check failed:", error);
        }
      }

      // PaymentSplitter のオーナー確認
      if (paymentSplitterContract) {
        try {
          const owner = await paymentSplitterContract.call("owner");
          newOwnerStatus.paymentSplitter = owner.toLowerCase() === address.toLowerCase();
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
  }, [address, gifterraContract, rewardEngineContract, flagNFTContract, rewardTokenContract, tipManagerContract, paymentSplitterContract]);

  // 全体のオーナー権限（いずれか1つでもオーナーならtrue）
  const isOwner = Object.values(ownerStatus).some(status => status);

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
  const { isOwner, isCheckingOwner, ownerError, hasContractAccess } = useTenant();

  if (isCheckingOwner) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#fff'
      }}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>🔍 権限を確認中...</p>
        <p style={{ fontSize: 13, opacity: 0.6 }}>コントラクトオーナー権限をチェックしています</p>
      </div>
    );
  }

  if (ownerError) {
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

  // 全体のオーナー権限チェック
  if (!isOwner) {
    return fallback || (
      <div style={{
        padding: 40,
        textAlign: 'center',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 12,
        color: '#fff'
      }}>
        <p style={{ fontSize: 18, marginBottom: 12, fontWeight: 700 }}>🔒 管理者権限が必要です</p>
        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
          この管理画面はコントラクトオーナーのみがアクセスできます
        </p>
        <p style={{ fontSize: 13, opacity: 0.6 }}>
          テナントオーナーのウォレットで接続してください
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
