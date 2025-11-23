// src/admin/utils/flagNFTContractIntegration.ts
// FlagNFTのコントラクトとSupabaseの統合ヘルパー

import type { FlagNFTCategory } from '../../types/flagNFT';

/**
 * カテゴリ設定データをコントラクト用に変換
 */
export interface CategoryContractConfig {
  category: FlagNFTCategory;
  usageLimit: number; // 0-255
  validFrom: number; // UNIX timestamp
  validUntil: number; // UNIX timestamp (0 = 無期限)
  isTransferable: boolean;
  metadataURI: string; // IPFSまたはSupabase URL
}

/**
 * フォームデータからコントラクト設定に変換
 */
export function convertToCategoryConfig(
  category: FlagNFTCategory,
  config: any,
  metadataURI: string
): CategoryContractConfig {
  const now = Math.floor(Date.now() / 1000); // 現在時刻（UNIX timestamp）

  // 有効期限の計算
  let validUntil = 0; // デフォルトは無期限
  if (config.validPeriodDays && config.validPeriodDays > 0) {
    validUntil = now + (config.validPeriodDays * 24 * 60 * 60);
  }

  // キャンペーンの場合は開始・終了日時を使用
  if (config.campaignStartDate && config.campaignEndDate) {
    const startDate = new Date(config.campaignStartDate);
    const endDate = new Date(config.campaignEndDate);
    validUntil = Math.floor(endDate.getTime() / 1000);
  }

  return {
    category,
    usageLimit: config.usageLimit || 0,
    validFrom: now,
    validUntil,
    isTransferable: config.isTransferable || false,
    metadataURI,
  };
}

/**
 * カテゴリごとの推奨設定を取得
 */
export function getRecommendedConfig(category: FlagNFTCategory) {
  const configs = {
    BENEFIT: {
      usageLimit: 1,
      validPeriodDays: 30,
      isTransferable: false,
      description: '特典クーポンは1回のみ使用、30日間有効、譲渡不可を推奨',
    },
    MEMBERSHIP: {
      usageLimit: 255, // 無制限
      validPeriodDays: 365,
      isTransferable: false,
      description: '会員証は無制限使用、1年間有効、譲渡可否は選択可能',
    },
    ACHIEVEMENT: {
      usageLimit: 0, // 表示のみ
      validPeriodDays: 0, // 無期限
      isTransferable: true,
      description: '実績バッジは表示専用、無期限、譲渡可能を推奨',
    },
    CAMPAIGN: {
      usageLimit: 3,
      validPeriodDays: 30,
      isTransferable: false,
      description: 'キャンペーンNFTは期間限定、複数回使用可能',
    },
    ACCESS_PASS: {
      usageLimit: 1,
      validPeriodDays: 1,
      isTransferable: false,
      description: 'アクセス権は1回入場、短期有効、譲渡不可を推奨',
    },
    COLLECTIBLE: {
      usageLimit: 0, // 表示のみ
      validPeriodDays: 0, // 無期限
      isTransferable: true,
      description: 'コレクティブルは表示専用、無期限、譲渡可能',
    },
  };

  return configs[category];
}

/**
 * メタデータURIを生成（Supabaseまたはローカル）
 * 実際のメタデータはSupabaseに保存し、そのURLを返す
 */
export function generateMetadataURI(
  tenantId: string,
  flagNFTId: string,
  category: FlagNFTCategory
): string {
  // Supabase APIエンドポイント経由でメタデータを提供
  // 例: https://your-project.supabase.co/rest/v1/flag_nfts?id=eq.{flagNFTId}
  // または専用のメタデータAPIエンドポイント
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  return `${baseUrl}/api/metadata/flag-nft/${tenantId}/${flagNFTId}`;
}

/**
 * コントラクトエラーメッセージを日本語に変換
 */
export function translateContractError(error: any): string {
  const message = error?.message || error?.toString() || '';

  if (message.includes('Category not configured')) {
    return 'カテゴリが設定されていません。先にカテゴリ設定を行ってください。';
  }

  if (message.includes('validFrom must be set')) {
    return '有効開始日時は必須です。';
  }

  if (message.includes('validUntil must be after validFrom')) {
    return '有効終了日時は開始日時より後に設定してください。';
  }

  if (message.includes('Cannot set below current supply')) {
    return '現在の発行数より少ない発行上限は設定できません。';
  }

  if (message.includes('Category max supply reached')) {
    return 'このカテゴリの発行上限に達しています。';
  }

  if (message.includes('Max supply reached')) {
    return 'NFTの発行上限に達しています。';
  }

  if (message.includes('user rejected')) {
    return 'トランザクションがキャンセルされました。';
  }

  if (message.includes('insufficient funds')) {
    return 'ガス代が不足しています。';
  }

  return `コントラクトエラー: ${message.slice(0, 100)}`;
}

/**
 * トランザクション成功メッセージを生成
 */
export function getSuccessMessage(
  operation: 'configure' | 'mint' | 'use',
  category?: FlagNFTCategory
): string {
  switch (operation) {
    case 'configure':
      return `${category}カテゴリの設定が完了しました！NFTの発行が可能になります。`;
    case 'mint':
      return 'NFTの発行が完了しました！ユーザーに配布されます。';
    case 'use':
      return 'NFTの使用が記録されました。';
    default:
      return '操作が完了しました。';
  }
}

/**
 * ガス代推定値を取得
 */
export function estimateGasCost(
  operation: 'configure' | 'mint' | 'mintBatch' | 'use'
): string {
  const estimates = {
    configure: '約0.001-0.005 MATIC（~1-5円）',
    mint: '約0.002-0.01 MATIC（~2-10円）',
    mintBatch: '約0.005-0.03 MATIC（~5-30円）',
    use: '約0.001-0.003 MATIC（~1-3円）',
  };

  return estimates[operation];
}
