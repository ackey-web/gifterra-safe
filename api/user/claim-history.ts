// api/user/claim-history.ts
// ユーザーの特典受け取り履歴を取得するAPI

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage, createPublicClient, http } from 'viem';
import { lineaSepolia } from 'viem/chains';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

// Public client for blockchain verification
const publicClient = createPublicClient({
  chain: lineaSepolia,
  transport: http()
});

// トランザクションが成功したかチェックする関数
async function isTransactionSuccessful(txHash: string): Promise<boolean | null> {
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`
    });
    // status === 'success' ならば成功、'reverted' ならば失敗
    return receipt.status === 'success';
  } catch (error) {
    console.warn(`⚠️ トランザクション ${txHash} の検証に失敗:`, error);
    // エラーの場合はnullを返す（ステータス不明）
    return null;
  }
}

interface ClaimHistoryRequest {
  walletAddress: string;
  signature?: string;
  message?: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_amount_wei: string;
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
    const { walletAddress, signature, message }: ClaimHistoryRequest = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress は必須です' });
    }

    // ウォレット署名検証（署名がある場合のみ）
    if (signature && message) {
      try {
        const isValid = await verifyMessage({
          address: walletAddress as `0x${string}`,
          message,
          signature: signature as `0x${string}`
        });

        if (!isValid) {
          return res.status(401).json({ error: 'ウォレット署名が無効です' });
        }
      } catch (error) {
        console.error('❌ 署名検証エラー:', error);
        return res.status(401).json({ error: '署名の検証に失敗しました' });
      }
    }

    console.log('📊 受け取り履歴取得:', walletAddress);

    // Step 1: purchasesテーブルから購入履歴を取得
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('id, product_id, buyer, tx_hash, amount_wei, created_at')
      .eq('buyer', walletAddress)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('❌ 受け取り履歴取得エラー:', purchasesError);
      return res.status(500).json({
        error: '受け取り履歴の取得に失敗しました',
        details: purchasesError.message,
        code: purchasesError.code
      });
    }

    // データが0件の場合は空配列を返す
    if (!purchases || purchases.length === 0) {
      console.log('ℹ️ 受け取り履歴なし:', walletAddress);
      return res.json({
        success: true,
        walletAddress,
        claims: [],
        totalClaims: 0
      });
    }

    // Step 2: product_idのリストを取得
    const productIds = [...new Set(purchases.map(p => p.product_id))];

    // Step 3: productsテーブルから商品情報を取得
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, description, image_url, price_amount_wei')
      .in('id', productIds);

    if (productsError) {
      console.error('❌ 商品情報取得エラー:', productsError);
      // 商品情報が取得できなくても続行（商品名を「不明」にする）
    }

    // Step 4: purchase_idのリストでダウンロードトークンを取得
    const purchaseIds = purchases.map(p => p.id);
    const { data: tokens, error: tokensError } = await supabase
      .from('download_tokens')
      .select('purchase_id, token, is_consumed, expires_at, consumed_at, created_at')
      .in('purchase_id', purchaseIds);

    if (tokensError) {
      console.error('❌ トークン情報取得エラー:', tokensError);
      // トークン情報が取得できなくても続行（ステータスを「処理中」にする）
    }

    // Step 5: データを結合
    const productsMap = new Map<string, Product>(products?.map(p => [p.id, p]) || []);
    const tokensMap = new Map<string, any[]>();

    // purchase_idごとにトークンをグループ化
    tokens?.forEach(token => {
      const purchaseId = token.purchase_id;
      if (!tokensMap.has(purchaseId)) {
        tokensMap.set(purchaseId, []);
      }
      tokensMap.get(purchaseId)!.push(token);
    });

    // 受け取り履歴を整形（トランザクション検証を含む）
    const formattedClaims = await Promise.all(
      (purchases || []).map(async (purchase) => {
        // 商品情報を取得
        const product = productsMap.get(purchase.product_id);

        // このpurchase_idに紐づくトークンを取得
        const purchaseTokens = tokensMap.get(purchase.id) || [];

        // 最新のトークンを取得
        const latestToken = purchaseTokens.length > 0
          ? purchaseTokens.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;

        // トランザクションが実際に成功したかチェック
        const txSuccess = await isTransactionSuccessful(purchase.tx_hash);

        // ステータス判定
        let status: 'completed' | 'expired' | 'available' | 'pending' | 'failed';
        let statusLabel: string;

        // トランザクション失敗の場合
        if (txSuccess === false) {
          status = 'failed';
          statusLabel = '❌ 受け取り未完';
        } else if (latestToken) {
          if (latestToken.is_consumed) {
            status = 'completed';
            statusLabel = '✅ 受け取り済み';
          } else if (new Date(latestToken.expires_at) < new Date()) {
            status = 'expired';
            statusLabel = '⏰ 期限切れ';
          } else {
            status = 'available';
            statusLabel = '📦 受け取り可能';
          }
        } else {
          status = 'pending';
          statusLabel = '⏳ 処理中';
        }

        return {
          purchaseId: purchase.id,
          productId: purchase.product_id,
          productName: product?.name || '不明',
          productDescription: product?.description || '',
          productImage: product?.image_url || '',
          txHash: purchase.tx_hash,
          amountWei: purchase.amount_wei,
          claimedAt: purchase.created_at,
          status,
          statusLabel,
          hasValidToken: latestToken && !latestToken.is_consumed && new Date(latestToken.expires_at) > new Date(),
          tokenExpiresAt: latestToken?.expires_at || null,
          downloadUrl: latestToken && !latestToken.is_consumed && new Date(latestToken.expires_at) > new Date()
            ? `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/download/${latestToken.token}`
            : null
        };
      })
    );

    console.log('✅ 受け取り履歴取得成功:', {
      walletAddress,
      claimCount: formattedClaims.length
    });

    return res.json({
      success: true,
      walletAddress,
      claims: formattedClaims,
      totalClaims: formattedClaims.length
    });
  } catch (error) {
    console.error('❌ claim-history API エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '内部サーバーエラー';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('❌ エラー詳細:', {
      message: errorMessage,
      stack: errorStack,
      walletAddress: req.body?.walletAddress
    });

    return res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}
