// src/lib/uploadApi.ts
// サーバーサイドアップロードAPI用クライアント

// 開発環境では空文字列でOK（同じオリジン）
// 本番環境では Vercel のドメインを設定
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export type BucketType = 'PUBLIC' | 'DOWNLOADS' | 'LOGOS' | 'AVATARS' | 'TEMP';

interface UploadResponse {
  success: boolean;
  url?: string;      // 公開バケットの場合のみ
  path: string;      // Storageパス
  bucket: string;    // バケット名
  isPrivate: boolean;
}

/**
 * ファイルをBase64エンコードする
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * サーバーサイドAPI経由でファイルをアップロード
 *
 * @param file - アップロードするファイル
 * @param bucketType - バケットタイプ
 * @returns アップロード結果（公開URLまたはパス）
 */
export async function uploadFileViaAPI(
  file: File,
  bucketType: BucketType
): Promise<UploadResponse> {
  try {
    // ファイルをBase64エンコード
    const fileData = await fileToBase64(file);

    // APIにPOST
    const response = await fetch(`${API_BASE_URL}/api/admin/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData,
        fileName: file.name,
        contentType: file.type,
        bucketType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'アップロードに失敗しました');
    }

    const result: UploadResponse = await response.json();

    return result;
  } catch (error) {
    console.error('❌ uploadFileViaAPI エラー:', error);
    throw error;
  }
}
