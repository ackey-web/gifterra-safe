// src/utils/openai.ts
// OpenAI APIとの統合（ギフティAIアシスタント用）

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// レート制限管理
const RATE_LIMIT = {
  maxRequestsPerMinute: 5,
  maxRequestsPerHour: 20,
};

// リクエスト履歴（メモリ内管理）
const requestHistory: number[] = [];

/**
 * レート制限チェック
 */
function checkRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  // 古いリクエストを削除
  const recentRequests = requestHistory.filter(time => time > oneHourAgo);
  requestHistory.length = 0;
  requestHistory.push(...recentRequests);

  // 1分間の制限チェック
  const requestsLastMinute = requestHistory.filter(time => time > oneMinuteAgo).length;
  if (requestsLastMinute >= RATE_LIMIT.maxRequestsPerMinute) {
    return {
      allowed: false,
      reason: `1分間のリクエスト上限（${RATE_LIMIT.maxRequestsPerMinute}回）に達しました。少し時間をおいてから再度お試しください。`,
    };
  }

  // 1時間の制限チェック
  if (requestHistory.length >= RATE_LIMIT.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: `1時間のリクエスト上限（${RATE_LIMIT.maxRequestsPerHour}回）に達しました。しばらく時間をおいてから再度お試しください。`,
    };
  }

  return { allowed: true };
}

/**
 * OpenAI APIにリクエストを送信
 */
export async function callOpenAI(params: {
  userMessage: string;
  context?: string;
  walletAddress?: string;
  displayName?: string;
}): Promise<{ success: boolean; content?: string; error?: string }> {
  // APIキーチェック
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('YOUR_')) {
    return {
      success: false,
      error: 'OpenAI APIキーが設定されていません。',
    };
  }

  // レート制限チェック
  const rateLimitCheck = checkRateLimit();
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: rateLimitCheck.reason,
    };
  }

  try {
    // システムプロンプト
    const systemPrompt = `あなたはGIFTERRAアシスタントの「ギフティ」です。
ユーザーを手助けするフレンドリーで親切なAIアシスタントとして振る舞ってください。

【あなたの役割】
- GIFTERRAの使い方やトラブルシューティングをサポート
- 簡潔でわかりやすい日本語で回答
- 技術的な質問には具体的なステップで説明
- わからないことは正直に伝える

【GIFTERRAについて】
- Web3ベースのチップ（投げ銭）プラットフォーム
- JPYCトークンを使った送金機能
- Polygon Mainnetで動作
- Privy認証またはMetaMask等のウォレット接続
${params.context ? `\n【追加コンテキスト】\n${params.context}` : ''}`;

    // リクエストボディ
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
    };

    // API呼び出し
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);

      if (response.status === 429) {
        return {
          success: false,
          error: 'OpenAI APIのレート制限に達しました。しばらく時間をおいてから再度お試しください。',
        };
      }

      return {
        success: false,
        error: `OpenAI APIエラー: ${response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'AIからの応答を取得できませんでした。',
      };
    }

    // リクエスト履歴に追加
    requestHistory.push(Date.now());

    return {
      success: true,
      content,
    };
  } catch (error) {
    console.error('OpenAI API Call Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ネットワークエラーが発生しました。',
    };
  }
}

/**
 * オフライン検知
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * AIが利用可能かチェック
 */
export function isAIAvailable(): boolean {
  return Boolean(OPENAI_API_KEY && !OPENAI_API_KEY.includes('YOUR_') && isOnline());
}
