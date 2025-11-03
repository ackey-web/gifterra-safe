// api/ai/chat.ts
// GIFTERRA AI アシスタント - GPT-4 Turbo Function Calling

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;
const alchemyRpcUrl = process.env.ALCHEMY_RPC_URL!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);
const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(alchemyRpcUrl),
});

// GPT-4 Turbo用のFunction定義
const FUNCTIONS = [
  {
    name: 'get_claim_history',
    description: 'ユーザーの特典受け取り履歴を取得します。受け取り済み・失敗・期限切れなどの状態を確認できます。',
    parameters: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'ユーザーのウォレットアドレス（0x...）'
        }
      },
      required: ['walletAddress']
    }
  },
  {
    name: 'reissue_claim_token',
    description: '特典受け取りに失敗した場合、新しいダウンロードトークンを再発行します。トランザクションを検証し、24時間有効なトークンを生成します。',
    parameters: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'ユーザーのウォレットアドレス'
        },
        txHash: {
          type: 'string',
          description: 'チップのトランザクションハッシュ'
        }
      },
      required: ['walletAddress', 'txHash']
    }
  },
  {
    name: 'get_kodomi_analysis',
    description: 'ユーザーの貢献熱量（Kodomi）分析を取得します。Tip UIでのチップ履歴、GIFT HUBでの特典受け取り履歴から総合的なエンゲージメントレベルを分析します。',
    parameters: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'ユーザーのウォレットアドレス'
        }
      },
      required: ['walletAddress']
    }
  }
];

// システムプロンプト（法的コンプライアンス）
const SYSTEM_PROMPT = `あなたはGIFTERRAの特典配布サポートAIアシスタント「ギフティ」です。

【あなたの名前】
- あなたの名前は「ギフティ」です
- 自己紹介する際は必ず「ギフティ」と名乗ってください
- 親しみやすく、フレンドリーな口調で対応してください

【重要な用語規則】
- 「購入」「買う」という表現は絶対に使用しないでください
- 「受け取り」「配布」「特典」を使用してください
- 「商品」ではなく「特典」と表記してください
- 「価格」ではなく「必要TIP数」と表記してください

【あなたの役割】
1. 特典の受け取りに問題が発生したユーザーをサポート
2. 受け取り履歴を確認し、失敗原因を特定
3. トランザクションが完了している場合、新しいダウンロードURLを自動発行
4. **貢献熱量（Kodomi）とトークン残高に基づいて最適な特典を提案**
5. **ランクアップ目前のユーザーには、達成に必要な特典を推奨**
6. **在庫が少ない特典を優先的に案内**

【対応方針】
- 親切で丁寧な日本語で対応
- 専門用語を避け、わかりやすく説明
- 問題解決まで寄り添う姿勢
- チップが完了していることを確認してから再発行

【特典の正しい受け取り方法】
ユーザーが受け取り方法を聞いてきた場合、以下の順序で説明してください：
1. まず「ウォレット接続」ボタンでウォレットを接続
2. 画面に表示されている特典ボタンで「必要なTIP数」を確認
3. 欲しい特典ボタンをクリック
4. ウォレットでチップを承認・実行
5. 自動的にダウンロードURLが表示されるので、そこからダウンロード

※重要：ウォレット接続が最初のステップです。接続していないと特典は受け取れません。

【受け取り履歴の確認方法】
ユーザーが受け取り履歴を見たい、確認したい、と言った場合：
1. 受け取り履歴ページへのリンクを案内してください
2. URL: https://gifterra-test-stable.vercel.app/claim-history
3. 「こちらのページで、これまで受け取った特典の履歴を確認できます」と案内
4. 「受け取り済み」「受け取り可能」「期限切れ」のステータスが表示されること
5. 期限切れの場合は、私に話しかければ再発行できることを伝える

※GIFT HUBページにも「📜 受け取り履歴を確認」ボタンがありますが、直接リンクを案内してもOKです。

【利用可能な機能】
1. get_claim_history: 受け取り履歴の確認
2. reissue_claim_token: ダウンロードトークンの再発行（チップ完了済みの場合のみ）
3. get_kodomi_analysis: 貢献熱量分析の取得

【トラブルシューティング対応フロー】
1. ユーザーの状況をヒアリング
2. get_claim_historyで履歴を確認
3. トランザクションハッシュを聞き出す
4. reissue_claim_tokenで新しいURLを発行
5. 24時間有効なダウンロードリンクを案内
6. **必ず最後に「この問題は解決しましたか？」と確認してください**

【重要】再ダウンロードURLを案内した後の対応
- 必ず「この問題は解決しましたか？」と質問してください
- ユーザーが「はい」「解決した」と答えたら、チャット履歴が自動的に削除されます
- これにより運営コストの削減に貢献します

【スマート提案システム】
ユーザーが「おすすめは？」「どの特典がいい？」と聞いてきた場合、以下の優先順位で提案してください：

1. **ランクアップ支援（最優先）**
   - ユーザー情報に「ランクアップチャンス！」と表示されている場合
   - ランクアップに必要なポイントに最も近い特典を提案
   - 例: "あと50ポイントでACTIVEランクです！この100 tNHTの特典を受け取ると、ランクアップできますよ！"

2. **在庫緊急性**
   - 「⚠️ 残りわずか！」マークがついている特典を優先
   - 在庫3個以下の特典は人気商品として案内
   - 例: "こちらの特典は残り2個で、とても人気があります！"

3. **残高最適化**
   - ユーザーの現在のtNHT残高で受け取れる特典のみ提案
   - 残高が足りない場合は、Faucetで取得できることを案内
   - 複数の特典を組み合わせて、残高を有効活用する提案も可能

4. **エンゲージメントレベル別**
   - PREMIUM: 高額特典や限定特典を優先
   - ACTIVE: バランスの取れた中価格帯の特典
   - CASUAL: 手軽に受け取れる低価格特典から案内

**提案時の注意点**
- 必ず「受け取る」という表現を使い、「購入」は使わない
- 在庫状況とtNHT残高を必ず確認してから提案
- 1度に1〜3個の特典に絞って提案（多すぎない）
- 各特典の魅力を簡潔に説明`;

// Function実装: 受け取り履歴取得
async function getClaimHistory(walletAddress: string) {
  try {
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select(`
        *,
        products (
          name,
          description
        ),
        download_tokens (
          token,
          is_consumed,
          expires_at,
          consumed_at
        )
      `)
      .eq('buyer', walletAddress)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ 受け取り履歴取得エラー:', error);
      return { success: false, error: error.message };
    }

    const formatted = purchases?.map(p => ({
      txHash: p.tx_hash,
      productName: p.products?.name || '不明',
      claimedAt: p.created_at,
      status: p.download_tokens?.[0]?.is_consumed
        ? '受け取り済み'
        : p.download_tokens?.[0]?.expires_at && new Date(p.download_tokens[0].expires_at) < new Date()
        ? '期限切れ'
        : p.download_tokens?.[0]
        ? '受け取り可能'
        : '処理中',
      hasValidToken: p.download_tokens?.some(
        (t: any) => !t.is_consumed && new Date(t.expires_at) > new Date()
      )
    }));

    return { success: true, claims: formatted };
  } catch (error) {
    console.error('❌ getClaimHistory エラー:', error);
    return { success: false, error: String(error) };
  }
}

// Function実装: トークン再発行
async function reissueClaimToken(walletAddress: string, txHash: string) {
  try {
    console.log('🔄 トークン再発行開始:', { walletAddress, txHash });

    // 1. トランザクションをブロックチェーンで検証
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`
    });

    if (!receipt) {
      return { success: false, error: 'トランザクションが見つかりません' };
    }

    if (receipt.status !== 'success') {
      return { success: false, error: 'トランザクションが失敗しています' };
    }

    console.log('✅ トランザクション検証OK:', { blockNumber: receipt.blockNumber });

    // 2. 既存の購入レコードを取得
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('tx_hash', txHash)
      .eq('buyer', walletAddress)
      .single();

    if (purchaseError || !purchase) {
      return {
        success: false,
        error: '受け取り履歴が見つかりません。トランザクションハッシュを確認してください。'
      };
    }

    console.log('✅ 受け取り履歴確認:', purchase.id);

    // 3. 既存の有効なトークンをチェック
    const { data: existingTokens } = await supabase
      .from('download_tokens')
      .select('*')
      .eq('purchase_id', purchase.id)
      .eq('is_consumed', false)
      .gte('expires_at', new Date().toISOString());

    if (existingTokens && existingTokens.length > 0) {
      console.log('ℹ️ 既に有効なトークンが存在します');
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      return {
        success: true,
        token: existingTokens[0].token,
        downloadUrl: `${baseUrl}/api/download/${existingTokens[0].token}`,
        expiresAt: existingTokens[0].expires_at,
        message: '既存の有効なトークンを返却しました'
      };
    }

    // 4. 新しいトークンを発行（24時間有効、3回ダウンロード可能）
    const { data: newToken, error: tokenError } = await supabase
      .rpc('create_download_token', {
        p_purchase_id: purchase.id,
        p_product_id: purchase.product_id,
        p_ttl_seconds: 86400 // 24時間
      });

    if (tokenError || !newToken) {
      console.error('❌ トークン発行エラー:', tokenError);
      return { success: false, error: 'トークンの発行に失敗しました' };
    }

    console.log('✅ 新しいトークン発行:', newToken);

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    return {
      success: true,
      token: newToken,
      downloadUrl: `${baseUrl}/api/download/${newToken}`,
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      message: '新しいダウンロードリンクを発行しました'
    };
  } catch (error) {
    console.error('❌ reissueClaimToken エラー:', error);
    return { success: false, error: String(error) };
  }
}

// Function実装: Kodomi分析取得（簡易版）
async function getKodomiAnalysis(walletAddress: string) {
  // この関数はフロントエンドのkodomi-integration.tsと同等の処理
  // APIとして独立して呼び出せるようにする
  try {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('*, products(*)')
      .eq('buyer', walletAddress);

    const claimCount = purchases?.length || 0;
    const totalTipped = purchases?.reduce(
      (sum, p) => sum + BigInt(p.amount_wei || '0'),
      0n
    ) || 0n;

    return {
      success: true,
      giftHub: {
        claimCount,
        totalTipped: totalTipped.toString(),
        lastClaimDate: purchases?.[0]?.created_at || null
      }
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { walletAddress, message, context, kodomiProfile, products, userBalance } = req.body;

    if (!walletAddress || !message) {
      return res.status(400).json({ error: 'walletAddress と message は必須です' });
    }

    console.log('💬 AI Chat リクエスト:', { walletAddress, context, productsCount: products?.length });

    // 商品情報を整形
    const formatProducts = (prods: any[]) => {
      if (!prods || prods.length === 0) return '現在、利用可能な特典はありません。';

      return prods.map((p, idx) => {
        const priceInToken = (BigInt(p.price_amount_wei) / BigInt(10 ** 18)).toString();
        const stockInfo = p.is_unlimited ? '在庫: 無制限' : `在庫: ${p.stock}個${p.stock <= 3 ? ' ⚠️ 残りわずか！' : ''}`;
        return `${idx + 1}. ${p.name}
   必要TIP数: ${priceInToken} tNHT
   ${stockInfo}
   ${p.description || ''}`;
      }).join('\n\n');
    };

    // ランクアップ分析
    const analyzeRankUpOpportunity = (profile: any) => {
      if (!profile?.combined?.loyaltyScore) return '';

      const score = profile.combined.loyaltyScore;
      const currentLevel = profile.combined.engagementLevel;

      if (currentLevel === 'CASUAL' && score >= 350) {
        const remaining = 400 - score;
        return `\n\n💡 ランクアップチャンス！あと${remaining}ポイントでACTIVEランクに到達できます！`;
      } else if (currentLevel === 'ACTIVE' && score >= 750) {
        const remaining = 800 - score;
        return `\n\n✨ PREMIUMランクまであと${remaining}ポイント！`;
      }
      return '';
    };

    // ユーザーコンテキストを構築
    const balanceInToken = userBalance ? Math.floor(Number(userBalance)).toString() : '0';
    const rankUpMessage = analyzeRankUpOpportunity(kodomiProfile);

    const userContext = `
【ユーザー情報】
ウォレットアドレス: ${walletAddress}
貢献熱量レベル: ${kodomiProfile?.heatLevel || '不明'}
エンゲージメント: ${kodomiProfile?.combined?.engagementLevel || '不明'}
ロイヤリティスコア: ${kodomiProfile?.combined?.loyaltyScore || 0}${rankUpMessage}
現在のtNHT残高: ${balanceInToken} tNHT

【GIFT HUBで受け取れる特典一覧】
${formatProducts(products || [])}
`;

    const contextMessage = context === 'CLAIM_FAILED'
      ? '【状況】このユーザーは特典の受け取りに失敗しています。受け取り履歴を確認して、適切にサポートしてください。'
      : '';

    // GPT-4 Turboにリクエスト
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: userContext + '\n' + contextMessage },
          { role: 'user', content: message }
        ],
        functions: FUNCTIONS,
        function_call: 'auto',
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API エラー:', response.status, errorText);
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    // Function Callがリクエストされた場合
    if (choice.message.function_call) {
      const functionName = choice.message.function_call.name;
      const functionArgs = JSON.parse(choice.message.function_call.arguments);

      console.log('🔧 Function Call:', functionName, functionArgs);

      let functionResult;

      switch (functionName) {
        case 'get_claim_history':
          functionResult = await getClaimHistory(functionArgs.walletAddress);
          break;
        case 'reissue_claim_token':
          functionResult = await reissueClaimToken(
            functionArgs.walletAddress,
            functionArgs.txHash
          );
          break;
        case 'get_kodomi_analysis':
          functionResult = await getKodomiAnalysis(functionArgs.walletAddress);
          break;
        default:
          functionResult = { error: 'Unknown function' };
      }

      // Function結果をGPTに返して最終応答を生成
      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'system', content: userContext + '\n' + contextMessage },
            { role: 'user', content: message },
            choice.message,
            {
              role: 'function',
              name: functionName,
              content: JSON.stringify(functionResult)
            }
          ],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      const followUpData = await followUpResponse.json();
      const finalMessage = followUpData.choices[0].message.content;

      return res.json({
        message: finalMessage,
        functionCalled: functionName,
        functionResult
      });
    }

    // 通常の応答
    return res.json({
      message: choice.message.content
    });
  } catch (error) {
    console.error('❌ AI Chat エラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
