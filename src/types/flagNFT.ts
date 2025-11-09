// src/types/flagNFT.ts
// フラグNFT関連の型定義
// 法務対応: 「商品」「購入」などの表現を使用せず、「特典」「チップ」で統一

/**
 * フラグNFTのカテゴリ
 */
export type FlagNFTCategory =
  | 'BENEFIT'        // 特典NFT (クーポン的な使い方)
  | 'MEMBERSHIP'     // 会員証NFT
  | 'ACHIEVEMENT'    // 実績バッジNFT
  | 'CAMPAIGN'       // キャンペーンNFT
  | 'ACCESS_PASS'    // アクセス権NFT
  | 'COLLECTIBLE';   // コレクティブルNFT

/**
 * フラグ属性 (柔軟な拡張用key-value形式)
 */
export interface FlagAttribute {
  key: string;
  value: string | number | boolean;
  displayName: string;
}

/**
 * フラグNFT基本情報
 */
export interface FlagNFT {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  image: string; // Supabase URL

  // カテゴリ
  category: FlagNFTCategory;

  // 使用制限
  usageLimit: number; // -1=無制限, 0=表示のみ, N=N回まで
  validFrom: string; // ISO 8601 date string
  validUntil: string | null; // nullで無期限

  // ステータス
  isActive: boolean;
  isTransferable: boolean; // 譲渡可能か
  isBurnable: boolean; // バーン（焼却）可能か

  // 自動配布設定
  autoDistributionEnabled: boolean; // 自動配布を有効化
  requiredTipAmount?: number; // 必要な累積チップ額（JPYC/tNHT換算）
  targetToken?: 'JPYC' | 'tNHT' | 'both'; // 対象トークン

  // フラグ・属性（柔軟な拡張用）
  flags: FlagAttribute[];

  // 発行・使用統計
  totalMinted: number;
  totalUsed: number;
  maxSupply: number | null; // 発行上限（nullで無制限）

  // カテゴリ別詳細設定
  benefitConfig?: BenefitConfig;
  stampRallyConfig?: StampRallyConfig;
  membershipConfig?: MembershipConfig;
  achievementConfig?: AchievementConfig;
  collectibleConfig?: CollectibleConfig;

  // タイムスタンプ
  createdAt: string;
  updatedAt: string;
}

/**
 * 特典NFT設定（旧クーポン）
 */
export interface BenefitConfig {
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'GIFT_ITEM';
  discountValue: number;
  minTipAmount?: number; // 最低チップ額
  applicableGifts?: string[]; // 適用対象特典ID配列
  maxDiscountAmount?: number;
}

/**
 * スタンプラリー設定
 */
export interface StampRallyConfig {
  checkpoints: Checkpoint[];
  completionReward?: string; // 完走特典NFT ID
  requireSequential: boolean; // 順番通りにスタンプを集める必要があるか
  verificationMethod: 'NFC' | 'QR' | 'BOTH';
}

/**
 * チェックポイント
 */
export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  order: number;

  // NFC関連
  nfcTagId?: string; // 物理NFCタグの一意ID（UID）
  nfcEnabled: boolean;

  // QRコード関連（フォールバック用）
  qrCode?: string;
  qrEnabled: boolean;

  // 位置情報（オプション - 不正防止用）
  location?: {
    lat: number;
    lng: number;
    radiusMeters?: number; // チェックイン可能な範囲
  };

  // 統計情報
  checkInCount: number;
  lastCheckInAt?: string;
}

/**
 * 会員証設定
 */
export interface MembershipConfig {
  membershipLevel: string; // ゴールド、シルバーなど
  accessAreas: string[]; // アクセス可能エリア
  benefits: string[]; // 特典内容
  renewalType: 'AUTO' | 'MANUAL' | 'NONE';
}

/**
 * 実績バッジ設定
 */
export interface AchievementConfig {
  triggerType: 'TIP_COUNT' | 'TOTAL_TIPPED' | 'GIFT_COLLECTION' | 'MANUAL';
  threshold: number;
  autoDistribute: boolean; // 条件達成時に自動配布
  additionalBenefits?: string[]; // 達成者への追加特典
}

/**
 * コレクティブルNFT設定
 *
 * 【重要】法務対応: レアリティ機能は実装しない
 * - 投げ銭（チップ）に対する配布特典でレアリティを設定すると、
 *   射幸心の煽り、ガチャ規制、賭博性などの法務リスクが発生
 * - すべてのNFTは等価値として扱い、ランダム性や希少性を排除
 * - シリーズ管理やコレクション進捗による達成感の提供は可能
 */
export interface CollectibleConfig {
  // シリーズ情報
  seriesName: string; // シリーズ名 (例: "夏季限定コレクション")
  seriesNumber?: number; // シリーズ内の番号 (例: 1/10)
  totalInSeries?: number; // シリーズ内の総数 (例: 10)

  // コレクション進捗
  collectionGoal?: number; // コレクション目標数
  progressReward?: string; // 全コレクション達成時の特典NFT ID

  // 配布条件（条件達成による確定配布のみ）
  distributionTrigger: 'TIP_AMOUNT' | 'EVENT_PARTICIPATION' | 'CAMPAIGN' | 'MANUAL';
  requiredCondition?: string; // 配布条件の説明文

  // メタデータ
  artist?: string; // アーティスト名
  releaseDate?: string; // リリース日
  description?: string; // コレクション説明

  // 注意: レアリティ(rarity)、ランダム配布(random)、抽選(lottery)などの機能は
  // 法務リスクのため実装しません
}

/**
 * ユーザーが保有するフラグNFT
 */
export interface UserFlagNFT {
  id: string;
  userId: string; // ウォレットアドレス
  flagNFTId: string;
  tokenId: string; // オンチェーンNFTのトークンID
  usedCount: number;
  lastUsedAt?: string;

  // スタンプラリー進捗
  stampProgress?: StampCheckIn[];
  isCompleted: boolean;

  mintedAt: string;
}

/**
 * スタンプチェックイン記録
 */
export interface StampCheckIn {
  checkpointId: string;
  checkedInAt: string;
  verificationMethod: 'NFC' | 'QR' | 'MANUAL';
  location?: { lat: number; lng: number };
  deviceInfo?: string; // 不正検知用
}

/**
 * NFCタグ管理
 */
export interface NFCTag {
  id: string;
  tagId: string; // 物理NFCタグのUID
  tenantId: string;
  checkpointId?: string; // 割り当てられたチェックポイント
  flagNFTId?: string; // 所属するフラグNFT
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastScannedAt?: string;
  totalScans: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * チェックイン検証結果
 */
export interface CheckInValidation {
  valid: boolean;
  reason?: string;
  cooldownPeriod?: number; // 秒単位
  gpsValidation?: {
    enabled: boolean;
    allowedRadiusMeters: number;
  };
}
