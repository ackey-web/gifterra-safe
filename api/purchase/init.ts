// api/purchase/init.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, getAddress } from 'viem';
import { polygonAmoy } from 'viem/chains';

// Supabase クライアント（サービスロール）
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const alchemyRpcUrl = process.env.ALCHEMY_RPC_URL!;

if (!supabaseUrl || !supabaseServiceRole || !alchemyRpcUrl) {
  console.error('❌ 環境変数が設定されていません', {
    hasUrl: !!supabaseUrl,
    hasServiceRole: !!supabaseServiceRole,
    hasAlchemy: !!alchemyRpcUrl
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

// viem クライアント（Amoy）
const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(alchemyRpcUrl),
});

interface PurchaseInitRequest {
  productId: string;
  buyer: string;
  txHash: string;
  amountWei: string;
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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { productId, buyer, txHash, amountWei }: PurchaseInitRequest = req.body;

    // 入力検証
    if (!productId || !buyer || !txHash || !amountWei) {
      return res.status(400).json({ success: false, error: '必須パラメータが不足しています' });
    }

    console.log('📦 購入処理開始:', { productId, buyer, txHash, amountWei });

    // 1. 商品情報を取得
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      console.error('❌ 商品が見つかりません:', productError);
      return res.status(404).json({ success: false, error: '商品が見つかりません' });
    }

    console.log('✅ 商品情報取得:', {
      name: product.name,
      price: product.price_amount_wei,
      stock: product.stock,
      isUnlimited: product.is_unlimited
    });

    // 2. トランザクション検証
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt) {
      return res.status(400).json({ success: false, error: 'トランザクションが見つかりません' });
    }

    if (receipt.status !== 'success') {
      return res.status(400).json({ success: false, error: 'トランザクションが失敗しています' });
    }

    console.log('✅ トランザクション検証OK:', { blockNumber: receipt.blockNumber });

    // 3. 金額検証
    const expectedAmount = BigInt(product.price_amount_wei);
    const paidAmount = BigInt(amountWei);

    if (paidAmount < expectedAmount) {
      return res.status(400).json({
        success: false,
        error: `支払額が不足しています（必要: ${expectedAmount.toString()}, 実際: ${paidAmount.toString()}）`
      });
    }

    console.log('✅ 金額検証OK');

    // 4. 既存購入をチェック（冪等性）
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('tx_hash', txHash)
      .single();

    if (existingPurchase) {
      console.log('ℹ️ 既に処理済みの購入です（冪等）');

      // 既存のダウンロードトークンを取得
      const { data: existingToken } = await supabase
        .from('download_tokens')
        .select('token')
        .eq('purchase_id', existingPurchase.id)
        .eq('is_consumed', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (existingToken) {
        return res.status(200).json({
          success: true,
          token: existingToken.token
        });
      }

      // トークンが期限切れの場合、新しいトークンを発行（24時間有効）
      const { data: newToken, error: tokenError } = await supabase
        .rpc('create_download_token', {
          p_purchase_id: existingPurchase.id,
          p_product_id: productId,
          p_ttl_seconds: 86400  // 24時間
        });

      if (tokenError || !newToken) {
        console.error('❌ トークン再発行失敗:', tokenError);
        return res.status(500).json({ success: false, error: 'トークンの再発行に失敗しました' });
      }

      return res.status(200).json({
        success: true,
        token: newToken
      });
    }

    // 5. 在庫を確保（原子的）
    if (!product.is_unlimited) {
      const { data: stockResult, error: stockError } = await supabase
        .rpc('decrement_stock', { p_product_id: productId });

      if (stockError || !stockResult?.[0]?.success) {
        console.error('❌ 在庫確保失敗（SOLD OUT）:', stockError);
        return res.status(409).json({ success: false, error: 'SOLD OUT' });
      }

      console.log('✅ 在庫を確保:', { remaining: stockResult[0].remaining_stock });
    } else {
      console.log('✅ 在庫無制限のため在庫確保スキップ');
    }

    // 6. 購入履歴を記録
    const { data: newPurchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        product_id: productId,
        buyer: getAddress(buyer),
        tx_hash: txHash,
        amount_wei: amountWei,
      })
      .select()
      .single();

    if (purchaseError || !newPurchase) {
      console.error('❌ 購入履歴の保存失敗:', purchaseError);

      // 在庫をロールバック（無制限でない場合）
      if (!product.is_unlimited) {
        await supabase
          .from('products')
          .update({ stock: product.stock })
          .eq('id', productId);
        console.log('🔄 在庫をロールバック');
      }

      return res.status(500).json({ success: false, error: '購入履歴の保存に失敗しました' });
    }

    console.log('✅ 購入履歴を記録:', newPurchase.id);

    // 7. ダウンロードトークンを発行（TTL=86400秒=24時間）
    const { data: downloadToken, error: tokenError } = await supabase
      .rpc('create_download_token', {
        p_purchase_id: newPurchase.id,
        p_product_id: productId,
        p_ttl_seconds: 86400  // 24時間
      });

    if (tokenError || !downloadToken) {
      console.error('❌ ダウンロードトークン発行失敗:', tokenError);
      return res.status(500).json({ success: false, error: 'ダウンロードトークンの発行に失敗しました' });
    }

    console.log('✅ ダウンロードトークン発行:', downloadToken);

    // 成功レスポンス
    return res.status(200).json({
      success: true,
      token: downloadToken
    });

  } catch (error) {
    console.error('❌ サーバーエラー:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
