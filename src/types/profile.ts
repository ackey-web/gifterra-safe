// src/types/profile.ts
// プロフィール拡張項目の型定義

/**
 * ユーザーロール（複数選択可）
 */
export type UserRole =
  | 'CREATOR'
  | 'SHOP'
  | 'EVENT'
  | 'COMMUNITY'
  | 'ARTIST'
  | 'PROJECT_OWNER'
  | 'METAVERSE'
  | 'DEVELOPER'
  | 'FAN';

/**
 * ロール表示名マッピング
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  CREATOR: 'クリエイター',
  SHOP: '店舗',
  EVENT: 'イベント主催',
  COMMUNITY: 'コミュニティ',
  ARTIST: 'アーティスト',
  PROJECT_OWNER: 'プロジェクトオーナー',
  METAVERSE: 'メタバーススペース',
  DEVELOPER: '開発者',
  FAN: 'ファン',
};

/**
 * カスタムリンク
 */
export interface CustomLink {
  label: string; // 例: X, Instagram, YouTube, Other
  url: string;   // https://...
}

/**
 * 拡張プロフィール情報
 */
export interface ExtendedProfile {
  // 既存フィールド
  display_name: string;
  bio: string;
  avatar_url?: string;
  receive_message?: string;

  // 新規フィールド
  website_url?: string;           // Webサイト/プロフィールリンク
  custom_links?: CustomLink[];    // 追加リンク（最大3件）
  roles?: UserRole[];             // ロール（複数選択可）
  location?: string;              // 所在地（20文字以内）
  cover_image_url?: string;       // カバー画像
  reject_anonymous_transfers?: boolean; // 匿名送金拒否設定
  twitter_id?: string;            // X (Twitter) アカウントID (@なし、例: "gifterra_app")
}

/**
 * Supabase user_profiles テーブルの型
 */
export interface UserProfileData extends ExtendedProfile {
  tenant_id: string;
  wallet_address: string;
  created_at: string;
  updated_at: string;
}
