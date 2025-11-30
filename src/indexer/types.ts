/**
 * @file 二軸スコアインデクサの型定義
 */

// ========================================
// 軸の定義
// ========================================

export type Axis = 'ECONOMIC' | 'RESONANCE';

export type Curve = 'Linear' | 'Sqrt' | 'Log';

// ========================================
// イベント型
// ========================================

export interface TippedEvent {
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  timestamp: Date;

  from: string;
  to: string; // 受取人アドレス（コントラクトのowner = テナント/ギフテラユーザー）
  amount: bigint;
  message?: string; // 将来のメッセージ機能用（現在はundefined）
}

export interface ScoreIncrementedEvent {
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  timestamp: Date;

  user: string;
  token: string;
  amountRaw: bigint;
  axis: Axis;
  traceId: string;
}

export interface ScoreParamsUpdatedEvent {
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;

  weightEconomic: number;
  weightResonance: number;
  curve: Curve;
}

export interface TokenAxisUpdatedEvent {
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;

  token: string;
  isEconomic: boolean;
}

// ========================================
// スコア型
// ========================================

export interface AxisScore {
  raw: bigint | number;      // 生の累積値（正規化前）
  normalized: number;         // 正規化後の値（0-∞）
  level: number;             // UI用レベル（0-100）
  displayLevel: number;      // 表示用レベル（1-99）
}

export interface EconomicScore extends AxisScore {
  raw: bigint;               // JPYC最小単位
  tokens: {
    [tokenAddress: string]: bigint;
  };
}

export interface ResonanceScore extends AxisScore {
  raw: number;               // 回数の累積
  count: number;             // 応援回数（合計）
  streak: number;            // 連続日数
  longestStreak: number;     // 最長連続
  lastDate: Date | null;     // 最終応援日
  actions: {
    tips: number;            // TIP回数（合計）
    utilityTokenTips: number; // ユーティリティトークン（tNHT等）のTIP回数（重み1.0）
    economicTokenTips: number; // Economic軸トークン（JPYC等）のTIP回数（重み1.0）
    purchases: number;       // 特典受取回数（廃止予定）
    claims: number;          // 特典受取回数
    logins: number;          // ログイン日数（将来）
  };
  // AI分析関連
  aiQualityScore: number;    // AI質的スコア（メッセージ分析の累積）
  avgSentiment: number;      // 平均感情スコア（0-100）
  messageCount: number;      // メッセージ付きTIP回数
}

export interface CompositeScore {
  value: number;             // 合成スコア（派生値）
  economicWeight: number;    // 経済軸の重み
  resonanceWeight: number;   // 共鳴軸の重み
  curve: Curve;              // 共鳴軸の曲線
  formula: string;           // 表示用の式
}

// ========================================
// ユーザースコア
// ========================================

export interface UserScore {
  userId: string;
  address: string;

  economic: EconomicScore;
  resonance: ResonanceScore;
  composite: CompositeScore;

  // テナント別スコア
  tenantScores: {
    [tenantId: string]: TenantScore;
  };

  lastUpdated: Date;
}

export interface TenantScore {
  tenantId: string;

  economic: Omit<EconomicScore, 'tokens'>;
  resonance: ResonanceScore;
  composite: CompositeScore;
}

// ========================================
// ランキング
// ========================================

export interface RankingEntry {
  rank: number;
  userId: string;
  address: string;
  displayName?: string;
  avatar?: string;

  economicScore: number;
  resonanceScore: number;
  compositeScore: number;

  economicLevel: number;
  resonanceLevel: number;

  badge?: string;
  title?: string;
}

export interface RankingSnapshot {
  timestamp: Date;
  axis: Axis | 'COMPOSITE';

  rankings: RankingEntry[];

  stats: {
    totalUsers: number;
    medianScore: number;
    averageScore: number;
    topScore: number;
  };
}

// ========================================
// パラメータ
// ========================================

export interface ScoreParams {
  weightEconomic: number;    // Basis Points (100 = 1.0)
  weightResonance: number;
  curve: Curve;

  lastUpdated: Date;
}

export interface TokenAxis {
  token: string;
  isEconomic: boolean;
  lastUpdated: Date;
}

// ========================================
// インデクサ状態
// ========================================

export interface IndexerState {
  lastProcessedBlock: number;
  lastProcessedTimestamp: Date;

  totalUsers: number;
  totalTransactions: number;

  currentParams: ScoreParams;
  tokenAxes: TokenAxis[];
}

// ========================================
// スナップショット
// ========================================

export interface DailySnapshot {
  date: string; // YYYY-MM-DD

  totalUsers: number;
  totalTransactions: number;

  rankings: {
    economic: RankingEntry[];
    resonance: RankingEntry[];
    composite: RankingEntry[];
  };

  distributions: {
    economicLevels: { [level: number]: number };
    resonanceLevels: { [level: number]: number };
  };

  params: ScoreParams;
}
