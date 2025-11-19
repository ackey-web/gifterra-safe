// api/delete/index.ts
// 削除API（商品削除とコンテンツ削除を統合）
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

interface DeleteRequest {
  type: 'product' | 'content';
  productId?: string;
  filePath?: string;
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
    const { type, productId, filePath }: DeleteRequest = req.body;

    // 商品削除
    if (type === 'product') {
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

      // サムネイル画像を削除
      if (product?.image_url) {
        try {
          const url = new URL(product.image_url);
          const pathParts = url.pathname.split('/');
          const fileName = pathParts[pathParts.length - 1];

          const { error: imgError } = await supabase.storage
            .from(bucket('PUBLIC'))
            .remove([fileName]);

          if (imgError) {
            deletionResults.push('サムネイル画像の削除に失敗しました');
          } else {
            deletionResults.push('サムネイル画像を削除しました');
          }
        } catch {
          deletionResults.push('サムネイル画像の削除をスキップしました');
        }
      }

      // 配布ファイルを削除
      if (product?.content_path) {
        try {
          const { error: contentError } = await supabase.storage
            .from(bucket('DOWNLOADS'))
            .remove([product.content_path]);

          if (contentError) {
            deletionResults.push('配布ファイルの削除に失敗しました');
          } else {
            deletionResults.push('配布ファイルを削除しました');
          }
        } catch {
          deletionResults.push('配布ファイルの削除をスキップしました');
        }
      }

      // データベースから商品を削除
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        return res.status(500).json({
          error: '商品の削除に失敗しました',
          details: deleteError.message
        });
      }

      return res.json({
        success: true,
        message: '商品とファイルを削除しました',
        deletionResults
      });
    }

    // コンテンツ削除
    if (type === 'content') {
      if (!filePath) {
        return res.status(400).json({ error: 'filePath は必須です' });
      }

      const { data, error } = await supabase.storage
        .from(bucket('DOWNLOADS'))
        .remove([filePath]);

      if (error) {
        return res.status(500).json({
          error: 'ファイルの削除に失敗しました',
          details: error.message
        });
      }

      return res.json({
        success: true,
        deleted: data,
        message: 'ファイルを削除しました'
      });
    }

    return res.status(400).json({ error: 'type は product または content を指定してください' });

  } catch (error) {
    console.error('❌ [API] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
