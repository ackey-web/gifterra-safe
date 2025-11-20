// api/upload/index.ts
// ファイルアップロードAPI統合（管理用・コンテンツ用）
// セキュリティ: サーバーサイドでSERVICE_ROLE_KEYを使用

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

interface UploadRequest {
  type: 'admin' | 'content';
  file: {
    name: string;
    type: string;
    base64: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { type, file }: UploadRequest = req.body;

    if (!file || !file.name || !file.base64) {
      return res.status(400).json({ error: 'ファイルデータが不正です' });
    }

    // Base64デコード
    const base64Data = file.base64.split(',')[1] || file.base64;
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // タイムスタンプ付きファイル名
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;

    // アップロード先バケット選択
    const bucketName = type === 'admin' ? bucket('PUBLIC') : bucket('DOWNLOADS');

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error(`❌ [API] ${type} アップロードエラー:`, error);
      return res.status(500).json({
        error: 'ファイルのアップロードに失敗しました',
        details: error.message
      });
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    console.log(`✅ [API] ${type} アップロード成功:`, publicUrl);

    return res.json({
      success: true,
      url: publicUrl,
      path: data.path
    });

  } catch (error) {
    console.error('❌ [API] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
