// api/upload/content.ts
// 配布ファイルを非公開バケット（gh-downloads）にアップロードするAPI
// セキュリティ: サーバーサイドでSERVICE_ROLE_KEYを使用して安全にアップロード
// 方式: Base64エンコードでファイルを受信（Vercelサーバーレス最適化）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket } from '../../src/lib/storageBuckets.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

// Vercel設定: body size limit 増加（最大4.5MB、Base64で約6MBまで対応）
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Base64エンコード後のサイズ考慮
    },
  },
};

interface UploadRequest {
  fileBase64: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
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
    const { fileBase64, fileName, mimeType, fileSize }: UploadRequest = req.body;

    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'fileBase64 と fileName は必須です' });
    }

    console.log('📤 配布ファイルアップロード開始:', {
      fileName,
      mimeType,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`
    });

    // ファイルサイズ制限チェック（100MB）
    if (fileSize > 100 * 1024 * 1024) {
      return res.status(400).json({
        error: 'ファイルサイズが大きすぎます（最大100MB）'
      });
    }

    // Base64デコード
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    // ファイル名を生成（タイムスタンプ + ランダム文字列 + 元のファイル名）
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalFileName = `${timestamp}_${randomStr}_${sanitizedFileName}`;

    console.log('📁 アップロード先:', bucket('DOWNLOADS'), '/', finalFileName);

    // gh-downloads（非公開バケット）にアップロード
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket('DOWNLOADS'))
      .upload(finalFileName, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ アップロードエラー:', uploadError);
      return res.status(500).json({
        error: 'ファイルのアップロードに失敗しました',
        details: uploadError.message,
        code: uploadError.name
      });
    }

    console.log('✅ アップロード成功:', uploadData.path);

    // ファイルパスを返す（署名URL生成には使わない）
    return res.json({
      success: true,
      path: uploadData.path,
      fileName: finalFileName,
      size: fileSize
    });

  } catch (error) {
    console.error('❌ サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
}
