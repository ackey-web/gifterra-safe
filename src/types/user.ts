// src/types/user.ts
// ユーザープロフィール関連の型定義

/**
 * ランク名
 */
export type RankName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

/**
 * ランク情報
 */
export interface Rank {
  /** 現在のランク名 */
  name: RankName;
  /** 数値レベル（0-4） */
  level: number;
  /** 貢献度ポイント */
  points: bigint;
  /** 次のランク名（最高ランクの場合はundefined） */
  nextRank?: RankName;
  /** 次のランクまでに必要なポイント */
  pointsToNext?: bigint;
  /** このランクの閾値 */
  threshold: bigint;
}

/**
 * SBT情報
 */
export interface SBT {
  /** トークンID */
  tokenId: bigint;
  /** 画像URI */
  imageUri?: string;
  /** 取得日時 */
  mintedAt?: Date;
  /** メタデータ */
  metadata?: {
    name?: string;
    description?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

/**
 * 統計情報
 */
export interface UserStats {
  /** 総Tip送信額（wei） */
  totalTipsSent: bigint;
  /** 総Tip受取額（wei） */
  totalTipsReceived: bigint;
  /** Tip送信回数 */
  tipSentCount: number;
  /** Tip受取回数 */
  tipReceivedCount: number;
  /** 特典配布回数 */
  purchaseCount: number;
  /** Reward受取回数 */
  rewardClaimedCount: number;
  /** 初回アクティビティ日時 */
  firstActivityAt?: Date;
  /** 最終アクティビティ日時 */
  lastActivityAt?: Date;
  /** アクティブ日数 */
  activeDays: number;
}

/**
 * アクティビティの種類
 */
export type ActivityType = 'tip_sent' | 'tip_received' | 'purchase' | 'reward_claimed' | 'rank_up' | 'sbt_minted';

/**
 * アクティビティ（履歴）
 */
export interface Activity {
  /** ID */
  id: string;
  /** 種類 */
  type: ActivityType;
  /** タイムスタンプ */
  timestamp: Date;
  /** トランザクションハッシュ */
  txHash?: string;
  /** 詳細情報 */
  details: {
    /** 金額（wei）- Tip、購入の場合 */
    amount?: bigint;
    /** トークンシンボル */
    tokenSymbol?: string;
    /** 送信先アドレス - Tip送信の場合 */
    to?: string;
    /** 送信元アドレス - Tip受取の場合 */
    from?: string;
    /** 商品ID - 購入の場合 */
    productId?: string;
    /** 商品名 - 購入の場合 */
    productName?: string;
    /** 新しいランク - ランクアップの場合 */
    newRank?: RankName;
    /** トークンID - SBT mintの場合 */
    tokenId?: bigint;
    /** 説明文 */
    description?: string;
  };
}

/**
 * ユーザープロフィール
 */
export interface UserProfile {
  /** ウォレットアドレス */
  address: string;
  /** ENS名（存在する場合） */
  ensName?: string;
  /** ランク情報 */
  rank: Rank;
  /** SBT情報 */
  sbts: SBT[];
  /** 統計情報 */
  stats: UserStats;
  /** 最近のアクティビティ */
  recentActivities?: Activity[];
}

/**
 * ランク設定（コントラクトから取得）
 */
export interface RankConfig {
  name: RankName;
  level: number;
  threshold: bigint;
  color: string;
  badge: string;
}

/**
 * デフォルトのランク設定
 */
export const DEFAULT_RANK_CONFIGS: RankConfig[] = [
  {
    name: 'Bronze',
    level: 0,
    threshold: BigInt(0),
    color: '#CD7F32',
    badge: '🥉',
  },
  {
    name: 'Silver',
    level: 1,
    threshold: BigInt(1000),
    color: '#C0C0C0',
    badge: '🥈',
  },
  {
    name: 'Gold',
    level: 2,
    threshold: BigInt(5000),
    color: '#FFD700',
    badge: '🥇',
  },
  {
    name: 'Platinum',
    level: 3,
    threshold: BigInt(20000),
    color: '#E5E4E2',
    badge: '💎',
  },
  {
    name: 'Diamond',
    level: 4,
    threshold: BigInt(100000),
    color: '#B9F2FF',
    badge: '👑',
  },
];
