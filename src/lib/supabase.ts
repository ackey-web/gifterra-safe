// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { bucket, type BucketKey, type UploadKind, bucketNameForKind } from './storageBuckets';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// デバッグ用ログ

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-supabase-anon-key-here');

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase環境変数が設定されていません。管理機能を使用する場合は.envファイルを確認してください。');
}

// Supabase設定状態をエクスポート
export { isSupabaseConfigured };

// Supabaseクライアントを条件付きで作成（設定されている場合のみ）
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

/**
 * URLからファイルパスを抽出
 * 例: https://xxx.supabase.co/storage/v1/object/public/gh-public/12345.jpg → 12345.jpg
 */
export function extractFilePathFromUrl(url: string, bucketName: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf(bucketName);
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      // バケット名以降のパスを結合
      return pathParts.slice(bucketIndex + 1).join('/');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * URLからバケット名とファイルパスを自動抽出して削除
 *
 * @param url - ファイルの公開URL
 * @returns 削除成功時 true
 */
export async function deleteFileFromUrl(url: string): Promise<boolean> {
  try {
    if (!url) return false;

    // URLからバケット名を推定
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // バケット名を探す（gh-public, gh-downloads など）
    const bucketName = pathParts.find(part => part.startsWith('gh-'));
    if (!bucketName) {
      console.error('❌ バケット名を特定できませんでした:', url);
      return false;
    }

    // ファイルパスを抽出
    const filePath = extractFilePathFromUrl(url, bucketName);
    if (!filePath) {
      console.error('❌ ファイルパスを抽出できませんでした:', url);
      return false;
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('❌ ファイルの削除に失敗:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ ファイル削除中にエラー:', error);
    return false;
  }
}

/**
 * ファイルをSupabase Storageにアップロード（用途ベース）
 * Edge Function経由でCORS対応
 *
 * @param file - アップロードするファイル
 * @param kind - アップロード用途（'preview' | 'product' | 'logo' | 'avatar' | 'temp'）
 * @returns アップロードされたファイルの公開URL
 *
 * @example
 * // プレビュー画像をアップロード（gh-publicバケット）
 * const url = await uploadFile(imageFile, 'preview');
 *
 * @example
 * // 商品ファイルをアップロード（gh-downloadsバケット）
 * const url = await uploadFile(productFile, 'product');
 */
export async function uploadFile(file: File, kind: UploadKind): Promise<string> {
  try {
    const bucketName = bucketNameForKind(kind);

    // Supabase クライアントの設定確認
    if (!isSupabaseConfigured) {
      throw new Error('Supabase環境変数が設定されていません。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を確認してください。');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Edge Function経由でアップロード（CORS対応）
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucketName', bucketName);
    formData.append('filePath', filePath);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/upload-file`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    // レスポンスを一度だけテキストとして読み取る
    const responseText = await response.text();

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Edge Function error (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        throw new Error(`アップロードに失敗しました (Status: ${response.status}): ${responseText}`);
      }
      console.error('❌ Edge Function upload error:', errorData);
      throw new Error(errorData.error || `Supabase Storage エラー (bucket: ${bucketName}, kind: ${kind})`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ レスポンスのJSONパースに失敗:', {
        status: response.status,
        body: responseText,
        error: e
      });
      throw new Error('サーバーからのレスポンスが不正です');
    }

    return data.url;
  } catch (error) {
    console.error('❌ uploadFile エラー:', error);
    throw error;
  }
}

/**
 * 画像をSupabase Storageにアップロード（後方互換性のため残存）
 * @deprecated uploadFile() を使用してください
 *
 * @param file - アップロードするファイル
 * @param bucketName - バケット名（文字列）または BucketKey
 * @returns アップロードされたファイルの公開URL
 */
export async function uploadImage(file: File, bucketName: string | BucketKey = 'PUBLIC'): Promise<string | null> {
  try {
    // BucketKey の場合は bucket() で実バケット名に変換
    const actualBucket = bucketName === 'PUBLIC' || bucketName === 'DOWNLOADS' || bucketName === 'LOGOS' || bucketName === 'AVATARS' || bucketName === 'TEMP'
      ? bucket(bucketName as BucketKey)
      : bucketName;

    // Supabase クライアントの設定確認
    if (!isSupabaseConfigured) {
      throw new Error('Supabase環境変数が設定されていません。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を確認してください。');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error } = await supabase.storage
      .from(actualBucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase Storage エラー:', error);
      throw new Error(`Supabase Storage エラー: ${error.message} (bucket: ${actualBucket})`);
    }

    // 公開URLを取得
    const { data: publicData } = supabase.storage
      .from(actualBucket)
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  } catch (error) {
    console.error('❌ uploadImage エラー:', error);
    throw error;
  }
}

/**
 * ファイルを削除
 *
 * @param url - ファイルの公開URL
 * @param bucketName - バケット名（文字列）または BucketKey
 * @returns 削除成功時 true
 */
export async function deleteFile(url: string, bucketName: string | BucketKey = 'PUBLIC'): Promise<boolean> {
  try {
    // BucketKey の場合は bucket() で実バケット名に変換
    const actualBucket = bucketName === 'PUBLIC' || bucketName === 'DOWNLOADS' || bucketName === 'LOGOS' || bucketName === 'AVATARS' || bucketName === 'TEMP'
      ? bucket(bucketName as BucketKey)
      : bucketName;

    // URLからファイルパスを抽出
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
      .from(actualBucket)
      .remove([fileName]);

    if (error) {
      console.error('❌ ファイルの削除に失敗:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ ファイル削除中にエラー:', error);
    return false;
  }
}

/**
 * 画像を削除（後方互換性のため残存）
 * @deprecated deleteFile() を使用してください
 */
export async function deleteImage(url: string, bucketName: string | BucketKey = 'PUBLIC'): Promise<boolean> {
  return deleteFile(url, bucketName);
}

/**
 * 画像をリサイズしてFileオブジェクトを返す
 *
 * @param file - 元の画像ファイル
 * @param maxWidth - 最大幅（デフォルト: 512）
 * @param maxHeight - 最大高さ（デフォルト: 512）
 * @param quality - JPEG品質（0-1、デフォルト: 0.8）
 * @returns リサイズされたFileオブジェクト
 */
export async function resizeImage(
  file: File,
  maxWidth: number = 512,
  maxHeight: number = 512,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // アスペクト比を保持しながらリサイズ
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(resizedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
}

/**
 * プロフィール画像をアップロード（リサイズ付き）
 * Edge Function経由でCORS対応
 *
 * @param file - アップロードする画像ファイル
 * @param walletAddress - ユーザーのウォレットアドレス
 * @returns アップロードされた画像の公開URL
 */
export async function uploadAvatarImage(file: File, walletAddress: string): Promise<string> {
  try {
    // 画像サイズチェック（5MB以下）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('画像サイズは5MB以下にしてください');
    }

    // MIME typeチェック
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('JPG、PNG、GIF、WebP形式の画像のみアップロード可能です');
    }

    // 画像をリサイズ（512x512以内）
    const resizedFile = await resizeImage(file, 512, 512, 0.8);

    // Edge Function経由でアップロード（CORS対応）
    const formData = new FormData();
    formData.append('file', resizedFile);
    formData.append('walletAddress', walletAddress);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/upload-avatar`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: formData,
    });

    // レスポンスを一度だけテキストとして読み取る
    const responseText = await response.text();

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Edge Function error (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        throw new Error(`アップロードに失敗しました (Status: ${response.status}): ${responseText}`);
      }
      console.error('❌ Edge Function upload error:', errorData);
      throw new Error(errorData.error || 'アップロードに失敗しました');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ レスポンスのJSONパースに失敗:', {
        status: response.status,
        body: responseText,
        error: e
      });
      throw new Error('サーバーからのレスポンスが不正です');
    }

    return data.url;
  } catch (error) {
    console.error('❌ uploadAvatarImage エラー:', error);
    throw error;
  }
}

/**
 * プロフィール画像を削除
 *
 * @param walletAddress - ユーザーのウォレットアドレス
 * @returns 削除成功時 true
 */
export async function deleteAvatarImage(walletAddress: string): Promise<boolean> {
  try {
    const { data: existingFiles } = await supabase.storage
      .from('gh-avatars')
      .list(walletAddress.toLowerCase());

    if (!existingFiles || existingFiles.length === 0) {
      return true; // 削除するファイルがない場合も成功とする
    }

    const filesToDelete = existingFiles.map(f => `${walletAddress.toLowerCase()}/${f.name}`);
    const { error } = await supabase.storage
      .from('gh-avatars')
      .remove(filesToDelete);

    if (error) {
      console.error('❌ アバター削除エラー:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ deleteAvatarImage エラー:', error);
    return false;
  }
}
