// api/kodomi/add.ts
/**
 * KODOMI加算API
 * シンプル送金モードでギフテラユーザーに送金した場合のKODOMI加算処理
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase クライアント（サービスロール）
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ 環境変数が設定されていません', {
    hasUrl: !!supabaseUrl,
    hasServiceRole: !!supabaseServiceRole
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

interface KodomiRequest {
  fromAddress: string;   // 送金者アドレス
  toAddress: string;     // 受取人アドレス
  tokenSymbol: string;   // トークンシンボル (JPYC, NHT, POL)
  amount: string;        // 送金額
  message?: string;      // メッセージ（AI質的スコア用）
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const params: KodomiRequest = req.body;

    // バリデーション
    if (!params.fromAddress || !params.toAddress || !params.tokenSymbol || !params.amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const fromLower = params.fromAddress.toLowerCase();
    const toLower = params.toAddress.toLowerCase();

    console.log('💝 KODOMI加算リクエスト:', {
      from: fromLower,
      to: toLower,
      token: params.tokenSymbol,
      amount: params.amount,
      hasMessage: !!params.message
    });

    // 1. 受取人がギフテラユーザー（profilesに登録済み）かチェック
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('wallet_address', toLower)
      .maybeSingle();

    if (!recipientProfile) {
      console.log(`⏭️ 受取人 ${toLower} はギフテラユーザーではないため、KODOMI加算をスキップ`);
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'Recipient is not a Gifterra user'
      });
    }

    console.log('✅ 受取人はギフテラユーザー。KODOMI加算を開始...');

    // 2. スコアパラメーターを取得
    const { data: scoreParams } = await supabase
      .from('score_params')
      .select('nht_weight, streak_weight, ai_quality_weight, message_quality_weight')
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    // デフォルト値（パラメーターが未設定の場合）
    const nhtWeight = scoreParams?.nht_weight ?? 2.0;
    const streakWeight = scoreParams?.streak_weight ?? 10.0;
    const aiQualityWeight = scoreParams?.ai_quality_weight ?? 1.0;
    const messageQualityWeight = scoreParams?.message_quality_weight ?? 1.0;

    console.log('⚙️ 使用するスコアパラメーター:', {
      nhtWeight,
      streakWeight,
      aiQualityWeight,
      messageQualityWeight
    });

    // 3. 送金者のuser_scoresレコードを取得または作成
    let { data: userScore, error: fetchError } = await supabase
      .from('user_scores')
      .select('*')
      .eq('user_address', fromLower)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // レコードが存在しない場合は新規作成
    if (!userScore) {
      const { data: newScore, error: insertError } = await supabase
        .from('user_scores')
        .insert({
          user_address: fromLower,
          economic_score: 0,
          resonance_score: 0,
          resonance_count: 0,
          streak_days: 0,
          longest_streak: 0,
          last_tip_date: null,
          composite_score: 0,
          economic_level: 0,
          resonance_level: 0,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      userScore = newScore;
    }

    // 4. トークンに応じてKODOMI加算
    // 共鳴スコア（KODOMI）: 回数+1
    const newResonanceCount = (userScore.resonance_count || 0) + 1;

    // 連続日数の計算
    const now = new Date();
    const lastTipDate = userScore.last_tip_date ? new Date(userScore.last_tip_date) : null;

    let newStreakDays = userScore.streak_days || 0;
    if (lastTipDate) {
      const daysDiff = Math.floor((now.getTime() - lastTipDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 0) {
        // 同日内の複数送金
        newStreakDays = userScore.streak_days || 0;
      } else if (daysDiff === 1) {
        // 連続
        newStreakDays = (userScore.streak_days || 0) + 1;
      } else {
        // 途切れた
        newStreakDays = 1;
      }
    } else {
      // 初回
      newStreakDays = 1;
    }

    const newLongestStreak = Math.max(userScore.longest_streak || 0, newStreakDays);

    // AI質的スコア（メッセージがある場合のみ分析）
    let aiQualityScore = 0;
    let aiAnalysis = null;

    if (params.message && params.message.trim().length > 0) {
      try {
        // AI分析APIを呼び出し
        const API_BASE_URL = process.env.VITE_API_BASE_URL || '';
        const aiResponse = await fetch(`${API_BASE_URL}/api/ai/analyze-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: params.message })
        });

        if (aiResponse.ok) {
          aiAnalysis = await aiResponse.json();
          aiQualityScore = aiAnalysis.totalScore || 0;
          console.log('🤖 AI質的スコア:', {
            contextScore: aiAnalysis.contextScore,
            sentimentScore: aiAnalysis.sentimentScore,
            totalScore: aiQualityScore,
            sentimentLabel: aiAnalysis.sentimentLabel
          });
        } else {
          console.warn('⚠️ AI分析APIの呼び出しに失敗しました。スコアは0として処理します。');
        }
      } catch (error) {
        console.warn('⚠️ AI分析でエラーが発生しました。スコアは0として処理します。', error);
      }
    }

    // KODOMI スコア計算（動的パラメーターを使用）
    // 注: この計算は簡易版で、フックは全トランザクションから再計算します
    const normalizedKodomi = Math.round(
      newResonanceCount * nhtWeight +
      newStreakDays * streakWeight +
      aiQualityScore * aiQualityWeight
    );

    // レベル計算（1000ポイントでLv.100）
    const resonanceLevel = Math.min(100, Math.floor(normalizedKodomi / 10));

    // 5. user_scoresを更新
    const { error: updateError } = await supabase
      .from('user_scores')
      .update({
        resonance_score: normalizedKodomi,
        resonance_count: newResonanceCount,
        streak_days: newStreakDays,
        longest_streak: newLongestStreak,
        last_tip_date: now.toISOString(),
        resonance_level: resonanceLevel,
        last_updated: now.toISOString(),
      })
      .eq('user_address', fromLower);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ KODOMI加算完了:', {
      user: fromLower,
      resonanceCount: newResonanceCount,
      resonanceScore: normalizedKodomi,
      streakDays: newStreakDays,
      longestStreak: newLongestStreak,
      aiQualityScore: aiQualityScore
    });

    return res.status(200).json({
      success: true,
      kodomi: {
        resonanceCount: newResonanceCount,
        resonanceScore: normalizedKodomi,
        streakDays: newStreakDays,
        longestStreak: newLongestStreak,
        resonanceLevel: resonanceLevel,
        aiQualityScore: aiQualityScore,
        aiAnalysis: aiAnalysis
      }
    });

  } catch (error) {
    console.error('❌ KODOMI加算エラー:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : '不明なエラー'
    });
  }
}
