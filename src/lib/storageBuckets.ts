// src/lib/storageBuckets.ts
// Supabase Storage バケット名の一元管理
// 目的: 実バケット名をハードコードから排除し、用途ベースで固定マッピング

/**
 * 実際のSupabase Storageバケット名（Supabaseダッシュボードで確認済み）
 * - gh-public    (public)   … プレビュー画像・一般公開OKの静的アセット
 * - gh-downloads (private)  … 購入後DL用の本体（GLB/ZIP/大容量）。必ず署名URL経由
 * - gh-logos     (public)   … テナント/プロジェクトのロゴ
 * - gh-avatars   (public)   … ユーザーやクリエイターのアバター
 * - gh-temp      (private)  … 一時置き場（AI変換や一時生成物など）
 */
export const STORAGE_BUCKETS = {
  PUBLIC: 'gh-public',
  DOWNLOADS: 'gh-downloads',
  LOGOS: 'gh-logos',
  AVATARS: 'gh-avatars',
  TEMP: 'gh-temp',
} as const;

export type BucketKey = keyof typeof STORAGE_BUCKETS;

/**
 * バケット名を取得するヘルパー関数
 * @param key - バケットキー
 * @returns 実際のバケット名
 */
export const bucket = (key: BucketKey): string => STORAGE_BUCKETS[key];

/**
 * 公開バケットかどうかを判定
 * @param key - バケットキー
 * @returns 公開バケットの場合 true
 */
export const isPublicBucket = (key: BucketKey): boolean => {
  return key === 'PUBLIC' || key === 'LOGOS' || key === 'AVATARS';
};

/**
 * 非公開バケット（署名URLが必要）かどうかを判定
 * @param key - バケットキー
 * @returns 非公開バケットの場合 true
 */
export const isPrivateBucket = (key: BucketKey): boolean => {
  return key === 'DOWNLOADS' || key === 'TEMP';
};

/**
 * マルチテナント用のオブジェクトパス構築
 * パス規約: /{tenantId}/{machineId?}/{logicalId}/{filename}
 *
 * @example
 * buildObjectPath({
 *   tenantId: 'tenant-001',
 *   logicalId: 'product-123',
 *   filename: 'avatar.glb'
 * })
 * // => "tenant-001/product-123/avatar.glb"
 *
 * @example
 * buildObjectPath({
 *   tenantId: 'tenant-001',
 *   machineId: 'machine-A',
 *   logicalId: 'product-123',
 *   filename: 'avatar.glb'
 * })
 * // => "tenant-001/machine-A/product-123/avatar.glb"
 */
export function buildObjectPath(opts: {
  tenantId: string;
  machineId?: string;
  logicalId: string;
  filename: string;
}): string {
  const parts = [opts.tenantId];
  if (opts.machineId) {
    parts.push(opts.machineId);
  }
  parts.push(opts.logicalId, opts.filename);
  return parts.join('/');
}

/**
 * アップロード用途の種類
 */
export type UploadKind = 'preview' | 'product' | 'logo' | 'avatar' | 'temp';

/**
 * 用途に応じたバケットキーを自動振り分け
 *
 * @param kind - アップロード用途
 * @returns 対応するバケットキー
 *
 * @example
 * bucketForKind('preview')  // => 'PUBLIC'
 * bucketForKind('product')  // => 'DOWNLOADS'
 * bucketForKind('logo')     // => 'LOGOS'
 */
export function bucketForKind(kind: UploadKind): BucketKey {
  switch (kind) {
    case 'preview':
      return 'PUBLIC';
    case 'product':
      return 'DOWNLOADS';
    case 'logo':
      return 'LOGOS';
    case 'avatar':
      return 'AVATARS';
    case 'temp':
      return 'TEMP';
  }
}

/**
 * 用途に応じた実際のバケット名を取得
 *
 * @param kind - アップロード用途
 * @returns 実際のバケット名
 *
 * @example
 * bucketNameForKind('preview')  // => 'gh-public'
 * bucketNameForKind('product')  // => 'gh-downloads'
 */
export function bucketNameForKind(kind: UploadKind): string {
  return bucket(bucketForKind(kind));
}

/**
 * バケット名から公開/非公開を判定
 *
 * @param bucketName - 実際のバケット名
 * @returns 公開バケットの場合 true
 */
export function isBucketPublic(bucketName: string): boolean {
  const key = Object.entries(STORAGE_BUCKETS).find(
    ([, value]) => value === bucketName
  )?.[0] as BucketKey | undefined;

  return key ? isPublicBucket(key) : false;
}

/**
 * 全バケット名のリストを取得（デバッグ/診断用）
 */
export function getAllBucketNames(): string[] {
  return Object.values(STORAGE_BUCKETS);
}
