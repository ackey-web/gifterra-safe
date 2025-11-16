// src/utils/accountDeletion.ts
// アカウント退会・匿名化処理

import { supabase } from '../lib/supabase';

/**
 * アカウントを即時匿名化する
 * 個人情報を削除し、統計用の最小限のデータのみ残す
 */
export async function anonymizeAccount(walletAddress: string): Promise<{ success: boolean; error?: string }> {
  try {
    const lowerAddress = walletAddress.toLowerCase();

    // 1. user_profilesの個人情報を匿名化
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        display_name: '退会済みユーザー',
        bio: '',
        avatar_url: null,
        cover_image_url: null,
        website_url: null,
        custom_links: null,
        location: null,
        receive_message: 'ありがとうございました。',
        roles: null,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        show_wallet_address: false,
      })
      .eq('tenant_id', 'default')
      .eq('wallet_address', lowerAddress);

    if (profileError) {
      console.error('Failed to anonymize profile:', profileError);
      return { success: false, error: 'プロフィールの匿名化に失敗しました' };
    }

    // 2. 通知設定を削除
    const { error: notificationError } = await supabase
      .from('notification_settings')
      .delete()
      .eq('tenant_id', 'default')
      .eq('wallet_address', lowerAddress);

    if (notificationError) {
      console.warn('Failed to delete notification settings:', notificationError);
      // 通知設定の削除失敗は致命的ではないので続行
    }

    // 3. フォロー関係は保持（統計用）
    // user_followsテーブルはそのまま残す
    // UIでは退会済みユーザーとして表示

    // 4. ログイン履歴を削除（オプション）
    const { error: loginHistoryError } = await supabase
      .from('user_login_history')
      .delete()
      .eq('tenant_id', 'default')
      .eq('wallet_address', lowerAddress);

    if (loginHistoryError) {
      console.warn('Failed to delete login history:', loginHistoryError);
      // ログイン履歴の削除失敗は致命的ではないので続行
    }

    return { success: true };
  } catch (err) {
    console.error('Error during account anonymization:', err);
    return { success: false, error: '予期しないエラーが発生しました' };
  }
}

/**
 * 退会前の確認用データを取得
 */
export async function getAccountDeletionSummary(walletAddress: string) {
  try {
    const lowerAddress = walletAddress.toLowerCase();

    // フォロワー数を取得
    const { count: followerCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', 'default')
      .eq('following_address', lowerAddress);

    // フォロー中の数を取得
    const { count: followingCount } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', 'default')
      .eq('follower_address', lowerAddress);

    // プロフィール情報を取得
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, created_at')
      .eq('tenant_id', 'default')
      .eq('wallet_address', lowerAddress)
      .maybeSingle();

    return {
      displayName: profile?.display_name || 'Unknown',
      createdAt: profile?.created_at,
      followerCount: followerCount || 0,
      followingCount: followingCount || 0,
    };
  } catch (err) {
    console.error('Error fetching account summary:', err);
    return null;
  }
}
