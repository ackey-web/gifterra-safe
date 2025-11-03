// api/delete/content.ts
// 非公開バケット（gh-downloads）からファイルを削除するAPI
// セキュリティ: サーバーサイドでSERVICE_ROLE_KEYを使用して安全に削除

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket } from '../../src/lib/storageBuckets.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

interface DeleteRequest {
  filePath: string;
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
    const { filePath }: DeleteRequest = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath は必須です' });
    }

    console.log('🗑️ ファイル削除開始:', {
      bucket: bucket('DOWNLOADS'),
      filePath
    });

    // gh-downloads（非公開バケット）からファイルを削除
    const { data, error } = await supabase.storage
      .from(bucket('DOWNLOADS'))
      .remove([filePath]);

    if (error) {
      console.error('❌ ファイル削除エラー:', error);
      return res.status(500).json({
        error: 'ファイルの削除に失敗しました',
        details: error.message,
        code: error.name
      });
    }

    console.log('✅ ファイル削除成功:', data);

    return res.json({
      success: true,
      deleted: data,
      message: 'ファイルを削除しました'
    });

  } catch (error) {
    console.error('❌ サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
}
