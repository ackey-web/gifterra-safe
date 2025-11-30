// api/ai/analyze-message.ts
/**
 * メッセージAI質的分析API
 * 送金メッセージの文脈理解と感情分析を行い、スコアを返す
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AnalyzeRequest {
  message: string;
}

interface AnalysisResult {
  contextScore: number;      // 文脈理解スコア (0-50)
  sentimentScore: number;    // 感情分析スコア (0-50)
  totalScore: number;        // 合計スコア (0-100)
  sentimentLabel: string;    // 感情ラベル
  contextDetails: string;    // 文脈の詳細
}

/**
 * 感情分析（ポジティブ度）
 * @param message メッセージ
 * @returns 0-50のスコア
 */
function analyzeSentiment(message: string): { score: number; label: string } {
  // ポジティブキーワード
  const positiveKeywords = [
    'ありがとう', 'ありがとうございます', '感謝', '嬉しい', 'うれしい',
    '素晴らしい', '最高', '応援', '頑張', 'がんば', 'ガンバ',
    '楽しみ', '期待', '素敵', 'すてき', '良い', 'いい',
    '好き', '愛', 'love', 'thanks', 'thank you', 'great',
    'awesome', 'wonderful', 'amazing', 'excellent', 'good',
    '応援してます', '応援します', '楽しかった', '面白', 'おもしろ',
    '役立', '助かる', 'ナイス', 'グッド', '最高です'
  ];

  // ネガティブキーワード（減点用）
  const negativeKeywords = [
    '悲しい', '残念', '辛い', 'つらい', '嫌', 'いや',
    '悪い', 'わるい', '困', 'こまる'
  ];

  // メッセージを小文字に変換
  const lowerMessage = message.toLowerCase();

  // ポジティブキーワードのカウント
  let positiveCount = 0;
  for (const keyword of positiveKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      positiveCount++;
    }
  }

  // ネガティブキーワードのカウント
  let negativeCount = 0;
  for (const keyword of negativeKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      negativeCount++;
    }
  }

  // 絵文字の検出
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
  const emojiMatches = message.match(emojiRegex);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;

  // スコア計算
  // ベーススコア: 25点
  // ポジティブキーワード: 1つにつき+8点（最大3つまで）
  // 絵文字: 1つにつき+3点（最大3つまで）
  // ネガティブキーワード: 1つにつき-10点
  let score = 25;
  score += Math.min(positiveCount * 8, 24); // 最大+24点
  score += Math.min(emojiCount * 3, 9);      // 最大+9点
  score -= negativeCount * 10;                // ネガティブで減点

  // 0-50の範囲に制限
  score = Math.max(0, Math.min(50, score));

  // ラベル付け
  let label = 'ニュートラル';
  if (score >= 40) label = '非常にポジティブ';
  else if (score >= 30) label = 'ポジティブ';
  else if (score >= 20) label = 'ややポジティブ';
  else if (score < 15) label = 'ネガティブ';

  return { score, label };
}

/**
 * 文脈理解（メッセージの質と具体性）
 * @param message メッセージ
 * @returns 0-50のスコア
 */
function analyzeContext(message: string): { score: number; details: string } {
  // メッセージ長による評価
  const length = message.length;
  let lengthScore = 0;
  let lengthDetails = '';

  if (length === 0) {
    lengthScore = 0;
    lengthDetails = 'メッセージなし';
  } else if (length < 5) {
    lengthScore = 5;
    lengthDetails = '極めて短い';
  } else if (length < 15) {
    lengthScore = 15;
    lengthDetails = '短い';
  } else if (length < 30) {
    lengthScore = 25;
    lengthDetails = '適度な長さ';
  } else if (length < 60) {
    lengthScore = 30;
    lengthDetails = '十分な長さ';
  } else {
    lengthScore = 35;
    lengthDetails = '詳細な内容';
  }

  // 具体的な内容を含むかチェック
  const specificKeywords = [
    '応援', '頑張', 'がんば', 'ガンバ', 'プロジェクト', 'サービス',
    '活動', 'イベント', '作品', 'コンテンツ', '記事', '動画',
    '配信', 'ライブ', 'コミュニティ', '開発', '制作',
    'いつも', '毎回', '継続', '続', '楽しみ', '期待'
  ];

  let specificityCount = 0;
  const lowerMessage = message.toLowerCase();
  for (const keyword of specificKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      specificityCount++;
    }
  }

  // 具体性スコア: 1つにつき+5点（最大15点）
  const specificityScore = Math.min(specificityCount * 5, 15);

  // 総合スコア
  const totalScore = Math.min(lengthScore + specificityScore, 50);

  const details = `${lengthDetails}、具体性: ${specificityCount > 0 ? '含む' : 'なし'}`;

  return { score: totalScore, details };
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
    const { message }: AnalyzeRequest = req.body;

    if (message === undefined || message === null) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('🤖 AI質的分析開始:', { messageLength: message.length });

    // メッセージが空の場合
    if (!message || message.trim().length === 0) {
      const result: AnalysisResult = {
        contextScore: 0,
        sentimentScore: 0,
        totalScore: 0,
        sentimentLabel: 'なし',
        contextDetails: 'メッセージなし'
      };

      return res.status(200).json(result);
    }

    // 感情分析
    const sentiment = analyzeSentiment(message);

    // 文脈理解
    const context = analyzeContext(message);

    // 結果
    const result: AnalysisResult = {
      contextScore: context.score,
      sentimentScore: sentiment.score,
      totalScore: context.score + sentiment.score,
      sentimentLabel: sentiment.label,
      contextDetails: context.details
    };

    console.log('✅ AI質的分析完了:', result);

    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ AI質的分析エラー:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : '不明なエラー'
    });
  }
}
