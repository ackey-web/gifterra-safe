// api/super-admin/delete-user.ts
// スーパーアドミン専用: ユーザー完全削除API
// セキュリティ: スーパーアドミンのみがアクセス可能、全データを削除

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// スーパーアドミンアドレス（環境変数から取得）
const SUPER_ADMIN_ADDRESSES_ENV = process.env.VITE_SUPER_ADMIN_ADDRESSES || '';
const SUPER_ADMIN_ADDRESSES: string[] = SUPER_ADMIN_ADDRESSES_ENV
  ? SUPER_ADMIN_ADDRESSES_ENV.split(',').map((addr: string) => addr.trim().toLowerCase())
  : ['0x66f1274ad5d042b7571c2efa943370dbcd3459ab']; // デフォルト: METATRON管理者

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface DeleteUserRequest {
  walletAddress: string;
  adminAddress: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, adminAddress }: DeleteUserRequest = req.body;

    // バリデーション
    if (!walletAddress || !adminAddress) {
      return res.status(400).json({
        error: 'walletAddress と adminAddress は必須です'
      });
    }

    // スーパーアドミンチェック
    const isAdmin = SUPER_ADMIN_ADDRESSES.includes(adminAddress.toLowerCase());
    if (!isAdmin) {
      console.warn(`❌ 不正なアクセス試行: ${adminAddress}`);
      return res.status(403).json({
        error: 'アクセスが拒否されました。スーパーアドミン権限が必要です。'
      });
    }

    console.log(`🗑️ [DELETE USER] Starting deletion for: ${walletAddress}`);
    console.log(`👤 [DELETE USER] Requested by admin: ${adminAddress}`);

    const normalizedAddress = walletAddress.toLowerCase();
    const deletionLog: string[] = [];

    // 1. ユーザープロフィールを取得（削除前にデータを記録）
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', normalizedAddress)
      .single();

    if (profileError) {
      console.error('❌ ユーザープロフィール取得エラー:', profileError);
      deletionLog.push(`⚠️ ユーザープロフィールが見つかりませんでした: ${profileError.message}`);
    } else {
      deletionLog.push(`✅ ユーザー情報取得: ${userProfile.display_name || normalizedAddress}`);
    }

    // 2. ユーザーに関連する全データを削除

    // 2-1. Push通知サブスクリプション
    try {
      const { error: pushError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (pushError) {
        deletionLog.push(`⚠️ Push通知サブスクリプション削除失敗: ${pushError.message}`);
      } else {
        deletionLog.push('✅ Push通知サブスクリプションを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ Push通知サブスクリプション削除エラー: ${error}`);
    }

    // 2-2. ユーザーアクティビティ
    try {
      const { error: activityError } = await supabase
        .from('user_activities')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (activityError) {
        deletionLog.push(`⚠️ ユーザーアクティビティ削除失敗: ${activityError.message}`);
      } else {
        deletionLog.push('✅ ユーザーアクティビティを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ ユーザーアクティビティ削除エラー: ${error}`);
    }

    // 2-3. 送信したチップ履歴
    try {
      const { error: tipSentError } = await supabase
        .from('tip_history')
        .delete()
        .eq('sender_address', normalizedAddress);

      if (tipSentError) {
        deletionLog.push(`⚠️ 送信チップ履歴削除失敗: ${tipSentError.message}`);
      } else {
        deletionLog.push('✅ 送信チップ履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 送信チップ履歴削除エラー: ${error}`);
    }

    // 2-4. 受信したチップ履歴
    try {
      const { error: tipReceivedError } = await supabase
        .from('tip_history')
        .delete()
        .eq('recipient_address', normalizedAddress);

      if (tipReceivedError) {
        deletionLog.push(`⚠️ 受信チップ履歴削除失敗: ${tipReceivedError.message}`);
      } else {
        deletionLog.push('✅ 受信チップ履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 受信チップ履歴削除エラー: ${error}`);
    }

    // 2-5. 購入履歴
    try {
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (purchaseError) {
        deletionLog.push(`⚠️ 購入履歴削除失敗: ${purchaseError.message}`);
      } else {
        deletionLog.push('✅ 購入履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 購入履歴削除エラー: ${error}`);
    }

    // 2-6. レビュー
    try {
      const { error: reviewError } = await supabase
        .from('product_reviews')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (reviewError) {
        deletionLog.push(`⚠️ レビュー削除失敗: ${reviewError.message}`);
      } else {
        deletionLog.push('✅ レビューを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ レビュー削除エラー: ${error}`);
    }

    // 2-7. ユーザー統計
    try {
      const { error: statsError } = await supabase
        .from('user_stats')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (statsError) {
        deletionLog.push(`⚠️ ユーザー統計削除失敗: ${statsError.message}`);
      } else {
        deletionLog.push('✅ ユーザー統計を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ ユーザー統計削除エラー: ${error}`);
    }

    // 2-8. セッション情報
    try {
      const { error: sessionError } = await supabase
        .from('user_sessions')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (sessionError) {
        deletionLog.push(`⚠️ セッション情報削除失敗: ${sessionError.message}`);
      } else {
        deletionLog.push('✅ セッション情報を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ セッション情報削除エラー: ${error}`);
    }

    // 2-9. ストレージファイル（アバター、その他アップロード）
    if (userProfile?.avatar_url || userProfile?.icon_url) {
      try {
        const avatarUrl = userProfile.avatar_url || userProfile.icon_url;
        const url = new URL(avatarUrl);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];

        const { error: storageError } = await supabase.storage
          .from('public')
          .remove([fileName]);

        if (storageError) {
          deletionLog.push(`⚠️ アバター画像削除失敗: ${storageError.message}`);
        } else {
          deletionLog.push('✅ アバター画像を削除');
        }
      } catch (error) {
        deletionLog.push(`⚠️ アバター画像削除をスキップ: ${error}`);
      }
    }

    // 3. 最後にユーザープロフィールを削除
    const { error: deleteProfileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', normalizedAddress);

    if (deleteProfileError) {
      console.error('❌ ユーザープロフィール削除エラー:', deleteProfileError);
      deletionLog.push(`❌ ユーザープロフィール削除失敗: ${deleteProfileError.message}`);
      return res.status(500).json({
        error: 'ユーザープロフィールの削除に失敗しました',
        details: deleteProfileError.message,
        log: deletionLog
      });
    }

    deletionLog.push('✅ ユーザープロフィールを削除');

    console.log('✅ [DELETE USER] User deletion completed:', normalizedAddress);
    console.log('📋 [DELETE USER] Deletion log:', deletionLog);

    return res.json({
      success: true,
      message: `ユーザー ${userProfile?.display_name || normalizedAddress} を完全に削除しました`,
      walletAddress: normalizedAddress,
      deletionLog
    });

  } catch (error) {
    console.error('❌ [DELETE USER] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー',
      details: '予期しないエラーが発生しました'
    });
  }
}
