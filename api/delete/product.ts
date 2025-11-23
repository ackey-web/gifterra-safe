// api/delete/product.ts
// 商品を完全削除するAPI（RLS バイパス用）
// セキュリティ: サーバーサイドでSERVICE_ROLE_KEYを使用して安全に削除

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket } from '../../src/lib/storageBuckets.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface DeleteProductRequest {
  productId: string;
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
    const { productId }: DeleteProductRequest = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'productId は必須です' });
    }

    // まず商品データを取得
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('image_url, content_path, name')
      .eq('id', productId)
      .single();

    if (fetchError) {
      console.error('❌ [API] 商品取得エラー:', fetchError);
      return res.status(404).json({
        error: '商品が見つかりません',
        details: fetchError.message
      });
    }

    const deletionResults: string[] = [];

    // サムネイル画像を削除（公開バケット gh-public）
    if (product?.image_url) {
      try {
        // URLからファイル名を抽出
        const url = new URL(product.image_url);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];

        const { error: imgError } = await supabase.storage
          .from(bucket('PUBLIC'))
          .remove([fileName]);

        if (imgError) {
          console.warn('⚠️ [API] サムネイル画像削除エラー:', imgError);
          deletionResults.push('サムネイル画像の削除に失敗しました');
        } else {
          deletionResults.push('サムネイル画像を削除しました');
        }
      } catch (imgErr) {
        console.warn('⚠️ [API] サムネイル画像削除エラー:', imgErr);
        deletionResults.push('サムネイル画像の削除をスキップしました');
      }
    }

    // 配布ファイルを削除（非公開バケット gh-downloads）
    if (product?.content_path) {
      try{
        const { error: contentError } = await supabase.storage
          .from(bucket('DOWNLOADS'))
          .remove([product.content_path]);

        if (contentError) {
          console.warn('⚠️ [API] 配布ファイル削除エラー:', contentError);
          deletionResults.push('配布ファイルの削除に失敗しました');
        } else {
          deletionResults.push('配布ファイルを削除しました');
        }
      } catch (contentErr) {
        console.warn('⚠️ [API] 配布ファイル削除エラー:', contentErr);
        deletionResults.push('配布ファイルの削除をスキップしました');
      }
    }

    // データベースから商品を完全削除（SERVICE_ROLE_KEYを使用するのでRLSをバイパス）
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (deleteError) {
      console.error('❌ [API] 商品削除エラー:', deleteError);
      return res.status(500).json({
        error: '商品の削除に失敗しました',
        details: deleteError.message,
        code: deleteError.code
      });
    }

    return res.json({
      success: true,
      message: '商品とファイルを削除しました',
      deletionResults
    });

  } catch (error) {
    console.error('❌ [API] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
}
