/**
 * @file Supabaseデータベース統合
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  TippedEvent,
  UserScore,
  TenantScore,
  ScoreParams,
  TokenAxis,
  RankingEntry,
  DailySnapshot,
  Axis,
} from './types';
import {
  calculateEconomicLevel,
  calculateResonanceLevel,
  getDisplayLevel,
  calculateCompositeScore,
  calculatePercentile,
  createEmptyEconomicScore,
  createEmptyResonanceScore,
  createEmptyCompositeScore,
  normalizeToJPYC,
  normalizeResonanceScore,
  updateStreak,
} from './scoreCalculator';

// ========================================
// データベースクラス
// ========================================

export class ScoreDatabase {
  private supabase: SupabaseClient;
  private currentParams: ScoreParams;
  private tokenAxes: Map<string, boolean>; // token => isEconomic

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);

    // デフォルトパラメータ
    this.currentParams = {
      weightEconomic: 100,
      weightResonance: 100,
      curve: 'Sqrt',
      lastUpdated: new Date(),
    };

    this.tokenAxes = new Map();
  }

  // ========================================
  // 初期化
  // ========================================

  async initialize(): Promise<void> {
    console.log('🔧 Initializing ScoreDatabase...');

    // パラメータをロード
    await this.loadParams();

    // トークン軸をロード
    await this.loadTokenAxes();

    console.log('✅ ScoreDatabase initialized');
  }

  private async loadParams(): Promise<void> {
    const { data, error } = await this.supabase
      .from('score_params')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.warn('⚠️ No score params found, using defaults');
      return;
    }

    if (data) {
      this.currentParams = {
        weightEconomic: data.weight_economic,
        weightResonance: data.weight_resonance,
        curve: data.curve,
        lastUpdated: new Date(data.last_updated),
      };
    }
  }

  private async loadTokenAxes(): Promise<void> {
    const { data, error } = await this.supabase
      .from('token_axes')
      .select('*');

    if (error) {
      console.error('❌ Error loading token axes:', error);
      return;
    }

    if (data) {
      for (const row of data) {
        this.tokenAxes.set(row.token.toLowerCase(), row.is_economic);
      }
      console.log(`✅ Loaded ${this.tokenAxes.size} token axes`);
    }
  }

  // ========================================
  // パラメータ更新
  // ========================================

  async updateParams(params: ScoreParams): Promise<void> {
    this.currentParams = params;

    const { error } = await this.supabase.from('score_params').insert({
      weight_economic: params.weightEconomic,
      weight_resonance: params.weightResonance,
      curve: params.curve,
      last_updated: params.lastUpdated.toISOString(),
    });

    if (error) {
      console.error('❌ Error updating params:', error);
      throw error;
    }

    // パラメータ変更後、全ユーザーの合成スコアを再計算
    await this.recalculateAllCompositeScores();
  }

  async updateTokenAxis(token: string, isEconomic: boolean): Promise<void> {
    this.tokenAxes.set(token.toLowerCase(), isEconomic);

    const { error } = await this.supabase
      .from('token_axes')
      .upsert({
        token: token.toLowerCase(),
        is_economic: isEconomic,
        last_updated: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Error updating token axis:', error);
      throw error;
    }
  }

  // ========================================
  // スコア記録
  // ========================================

  /**
   * Gifterraコントラクトの TIP イベントを記録（現在使用中）
   * @param event TippedEvent
   * @param tokenAddress トークンアドレス（JPYC等）
   */
  async recordTip(event: TippedEvent, tokenAddress: string): Promise<void> {
    const userLower = event.from.toLowerCase();
    const tokenLower = tokenAddress.toLowerCase();

    // ユーザースコアを取得または作成
    let userScore = await this.getUserScore(userLower);
    if (!userScore) {
      userScore = this.createNewUserScore(userLower);
    }

    // トークンがEconomic軸かどうか判定
    const isEconomicToken = this.tokenAxes.get(tokenLower) ?? true; // デフォルトはEconomic

    // Economic軸: 金額をEconomicスコアに加算
    await this.updateEconomicScore(userScore, tokenLower, event.amount);

    // Resonance軸: 回数を加算（kodomi: 案A - 全トークン同重み）
    await this.updateResonanceScoreForTip(userScore, event.timestamp, isEconomicToken, event.message);

    // 合成スコアを再計算
    userScore.composite = calculateCompositeScore(
      userScore.economic,
      userScore.resonance,
      this.currentParams
    );

    userScore.lastUpdated = event.timestamp;

    // DBに保存
    await this.saveUserScore(userScore);

    // トランザクションログを保存
    await this.saveTipTransaction(
      userLower,
      tokenLower,
      event.amount,
      event.transactionHash,
      event.timestamp,
      event.message
    );
  }

  async recordScore(
    user: string,
    token: string,
    amountRaw: bigint,
    axis: Axis,
    traceId: string,
    timestamp: Date
  ): Promise<void> {
    const userLower = user.toLowerCase();
    const tokenLower = token.toLowerCase();

    // ユーザースコアを取得または作成
    let userScore = await this.getUserScore(userLower);
    if (!userScore) {
      userScore = this.createNewUserScore(userLower);
    }

    // トークンがEconomic軸かResonance軸か判定
    const isEconomicToken = axis === 'ECONOMIC';

    // 軸に応じてスコアを更新
    if (axis === 'ECONOMIC') {
      // Economic軸: 金額をEconomicスコアに加算
      await this.updateEconomicScore(userScore, tokenLower, amountRaw);
      // 加えて、回数をResonanceスコアに低重みで加算（kodomi）
      await this.updateResonanceScore(userScore, timestamp, true); // isEconomicToken=true
    } else {
      // Resonance軸: 回数のみResonanceスコアに加算
      await this.updateResonanceScore(userScore, timestamp, false); // isEconomicToken=false
    }

    // 合成スコアを再計算
    userScore.composite = calculateCompositeScore(
      userScore.economic,
      userScore.resonance,
      this.currentParams
    );

    userScore.lastUpdated = timestamp;

    // DBに保存
    await this.saveUserScore(userScore);

    // トランザクションログを保存
    await this.saveTransaction(userLower, tokenLower, amountRaw, axis, traceId, timestamp);
  }

  private async updateEconomicScore(
    userScore: UserScore,
    token: string,
    amountRaw: bigint
  ): Promise<void> {
    // トークン別の累積
    if (!userScore.economic.tokens[token]) {
      userScore.economic.tokens[token] = 0n;
    }
    userScore.economic.tokens[token] += amountRaw;

    // 正規化（JPYC換算）
    const normalized = normalizeToJPYC(token, amountRaw);
    userScore.economic.raw += normalized;
    userScore.economic.normalized = Number(userScore.economic.raw) / 10 ** 18;

    // レベル計算
    userScore.economic.level = calculateEconomicLevel(userScore.economic.normalized);
    userScore.economic.displayLevel = getDisplayLevel(userScore.economic.level);
  }

  /**
   * TIP用のResonanceスコア更新（新しいkodomi計算）
   */
  private async updateResonanceScoreForTip(
    userScore: UserScore,
    timestamp: Date,
    isEconomicToken: boolean,
    message?: string
  ): Promise<void> {
    // 回数を加算
    userScore.resonance.raw += 1;
    userScore.resonance.count += 1;
    userScore.resonance.actions.tips += 1;

    // トークン種別に応じて回数をカウント（案A: 全トークン同重み）
    if (isEconomicToken) {
      userScore.resonance.actions.economicTokenTips += 1;
    } else {
      userScore.resonance.actions.utilityTokenTips += 1;
    }

    // 連続日数を更新
    userScore.resonance.streak = updateStreak(
      userScore.resonance.lastDate,
      timestamp,
      userScore.resonance.streak
    );

    if (userScore.resonance.streak > userScore.resonance.longestStreak) {
      userScore.resonance.longestStreak = userScore.resonance.streak;
    }

    userScore.resonance.lastDate = timestamp;

    // ai_quality_scoreを取得（フロントエンドが既に計算済み）
    const aiQualityScore = await this.getAIQualityScore(userScore.address);

    // 正規化（新しいkodomi算出: 案A + AI質的スコア）
    userScore.resonance.normalized = normalizeResonanceScore(
      userScore.resonance.actions.utilityTokenTips,  // 全トークン重み1.0
      userScore.resonance.actions.economicTokenTips, // 全トークン重み1.0
      userScore.resonance.streak,
      aiQualityScore // DBから取得したAI質的スコア
    );

    // レベル計算
    userScore.resonance.level = calculateResonanceLevel(userScore.resonance.normalized);
    userScore.resonance.displayLevel = getDisplayLevel(userScore.resonance.level);
  }

  /**
   * ユーザーのAI質的スコアを取得
   */
  private async getAIQualityScore(address: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('user_scores')
        .select('ai_quality_score')
        .eq('address', address.toLowerCase())
        .single();

      if (error || !data) {
        // まだai_quality_scoreが計算されていない場合は0を返す
        return 0;
      }

      return data.ai_quality_score || 0;
    } catch (error) {
      console.error('❌ Error fetching ai_quality_score:', error);
      return 0;
    }
  }

  private async updateResonanceScore(
    userScore: UserScore,
    timestamp: Date,
    isEconomicToken: boolean
  ): Promise<void> {
    // 回数を加算
    userScore.resonance.raw += 1;
    userScore.resonance.count += 1;
    userScore.resonance.actions.tips += 1;

    // トークン種別に応じて回数をカウント
    if (isEconomicToken) {
      userScore.resonance.actions.economicTokenTips += 1;
    } else {
      userScore.resonance.actions.utilityTokenTips += 1;
    }

    // 連続日数を更新
    userScore.resonance.streak = updateStreak(
      userScore.resonance.lastDate,
      timestamp,
      userScore.resonance.streak
    );

    if (userScore.resonance.streak > userScore.resonance.longestStreak) {
      userScore.resonance.longestStreak = userScore.resonance.streak;
    }

    userScore.resonance.lastDate = timestamp;

    // ai_quality_scoreを取得（フロントエンドが既に計算済み）
    const aiQualityScore = await this.getAIQualityScore(userScore.address);

    // 正規化（kodomi算出: トークン種別ごとの重み付き回数 + 連続ボーナス + AI質的スコア）
    userScore.resonance.normalized = normalizeResonanceScore(
      userScore.resonance.actions.utilityTokenTips,  // tNHT等（重み1.0）
      userScore.resonance.actions.economicTokenTips, // JPYC等（重み1.0）
      userScore.resonance.streak,
      aiQualityScore // DBから取得したAI質的スコア
    );

    // レベル計算
    userScore.resonance.level = calculateResonanceLevel(userScore.resonance.normalized);
    userScore.resonance.displayLevel = getDisplayLevel(userScore.resonance.level);
  }

  // ========================================
  // CRUD操作
  // ========================================

  async getUserScore(address: string): Promise<UserScore | null> {
    const { data, error } = await this.supabase
      .from('user_scores')
      .select('*')
      .eq('address', address.toLowerCase())
      .single();

    if (error || !data) {
      return null;
    }

    return this.deserializeUserScore(data);
  }

  async saveUserScore(userScore: UserScore): Promise<void> {
    const serialized = this.serializeUserScore(userScore);

    const { error } = await this.supabase
      .from('user_scores')
      .upsert(serialized, { onConflict: 'address' });

    if (error) {
      console.error('❌ Error saving user score:', error);
      throw error;
    }
  }

  /**
   * TIPトランザクションを保存（メッセージ付き）
   */
  private async saveTipTransaction(
    user: string,
    token: string,
    amountRaw: bigint,
    traceId: string,
    timestamp: Date,
    message?: string
  ): Promise<void> {
    // トークンがEconomic軸かどうか判定
    const isEconomicToken = this.tokenAxes.get(token) ?? true;
    const axis: Axis = isEconomicToken ? 'ECONOMIC' : 'RESONANCE';

    const { error } = await this.supabase.from('score_transactions').insert({
      user_address: user,
      token_address: token,
      amount_raw: amountRaw.toString(),
      axis,
      trace_id: traceId,
      timestamp: timestamp.toISOString(),
      message: message || null,
      sentiment_score: 50, // デフォルト中立（将来AI分析で更新）
      sentiment_label: 'neutral',
    });

    if (error) {
      console.error('❌ Error saving tip transaction:', error);
    }
  }

  private async saveTransaction(
    user: string,
    token: string,
    amountRaw: bigint,
    axis: Axis,
    traceId: string,
    timestamp: Date
  ): Promise<void> {
    const { error } = await this.supabase.from('score_transactions').insert({
      user_address: user,
      token_address: token,
      amount_raw: amountRaw.toString(),
      axis,
      trace_id: traceId,
      timestamp: timestamp.toISOString(),
    });

    if (error) {
      console.error('❌ Error saving transaction:', error);
    }
  }

  // ========================================
  // ランキング生成
  // ========================================

  async generateRankings(axis: Axis | 'COMPOSITE'): Promise<RankingEntry[]> {
    const column =
      axis === 'ECONOMIC'
        ? 'economic_score'
        : axis === 'RESONANCE'
        ? 'resonance_score'
        : 'composite_score';

    const { data, error } = await this.supabase
      .from('user_scores')
      .select('*')
      .order(column, { ascending: false })
      .limit(1000);

    if (error) {
      console.error('❌ Error generating rankings:', error);
      return [];
    }

    if (!data) return [];

    const total = data.length;

    return data.map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      address: row.address,
      displayName: row.display_name,
      avatar: row.avatar,
      economicScore: row.economic_score,
      resonanceScore: row.resonance_score,
      compositeScore: row.composite_score,
      economicLevel: row.economic_level,
      resonanceLevel: row.resonance_level,
      badge: row.badge,
      title: row.title,
    }));
  }

  // ========================================
  // スナップショット
  // ========================================

  async generateDailySnapshot(): Promise<DailySnapshot> {
    const today = new Date().toISOString().split('T')[0];

    const economicRankings = await this.generateRankings('ECONOMIC');
    const resonanceRankings = await this.generateRankings('RESONANCE');
    const compositeRankings = await this.generateRankings('COMPOSITE');

    const { data: transactions } = await this.supabase
      .from('score_transactions')
      .select('*', { count: 'exact' });

    const snapshot: DailySnapshot = {
      date: today,
      totalUsers: economicRankings.length,
      totalTransactions: transactions?.length || 0,
      rankings: {
        economic: economicRankings.slice(0, 100),
        resonance: resonanceRankings.slice(0, 100),
        composite: compositeRankings.slice(0, 100),
      },
      distributions: {
        economicLevels: this.calculateLevelDistribution(economicRankings, 'economic'),
        resonanceLevels: this.calculateLevelDistribution(resonanceRankings, 'resonance'),
      },
      params: this.currentParams,
    };

    // スナップショットを保存
    await this.saveSnapshot(snapshot);

    return snapshot;
  }

  private calculateLevelDistribution(
    rankings: RankingEntry[],
    axis: 'economic' | 'resonance'
  ): { [level: number]: number } {
    const distribution: { [level: number]: number } = {};

    for (const entry of rankings) {
      const level =
        axis === 'economic' ? entry.economicLevel : entry.resonanceLevel;
      const bucket = Math.floor(level / 10) * 10; // 0, 10, 20, ..., 90
      distribution[bucket] = (distribution[bucket] || 0) + 1;
    }

    return distribution;
  }

  private async saveSnapshot(snapshot: DailySnapshot): Promise<void> {
    const { error } = await this.supabase.from('daily_snapshots').insert({
      date: snapshot.date,
      data: snapshot,
    });

    if (error) {
      console.error('❌ Error saving snapshot:', error);
    }
  }

  // ========================================
  // ヘルパー
  // ========================================

  private createNewUserScore(address: string): UserScore {
    return {
      userId: address, // 仮のID（後でSupabase側で生成されたIDに置き換え）
      address: address.toLowerCase(),
      economic: createEmptyEconomicScore(),
      resonance: createEmptyResonanceScore(),
      composite: createEmptyCompositeScore(this.currentParams),
      tenantScores: {},
      lastUpdated: new Date(),
    };
  }

  private async recalculateAllCompositeScores(): Promise<void> {
    console.log('🔄 Recalculating all composite scores...');

    const { data, error } = await this.supabase
      .from('user_scores')
      .select('*');

    if (error || !data) {
      console.error('❌ Error fetching users for recalculation');
      return;
    }

    for (const row of data) {
      const userScore = this.deserializeUserScore(row);
      userScore.composite = calculateCompositeScore(
        userScore.economic,
        userScore.resonance,
        this.currentParams
      );
      await this.saveUserScore(userScore);
    }

    console.log(`✅ Recalculated ${data.length} users`);
  }

  // ========================================
  // シリアライズ / デシリアライズ
  // ========================================

  private serializeUserScore(userScore: UserScore): any {
    return {
      user_id: userScore.userId,
      address: userScore.address,
      economic_raw: userScore.economic.raw.toString(),
      economic_score: userScore.economic.normalized,
      economic_level: userScore.economic.level,
      resonance_raw: userScore.resonance.raw,
      resonance_score: userScore.resonance.normalized,
      resonance_level: userScore.resonance.level,
      resonance_count: userScore.resonance.count,
      resonance_streak: userScore.resonance.streak,
      resonance_longest_streak: userScore.resonance.longestStreak,
      resonance_last_date: userScore.resonance.lastDate?.toISOString(),
      resonance_utility_tips: userScore.resonance.actions.utilityTokenTips,
      resonance_economic_tips: userScore.resonance.actions.economicTokenTips,
      composite_score: userScore.composite.value,
      last_updated: userScore.lastUpdated.toISOString(),
    };
  }

  private deserializeUserScore(row: any): UserScore {
    return {
      userId: row.user_id,
      address: row.address,
      economic: {
        raw: BigInt(row.economic_raw || '0'),
        normalized: row.economic_score || 0,
        level: row.economic_level || 0,
        displayLevel: getDisplayLevel(row.economic_level || 0),
        tokens: {}, // TODO: トークン別の詳細をロード
      },
      resonance: {
        raw: row.resonance_raw || 0,
        normalized: row.resonance_score || 0,
        level: row.resonance_level || 0,
        displayLevel: getDisplayLevel(row.resonance_level || 0),
        count: row.resonance_count || 0,
        streak: row.resonance_streak || 0,
        longestStreak: row.resonance_longest_streak || 0,
        lastDate: row.resonance_last_date ? new Date(row.resonance_last_date) : null,
        actions: {
          tips: row.resonance_count || 0,
          utilityTokenTips: row.resonance_utility_tips || 0,
          economicTokenTips: row.resonance_economic_tips || 0,
          purchases: 0,
          claims: 0,
          logins: 0,
        },
      },
      composite: {
        value: row.composite_score || 0,
        economicWeight: this.currentParams.weightEconomic,
        resonanceWeight: this.currentParams.weightResonance,
        curve: this.currentParams.curve,
        formula: '', // TODO: 式を生成
      },
      tenantScores: {},
      lastUpdated: new Date(row.last_updated),
    };
  }
}
