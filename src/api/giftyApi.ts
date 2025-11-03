/**
 * @file Gifty AI API
 * @description OpenAI GPT-4を使用したスコアバランス分析とパーソナライズド提案
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import type { UserScoreData } from '../hooks/useScoreApi';

// ========================================
// OpenAI設定
// ========================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ========================================
// 型定義
// ========================================

export interface BalanceAnalysisRequest {
  userScore: UserScoreData;
  language?: 'ja' | 'en';
}

export interface BalanceAnalysisResponse {
  success: boolean;
  data: {
    economicRatio: number;
    resonanceRatio: number;
    balanceType: 'balanced' | 'economic-heavy' | 'resonance-heavy' | 'beginner';
    analysis: string;
    suggestions: string[];
    encouragement: string;
    nextMilestone: {
      type: 'economic' | 'resonance' | 'composite';
      target: number;
      current: number;
      remaining: number;
      description: string;
    };
  };
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * ユーザースコアをプロンプト用にフォーマット
 */
function formatScoreForPrompt(userScore: UserScoreData): string {
  return `
ユーザースコア情報:
- Economic Score: ${userScore.economic.score} (Level ${userScore.economic.level})
- Resonance Score: ${userScore.resonance.score} (Level ${userScore.resonance.level})
- Composite Score: ${userScore.composite.score}
- Total Tips: ${userScore.resonance.actions.tips}
- Current Streak: ${userScore.resonance.streak} days
- Longest Streak: ${userScore.resonance.longestStreak} days

スコア計算パラメータ:
- Economic Weight: ${userScore.composite.economicWeight}%
- Resonance Weight: ${userScore.composite.resonanceWeight}%
- Curve Type: ${userScore.composite.curve}
  `.trim();
}

/**
 * バランスタイプを判定
 */
function determineBalanceType(
  economicScore: number,
  resonanceScore: number
): 'balanced' | 'economic-heavy' | 'resonance-heavy' | 'beginner' {
  const totalScore = economicScore + resonanceScore;

  if (totalScore < 100) {
    return 'beginner';
  }

  const economicRatio = (economicScore / totalScore) * 100;

  if (economicRatio > 60) {
    return 'economic-heavy';
  } else if (economicRatio < 40) {
    return 'resonance-heavy';
  } else {
    return 'balanced';
  }
}

/**
 * 次のマイルストーンを計算
 */
function calculateNextMilestone(userScore: UserScoreData) {
  const { economic, resonance, composite } = userScore;

  // 次のレベル閾値を計算（簡略化）
  const nextEconomicLevel = (economic.level + 1) * (economic.level + 1) * 10000;
  const nextResonanceLevel = (resonance.level + 1) * 100;

  // 最も近いマイルストーンを選択
  const economicRemaining = nextEconomicLevel - economic.score;
  const resonanceRemaining = nextResonanceLevel - resonance.score;

  if (economicRemaining < resonanceRemaining * 100) {
    return {
      type: 'economic' as const,
      target: nextEconomicLevel,
      current: economic.score,
      remaining: economicRemaining,
      description: `Economic Level ${economic.level + 1}`,
    };
  } else {
    return {
      type: 'resonance' as const,
      target: nextResonanceLevel,
      current: resonance.score,
      remaining: resonanceRemaining,
      description: `Resonance Level ${resonance.level + 1}`,
    };
  }
}

// ========================================
// AI分析関数
// ========================================

/**
 * OpenAI GPT-4を使用してスコアバランスを分析
 */
async function analyzeWithAI(userScore: UserScoreData, language: 'ja' | 'en' = 'ja'): Promise<{
  analysis: string;
  suggestions: string[];
  encouragement: string;
}> {
  const balanceType = determineBalanceType(userScore.economic.score, userScore.resonance.score);

  const systemPrompt = `あなたはGifty、Gifterraプラットフォームの親しみやすいAIアシスタントです。
ユーザーの二軸スコア（💸 Economic: 金銭的貢献、🔥 Resonance: 継続的熱量）を分析し、
ポジティブで励ましのあるフィードバックと具体的な提案を提供してください。

重要な指針:
- 常にポジティブで励ます表現を使用
- ユーザーの承認欲求を満たす
- 具体的で実行可能な提案を3つ提供
- 絵文字を適度に使用して親しみやすく
- 金額ではなく「貢献度」や「応援」という言葉を使用
- 「投げ銭」ではなく「TIP」という言葉を使用（ブランドイメージ）
- 比較ではなく成長を強調`;

  const userPrompt = `${formatScoreForPrompt(userScore)}

バランスタイプ: ${balanceType}

このユーザーのスコアバランスを分析し、以下の形式でJSON出力してください:
{
  "analysis": "スコアバランスの詳細分析（2-3文、ポジティブに）",
  "suggestions": ["提案1", "提案2", "提案3"],
  "encouragement": "励ましのメッセージ（1文）"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Empty response from OpenAI');
    }

    const result = JSON.parse(responseContent);
    return {
      analysis: result.analysis || 'スコアバランスが良好です。',
      suggestions: result.suggestions || [],
      encouragement: result.encouragement || '素晴らしい活動を続けてください！',
    };
  } catch (error) {
    console.error('OpenAI API error:', error);

    // フォールバック: ルールベースの分析
    return generateFallbackAnalysis(userScore, balanceType);
  }
}

/**
 * OpenAI APIが使えない場合のフォールバック分析
 */
function generateFallbackAnalysis(
  userScore: UserScoreData,
  balanceType: string
): {
  analysis: string;
  suggestions: string[];
  encouragement: string;
} {
  const { economic, resonance } = userScore;

  let analysis = '';
  let suggestions: string[] = [];
  let encouragement = '';

  switch (balanceType) {
    case 'beginner':
      analysis = 'Gifterraへようこそ！まだスコアが低いですが、これから素晴らしい応援の旅が始まります✨';
      suggestions = [
        '🎉 はじめてのTIPをしてみましょう',
        '💝 お気に入りのクリエイターを見つけましょう',
        '🔥 毎日ログインしてストリークを伸ばしましょう',
      ];
      encouragement = '一歩ずつ、あなたらしい応援スタイルを見つけてください！';
      break;

    case 'economic-heavy':
      analysis = `素晴らしい金銭的貢献です💸 Economic Level ${economic.level}は立派な成果です。一方で、継続的な応援を増やすとさらにバランスが良くなります。`;
      suggestions = [
        `🔥 連続${resonance.streak + 1}日目を目指してログインしましょう`,
        `⚡ あと${7 - (resonance.streak % 7)}日でストリークボーナス獲得`,
        '💝 少額のTIPでも継続的な応援が熱量を高めます',
      ];
      encouragement = '大きなTIPに加えて、継続的な応援でより深いつながりを築きましょう！';
      break;

    case 'resonance-heavy':
      analysis = `継続的な熱量が素晴らしい🔥 ${resonance.streak}日連続は立派です！たまにはまとまったTIPも検討してみてはいかがでしょうか。`;
      suggestions = [
        '💰 まとめてTIPするとEconomic Levelが上がります',
        '🎯 特別なイベント時に大きなTIPをしてみましょう',
        '⭐ 新しいクリエイターにもTIPしてみましょう',
      ];
      encouragement = '熱い気持ちに、たまには大きなTIPを添えてみませんか？';
      break;

    case 'balanced':
      analysis = `理想的なバランスです✨ Economic Level ${economic.level}、Resonance Level ${resonance.level}ともに素晴らしい成果です。このまま継続すれば上位ランカーも夢ではありません！`;
      suggestions = [
        '🏆 現在のペースを維持して上位ランクを目指しましょう',
        `🌟 次のバッジ「${getNextBadgeName(economic.level)}」まであと少し`,
        '📊 ランキング順位を確認してモチベーションアップ',
      ];
      encouragement = '完璧なバランスです。この調子で応援を続けてください！';
      break;
  }

  return { analysis, suggestions, encouragement };
}

/**
 * 次のバッジ名を取得（簡略版）
 */
function getNextBadgeName(currentLevel: number): string {
  if (currentLevel >= 90) return 'インモータル';
  if (currentLevel >= 80) return 'レジェンド';
  if (currentLevel >= 70) return 'マエストロ';
  if (currentLevel >= 60) return 'フィランソロピスト';
  if (currentLevel >= 50) return 'メセナ';
  if (currentLevel >= 40) return 'ベネファクター';
  if (currentLevel >= 30) return 'パトロン';
  if (currentLevel >= 20) return 'コントリビューター';
  if (currentLevel >= 10) return 'サポーター';
  return 'ビギナー';
}

// ========================================
// APIルーター
// ========================================

export function createGiftyApiRouter(): Router {
  const router = Router();

  /**
   * POST /api/gifty/analyze
   * スコアバランスを分析
   */
  router.post('/analyze', async (req: Request, res: Response) => {
    try {
      const { userScore, language = 'ja' }: BalanceAnalysisRequest = req.body;

      if (!userScore) {
        return res.status(400).json({
          success: false,
          error: 'userScore is required',
        });
      }

      // 基本的なバランス計算
      const totalScore = userScore.economic.score + userScore.resonance.score;
      const economicRatio = totalScore > 0 ? (userScore.economic.score / totalScore) * 100 : 50;
      const resonanceRatio = 100 - economicRatio;
      const balanceType = determineBalanceType(
        userScore.economic.score,
        userScore.resonance.score
      );

      // AI分析（OpenAI APIが設定されている場合）
      let aiResult;
      if (process.env.OPENAI_API_KEY) {
        aiResult = await analyzeWithAI(userScore, language);
      } else {
        aiResult = generateFallbackAnalysis(userScore, balanceType);
      }

      // 次のマイルストーン
      const nextMilestone = calculateNextMilestone(userScore);

      const response: BalanceAnalysisResponse = {
        success: true,
        data: {
          economicRatio,
          resonanceRatio,
          balanceType,
          analysis: aiResult.analysis,
          suggestions: aiResult.suggestions,
          encouragement: aiResult.encouragement,
          nextMilestone,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('❌ Error in Gifty analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/gifty/chat
   * チャット形式の質問応答（将来実装）
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, userScore } = req.body;

      // TODO: チャット機能の実装
      res.json({
        success: true,
        data: {
          reply: 'チャット機能は現在開発中です。お楽しみに！',
        },
      });
    } catch (error) {
      console.error('❌ Error in Gifty chat:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  return router;
}
