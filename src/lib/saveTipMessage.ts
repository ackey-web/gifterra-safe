/**
 * @file TIPメッセージとAI分析結果をSupabaseに保存
 */

import { supabase } from './supabase';
import type { SentimentAnalysis } from './ai_analysis';

/**
 * TIPトランザクションにメッセージとAI分析結果を紐付けて保存
 *
 * @param txHash トランザクションハッシュ
 * @param userAddress ユーザーアドレス
 * @param message メッセージ内容
 * @param sentiment AI分析結果（オプション）
 */
export async function saveTipMessageToSupabase(
  txHash: string,
  userAddress: string,
  message: string,
  sentiment?: SentimentAnalysis
): Promise<void> {
  try {
    const tx = txHash.toLowerCase();
    const addr = userAddress.toLowerCase();
    const msg = message.trim();

    if (!tx || !addr || !msg) {
      return;
    }

    // sentiment_scoreとsentiment_labelを準備
    const sentimentScore = sentiment ? sentiment.score : 50; // デフォルト中立
    const sentimentLabel = sentiment ? sentiment.label : 'neutral';

    // score_transactionsテーブルを更新
    // trace_idでマッチするレコードを検索してメッセージとsentimentを更新
    const { data, error } = await supabase
      .from('score_transactions')
      .update({
        message: msg,
        sentiment_score: sentimentScore,
        sentiment_label: sentimentLabel,
      })
      .eq('trace_id', tx);

    if (error) {
      console.error('[saveTipMessage] Supabase error:', error);
      throw error;
    }

    // ユーザーのai_quality_scoreを再計算して更新
    await updateUserAIQualityScore(addr);

  } catch (error) {
    console.error('[saveTipMessage] Failed to save tip message:', error);
    throw error;
  }
}

/**
 * ユーザーの全メッセージから平均sentiment_scoreを計算し、
 * ai_quality_scoreとしてuser_scoresテーブルに保存
 *
 * @param userAddress ユーザーアドレス
 */
async function updateUserAIQualityScore(userAddress: string): Promise<void> {
  try {
    const addr = userAddress.toLowerCase();

    // ユーザーの全トランザクションのsentiment_scoreを取得
    const { data: transactions, error } = await supabase
      .from('score_transactions')
      .select('sentiment_score')
      .eq('user_address', addr)
      .not('message', 'is', null); // メッセージがあるもののみ

    if (error) {
      console.error('[updateUserAIQualityScore] Query error:', error);
      return;
    }

    if (!transactions || transactions.length === 0) {
      return;
    }

    // 平均sentiment_scoreを計算
    const avgSentiment = transactions.reduce((sum, tx) => sum + (tx.sentiment_score || 50), 0) / transactions.length;

    // AI質的スコアを計算（0-100の感情スコアを0-50に正規化）
    const aiQualityScore = (avgSentiment / 100) * 50;

    // user_scoresテーブルを更新
    const { error: updateError } = await supabase
      .from('user_scores')
      .update({
        ai_quality_score: aiQualityScore,
      })
      .eq('address', addr);

    if (updateError) {
      console.error('[updateUserAIQualityScore] Update error:', updateError);
      return;
    }

  } catch (error) {
    console.error('[updateUserAIQualityScore] Failed:', error);
  }
}
