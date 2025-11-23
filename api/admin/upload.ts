// api/admin/upload.ts
// Service Role を使った安全なファイルアップロード API
// Base64エンコーディングを使用（formidable不要）
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket } from '../../src/lib/storageBuckets.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ 環境変数が設定されていません');
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

interface UploadRequest {
  fileData: string;      // Base64エンコードされたファイルデータ
  fileName: string;      // 元のファイル名
  contentType: string;   // MIMEタイプ
  bucketType: 'PUBLIC' | 'DOWNLOADS' | 'LOGOS' | 'AVATARS' | 'TEMP';
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as UploadRequest;

    if (!body.fileData || !body.fileName || !body.bucketType) {
      return res.status(400).json({
        error: 'fileData, fileName, bucketType は必須です'
      });
    }

    const bucketName = bucket(body.bucketType);

    console.log('📤 ファイルアップロード開始:', {
      bucketType: body.bucketType,
      bucketName,
      fileName: body.fileName,
      contentType: body.contentType,
    });

    // Base64データからバッファを作成
    // データURL形式の場合: "data:image/png;base64,iVBORw0KGgo..."
    const base64Data = body.fileData.includes('base64,')
      ? body.fileData.split('base64,')[1]
      : body.fileData;

    const fileBuffer = Buffer.from(base64Data, 'base64');

    console.log('📦 ファイルサイズ:', fileBuffer.length, 'bytes');

    // ファイル名を生成（衝突を避けるためタイムスタンプ付き）
    const fileExt = body.fileName.split('.').pop() || 'bin';
    const generatedFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Supabase Storage にアップロード
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(generatedFileName, fileBuffer, {
        contentType: body.contentType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase Storage エラー:', error);
      return res.status(500).json({
        error: `アップロード失敗: ${error.message}`,
        code: error.name,
      });
    }

    console.log('✅ アップロード成功:', data.path);

    // 非公開バケットの場合はパスのみ返す（署名URLは購入時に生成）
    if (body.bucketType === 'DOWNLOADS' || body.bucketType === 'TEMP') {
      return res.status(200).json({
        success: true,
        path: data.path,
        bucket: bucketName,
        isPrivate: true,
      });
    }

    // 公開バケットの場合は公開URLを返す
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    console.log('✅ 公開URL取得:', publicData.publicUrl);

    return res.status(200).json({
      success: true,
      url: publicData.publicUrl,
      path: data.path,
      bucket: bucketName,
      isPrivate: false,
    });

  } catch (error) {
    console.error('❌ サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー',
    });
  }
}
