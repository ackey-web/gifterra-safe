/**
 * @file スコア計算ロジック（純粋関数）
 */

import type {
  Axis,
  Curve,
  EconomicScore,
  ResonanceScore,
  CompositeScore,
  ScoreParams,
} from './types';

// ========================================
// 定数
// ========================================

const JPYC_DECIMALS = 18;
const LEVEL_MAX = 100;

// レベル計算の係数（調整可能）
const ECONOMIC_LEVEL_MULTIPLIER = 0.0001; // 10,000 JPYC で Lv.100
const RESONANCE_LEVEL_MULTIPLIER = 1.0;   // 100回 で Lv.100

// 貢献熱量度（kodomi）の重み調整
// 案A: 全トークン同重み（回数のみでカウント、金額は含まない）
const UTILITY_TOKEN_WEIGHT = 1.0;  // tNHT等のユーティリティトークン
const JPYC_TIP_COUNT_WEIGHT = 1.0; // JPYCのTIP回数（金額は含まない）

// ========================================
// JPYC正規化
// ========================================

/**
 * トークン額をJPYC換算に正規化
 * @param token トークンアドレス
 * @param amountRaw 生の額（最小単位）
 * @param tokenDecimals トークンのdecimals
 * @returns JPYC最小単位の額
 */
export function normalizeToJPYC(
  token: string,
  amountRaw: bigint,
  tokenDecimals: number = 18
): bigint {
  // 現在はJPYCのみ対応（1:1）
  // 将来：他のステーブルコインの換算レート実装

  if (tokenDecimals === JPYC_DECIMALS) {
    return amountRaw;
  }

  // decimalsが異なる場合の変換
  if (tokenDecimals < JPYC_DECIMALS) {
    const diff = JPYC_DECIMALS - tokenDecimals;
    return amountRaw * (BigInt(10) ** BigInt(diff));
  } else {
    const diff = tokenDecimals - JPYC_DECIMALS;
    return amountRaw / (BigInt(10) ** BigInt(diff));
  }
}

// ========================================
// レベル計算
// ========================================

/**
 * 経済スコアからレベルを計算（0-100）
 * @param normalizedScore 正規化後のスコア（JPYC最小単位）
 * @returns レベル（0-100）
 */
export function calculateEconomicLevel(normalizedScore: number): number {
  // ルート関数で緩やかに上昇
  // 例：1,000 JPYC (1e21 wei) → Lv.31
  //     10,000 JPYC (1e22 wei) → Lv.100
  const jpycAmount = normalizedScore / 10 ** JPYC_DECIMALS;
  const level = Math.sqrt(jpycAmount) * ECONOMIC_LEVEL_MULTIPLIER * 100;

  return Math.min(LEVEL_MAX, Math.floor(level));
}

/**
 * 共鳴スコアからレベルを計算（0-100）
 * @param resonanceScore 共鳴スコア（回数 + ボーナス）
 * @returns レベル（0-100）
 */
export function calculateResonanceLevel(resonanceScore: number): number {
  // リニアに上昇
  // 例：10回 → Lv.10
  //     100回 → Lv.100
  const level = resonanceScore * RESONANCE_LEVEL_MULTIPLIER;

  return Math.min(LEVEL_MAX, Math.floor(level));
}

/**
 * レベルから表示用レベルを計算（1-99）
 * @param level 内部レベル（0-100）
 * @returns 表示用レベル（1-99）
 */
export function getDisplayLevel(level: number): number {
  if (level === 0) return 1;
  if (level >= 100) return 99;
  return Math.max(1, Math.min(99, Math.floor(level)));
}

// ========================================
// 連続日数の計算
// ========================================

/**
 * 日数の差分を計算
 * @param date1 日付1
 * @param date2 日付2
 * @returns 日数の差分
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 連続日数を更新
 * @param lastDate 最終応援日
 * @param currentDate 現在の日付
 * @param currentStreak 現在の連続日数
 * @returns 新しい連続日数
 */
export function updateStreak(
  lastDate: Date | null,
  currentDate: Date,
  currentStreak: number
): number {
  if (!lastDate) {
    return 1; // 初回
  }

  const daysDiff = getDaysDifference(lastDate, currentDate);

  if (daysDiff === 0) {
    // 同日内の複数応援
    return currentStreak;
  } else if (daysDiff === 1) {
    // 連続
    return currentStreak + 1;
  } else {
    // 途切れた
    return 1;
  }
}

// ========================================
// 共鳴スコアの正規化（回数 + 連続ボーナス）
// ========================================

/**
 * 共鳴スコア（kodomi）を正規化
 *
 * 【算出基準 - 案A + AI質的分析】
 * kodomi = (回数スコア + AI質的スコア) × (1 + 連続ボーナス)
 *
 * - 回数スコア: 全トークン同じ重み（1.0）、金額は含まない
 * - AI質的スコア: メッセージの文脈理解・感情分析（0-50）
 * - 連続ボーナス: 7日ごとに10%加算
 *
 * @param utilityTokenCount ユーティリティトークン（tNHT等）のTIP回数
 * @param jpycTipCount JPYC（Economic軸トークン）のTIP回数
 * @param streak 連続日数
 * @param avgSentiment 平均感情スコア（0-100）メッセージがない場合は50
 * @returns 正規化後のスコア（kodomi）
 */
export function normalizeResonanceScore(
  utilityTokenCount: number,
  jpycTipCount: number,
  streak: number,
  aiQualityScore: number = 0
): number {
  // 回数スコア（全トークン同じ重み）
  const countScore = utilityTokenCount + jpycTipCount;

  // 連続ボーナス（7日ごとに10%加算）- 回数スコアのみに適用
  const streakBonus = Math.floor(streak / 7) * 0.1;

  // kodomi = (回数スコア × (1 + 連続ボーナス)) + AI質的スコア
  const kodomi = (countScore * (1 + streakBonus)) + aiQualityScore;

  return Math.round(kodomi);
}

// ========================================
// 曲線適用
// ========================================

/**
 * 曲線を適用
 * @param value 入力値
 * @param curve 曲線タイプ
 * @returns 曲線適用後の値
 */
export function applyCurve(value: number, curve: Curve): number {
  switch (curve) {
    case 'Linear':
      return value;

    case 'Sqrt':
      return Math.sqrt(value);

    case 'Log':
      return Math.log(value + 1) / Math.log(10); // log10(x+1)

    default:
      return value;
  }
}

// ========================================
// 合成スコアの計算
// ========================================

/**
 * 合成スコアを計算
 * @param economic 経済スコア
 * @param resonance 共鳴スコア
 * @param params パラメータ
 * @returns 合成スコア
 */
export function calculateCompositeScore(
  economic: EconomicScore,
  resonance: ResonanceScore,
  params: ScoreParams
): CompositeScore {
  const eNorm = economic.normalized;
  const rNorm = resonance.normalized;

  // 曲線適用
  const rAdjusted = applyCurve(rNorm, params.curve);

  // 重み付け合成（Basis Points: 100 = 1.0）
  const composite =
    (eNorm * params.weightEconomic / 100) +
    (rAdjusted * params.weightResonance / 100);

  // 表示用の式
  const formula = generateFormula(params);

  return {
    value: Math.floor(composite),
    economicWeight: params.weightEconomic,
    resonanceWeight: params.weightResonance,
    curve: params.curve,
    formula,
  };
}

/**
 * 合成スコアの計算式を生成
 * @param params パラメータ
 * @returns 式の文字列
 */
export function generateFormula(params: ScoreParams): string {
  const wE = params.weightEconomic / 100;
  const wR = params.weightResonance / 100;

  let curveSymbol = '';
  switch (params.curve) {
    case 'Sqrt':
      curveSymbol = '√';
      break;
    case 'Log':
      curveSymbol = 'log';
      break;
    default:
      curveSymbol = '';
  }

  if (curveSymbol) {
    return `(💸 × ${wE}) + (${curveSymbol}🔥 × ${wR})`;
  } else {
    return `(💸 × ${wE}) + (🔥 × ${wR})`;
  }
}

// ========================================
// パーセンタイルの計算
// ========================================

/**
 * パーセンタイルを計算
 * @param rank 順位（1-indexed）
 * @param total 総数
 * @returns パーセンタイル（0-100）
 */
export function calculatePercentile(rank: number, total: number): number {
  if (total === 0) return 0;
  return Math.floor((1 - (rank - 1) / total) * 100);
}

// ========================================
// 初期スコアの生成
// ========================================

/**
 * 空の経済スコアを生成
 * @returns 経済スコア
 */
export function createEmptyEconomicScore(): EconomicScore {
  return {
    raw: 0n,
    normalized: 0,
    level: 0,
    displayLevel: 1,
    tokens: {},
  };
}

/**
 * 空の共鳴スコアを生成
 * @returns 共鳴スコア
 */
export function createEmptyResonanceScore(): ResonanceScore {
  return {
    raw: 0,
    normalized: 0,
    level: 0,
    displayLevel: 1,
    count: 0,
    streak: 0,
    longestStreak: 0,
    lastDate: null,
    actions: {
      tips: 0,
      utilityTokenTips: 0,
      economicTokenTips: 0,
      purchases: 0,
      claims: 0,
      logins: 0,
    },
    aiQualityScore: 0,
    avgSentiment: 50,
    messageCount: 0,
  };
}

/**
 * 空の合成スコアを生成
 * @param params パラメータ
 * @returns 合成スコア
 */
export function createEmptyCompositeScore(params: ScoreParams): CompositeScore {
  return {
    value: 0,
    economicWeight: params.weightEconomic,
    resonanceWeight: params.weightResonance,
    curve: params.curve,
    formula: generateFormula(params),
  };
}
