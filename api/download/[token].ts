// api/download/[token].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket } from '../../src/lib/storageBuckets.js';

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'トークンが無効です' });
    }

    console.log('🔑 ダウンロードトークン検証:', token);

    // トークンを検証して消費
    const { data: tokenDataRaw, error: tokenError } = await supabase
      .rpc('consume_download_token', { p_token: token });

    console.log('🔍 [DEBUG] RPC結果:', {
      tokenDataRaw,
      isArray: Array.isArray(tokenDataRaw),
      length: Array.isArray(tokenDataRaw) ? tokenDataRaw.length : 'N/A'
    });

    if (tokenError) {
      console.error('❌ トークン検証エラー:', tokenError);

      if (tokenError.message?.includes('expired')) {
        return res.status(410).json({ error: 'トークンの有効期限が切れています' });
      }

      if (tokenError.message?.includes('already consumed')) {
        return res.status(400).json({ error: 'このトークンは既に使用されています' });
      }

      return res.status(400).json({ error: 'トークンが無効です' });
    }

    // RETURNS TABLE は配列として返される
    const tokenData = Array.isArray(tokenDataRaw) ? tokenDataRaw[0] : tokenDataRaw;

    if (!tokenData || !tokenData.product_id) {
      console.error('❌ トークンデータが不正:', {
        tokenData,
        hasProductId: !!tokenData?.product_id
      });
      return res.status(404).json({ error: 'トークンが見つかりません' });
    }

    // product_idを文字列として明示的に扱う
    const productId = String(tokenData.product_id);

    console.log('✅ トークン検証成功:', {
      product_id: productId,
      product_id_type: typeof tokenData.product_id,
      product_id_string: productId,
      buyer: tokenData.buyer
    });

    // デバッグ: 全商品を確認
    const { data: allProducts, error: allProductsError } = await supabase
      .from('products')
      .select('id, name, tenant_id');

    console.log('🔍 [DEBUG] 全商品リスト:', {
      count: allProducts?.length || 0,
      products: allProducts?.map(p => ({
        id: p.id,
        id_type: typeof p.id,
        name: p.name,
        tenant_id: p.tenant_id,
        matches_search: p.id === productId || String(p.id) === productId
      }))
    });

    // 商品情報を取得（UUIDを文字列として比較）
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('content_path, name, id')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('❌ 商品が見つかりません:', {
        product_id: productId,
        product_id_original: tokenData.product_id,
        product_id_type: typeof tokenData.product_id,
        error: productError,
        errorMessage: productError?.message,
        errorCode: productError?.code,
        errorDetails: productError?.details,
        hint: productError?.hint
      });
      return res.status(404).json({
        error: '商品が見つかりません',
        details: productError?.message,
        product_id: productId,
        debug: {
          available_products: allProducts?.length || 0,
          error_code: productError?.code,
          all_product_ids: allProducts?.map(p => p.id)
        }
      });
    }

    console.log('✅ 商品情報取得:', {
      product_id: productId,
      content_path: product.content_path
    });

    // 非公開バケット（gh-downloads）から署名URL（10分間有効）を生成
    console.log('📦 署名URL生成開始:', {
      bucket: bucket('DOWNLOADS'),
      content_path: product.content_path
    });

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket('DOWNLOADS'))
      .createSignedUrl(product.content_path, 600); // 600秒 = 10分

    if (signedUrlError || !signedUrlData || !signedUrlData.signedUrl) {
      console.error('❌ 署名URL生成失敗:', {
        bucket: bucket('DOWNLOADS'),
        content_path: product.content_path,
        error: signedUrlError,
        errorMessage: signedUrlError?.message,
        signedUrlData
      });
      return res.status(500).json({
        error: 'ダウンロードURLの生成に失敗しました',
        details: signedUrlError?.message,
        bucket: bucket('DOWNLOADS'),
        path: product.content_path
      });
    }

    console.log('✅ 署名URL生成成功（有効期限: 10分）:', {
      signedUrl: signedUrlData.signedUrl.substring(0, 100) + '...'
    });

    // 302リダイレクト
    return res.redirect(302, signedUrlData.signedUrl);

  } catch (error) {
    console.error('❌ サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
