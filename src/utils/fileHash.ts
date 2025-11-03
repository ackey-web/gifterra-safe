// src/utils/fileHash.ts
// ファイルのハッシュ値を計算するユーティリティ

/**
 * ファイルのSHA-256ハッシュ値を計算
 * @param file - ハッシュ化するファイル
 * @returns ハッシュ値（16進数文字列）
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * ファイルの簡易識別情報を取得（名前、サイズ、最終更新日）
 * @param file - ファイル
 * @returns 識別情報オブジェクト
 */
export function getFileIdentity(file: File): { name: string; size: number; lastModified: number } {
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified
  };
}

/**
 * 2つのファイルが同一かどうかを簡易チェック（サイズと名前で判定）
 * @param file1 - ファイル1
 * @param file2 - ファイル2
 * @returns 同一と思われる場合 true
 */
export function isSameFileQuick(file1: File, file2: File): boolean {
  return file1.name === file2.name &&
         file1.size === file2.size &&
         file1.lastModified === file2.lastModified;
}
