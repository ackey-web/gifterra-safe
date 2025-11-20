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

    // 2-9. ダウンロードトークン
    try {
      const { error: downloadTokenError } = await supabase
        .from('download_tokens')
        .delete()
        .eq('buyer', normalizedAddress);

      if (downloadTokenError) {
        deletionLog.push(`⚠️ ダウンロードトークン削除失敗: ${downloadTokenError.message}`);
      } else {
        deletionLog.push('✅ ダウンロードトークンを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ ダウンロードトークン削除エラー: ${error}`);
    }

    // 2-10. 送信した送金メッセージ
    try {
      const { error: transferSentError } = await supabase
        .from('transfer_messages')
        .delete()
        .eq('from_address', normalizedAddress);

      if (transferSentError) {
        deletionLog.push(`⚠️ 送信送金メッセージ削除失敗: ${transferSentError.message}`);
      } else {
        deletionLog.push('✅ 送信送金メッセージを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 送信送金メッセージ削除エラー: ${error}`);
    }

    // 2-11. 受信した送金メッセージ
    try {
      const { error: transferReceivedError } = await supabase
        .from('transfer_messages')
        .delete()
        .eq('to_address', normalizedAddress);

      if (transferReceivedError) {
        deletionLog.push(`⚠️ 受信送金メッセージ削除失敗: ${transferReceivedError.message}`);
      } else {
        deletionLog.push('✅ 受信送金メッセージを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 受信送金メッセージ削除エラー: ${error}`);
    }

    // 2-12. 通知
    try {
      const { error: notificationError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_address', normalizedAddress);

      if (notificationError) {
        deletionLog.push(`⚠️ 通知削除失敗: ${notificationError.message}`);
      } else {
        deletionLog.push('✅ 通知を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 通知削除エラー: ${error}`);
    }

    // 2-13. 通知設定
    try {
      const { error: notificationSettingsError } = await supabase
        .from('user_notification_settings')
        .delete()
        .eq('user_address', normalizedAddress);

      if (notificationSettingsError) {
        deletionLog.push(`⚠️ 通知設定削除失敗: ${notificationSettingsError.message}`);
      } else {
        deletionLog.push('✅ 通知設定を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 通知設定削除エラー: ${error}`);
    }

    // 2-14. ユーザースコア
    try {
      const { error: scoreError } = await supabase
        .from('user_scores')
        .delete()
        .eq('address', normalizedAddress);

      if (scoreError) {
        deletionLog.push(`⚠️ ユーザースコア削除失敗: ${scoreError.message}`);
      } else {
        deletionLog.push('✅ ユーザースコアを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ ユーザースコア削除エラー: ${error}`);
    }

    // 2-15. スコアトランザクション
    try {
      const { error: scoreTxError } = await supabase
        .from('score_transactions')
        .delete()
        .eq('user_address', normalizedAddress);

      if (scoreTxError) {
        deletionLog.push(`⚠️ スコアトランザクション削除失敗: ${scoreTxError.message}`);
      } else {
        deletionLog.push('✅ スコアトランザクションを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ スコアトランザクション削除エラー: ${error}`);
    }

    // 2-16. テナント別スコア
    try {
      const { error: tenantScoreError } = await supabase
        .from('tenant_scores')
        .delete()
        .eq('user_address', normalizedAddress);

      if (tenantScoreError) {
        deletionLog.push(`⚠️ テナント別スコア削除失敗: ${tenantScoreError.message}`);
      } else {
        deletionLog.push('✅ テナント別スコアを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ テナント別スコア削除エラー: ${error}`);
    }

    // 2-17. ユーザー保有NFT（まずstamp_check_insを削除する必要がある）
    try {
      // 先にuser_flag_nftsのIDを取得
      const { data: userFlagNfts } = await supabase
        .from('user_flag_nfts')
        .select('id')
        .eq('user_id', normalizedAddress);

      if (userFlagNfts && userFlagNfts.length > 0) {
        const userFlagNftIds = userFlagNfts.map(nft => nft.id);

        // スタンプチェックインを削除
        const { error: checkInError } = await supabase
          .from('stamp_check_ins')
          .delete()
          .in('user_flag_nft_id', userFlagNftIds);

        if (checkInError) {
          deletionLog.push(`⚠️ スタンプチェックイン削除失敗: ${checkInError.message}`);
        } else {
          deletionLog.push('✅ スタンプチェックインを削除');
        }
      }

      // ユーザー保有NFTを削除
      const { error: flagNftError } = await supabase
        .from('user_flag_nfts')
        .delete()
        .eq('user_id', normalizedAddress);

      if (flagNftError) {
        deletionLog.push(`⚠️ ユーザー保有NFT削除失敗: ${flagNftError.message}`);
      } else {
        deletionLog.push('✅ ユーザー保有NFTを削除');
      }
    } catch (error) {
      deletionLog.push(`❌ ユーザー保有NFT削除エラー: ${error}`);
    }

    // 2-18. アカウント凍結履歴
    try {
      const { error: freezeError } = await supabase
        .from('account_freezes')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (freezeError) {
        deletionLog.push(`⚠️ アカウント凍結履歴削除失敗: ${freezeError.message}`);
      } else {
        deletionLog.push('✅ アカウント凍結履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ アカウント凍結履歴削除エラー: ${error}`);
    }

    // 2-19. トランザクション履歴（送信）
    try {
      const { error: txSentError } = await supabase
        .from('transaction_history')
        .delete()
        .eq('from_address', normalizedAddress);

      if (txSentError) {
        deletionLog.push(`⚠️ 送信トランザクション履歴削除失敗: ${txSentError.message}`);
      } else {
        deletionLog.push('✅ 送信トランザクション履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 送信トランザクション履歴削除エラー: ${error}`);
    }

    // 2-20. トランザクション履歴（受信）
    try {
      const { error: txReceivedError } = await supabase
        .from('transaction_history')
        .delete()
        .eq('to_address', normalizedAddress);

      if (txReceivedError) {
        deletionLog.push(`⚠️ 受信トランザクション履歴削除失敗: ${txReceivedError.message}`);
      } else {
        deletionLog.push('✅ 受信トランザクション履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 受信トランザクション履歴削除エラー: ${error}`);
    }

    // 2-21. ログイン履歴
    try {
      const { error: loginError } = await supabase
        .from('user_login_history')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (loginError) {
        deletionLog.push(`⚠️ ログイン履歴削除失敗: ${loginError.message}`);
      } else {
        deletionLog.push('✅ ログイン履歴を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ ログイン履歴削除エラー: ${error}`);
    }

    // 2-22. 支払いリクエスト（作成者として）
    try {
      const { error: paymentReqTenantError } = await supabase
        .from('payment_requests')
        .delete()
        .eq('tenant_address', normalizedAddress);

      if (paymentReqTenantError) {
        deletionLog.push(`⚠️ 支払いリクエスト（作成者）削除失敗: ${paymentReqTenantError.message}`);
      } else {
        deletionLog.push('✅ 支払いリクエスト（作成者）を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 支払いリクエスト（作成者）削除エラー: ${error}`);
    }

    // 2-23. 支払いリクエスト（支払い者として）
    try {
      const { error: paymentReqCompletedError } = await supabase
        .from('payment_requests')
        .delete()
        .eq('completed_by', normalizedAddress);

      if (paymentReqCompletedError) {
        deletionLog.push(`⚠️ 支払いリクエスト（支払い者）削除失敗: ${paymentReqCompletedError.message}`);
      } else {
        deletionLog.push('✅ 支払いリクエスト（支払い者）を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ 支払いリクエスト（支払い者）削除エラー: ${error}`);
    }

    // 2-24. テナント申請
    try {
      const { error: tenantAppError } = await supabase
        .from('tenant_applications')
        .delete()
        .eq('applicant_address', normalizedAddress);

      if (tenantAppError) {
        deletionLog.push(`⚠️ テナント申請削除失敗: ${tenantAppError.message}`);
      } else {
        deletionLog.push('✅ テナント申請を削除');
      }
    } catch (error) {
      deletionLog.push(`❌ テナント申請削除エラー: ${error}`);
    }

    // 2-25. ストレージファイル（アバター画像）
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

    // 2-26. ストレージファイル（カバー画像）
    if (userProfile?.cover_image_url) {
      try {
        const coverUrl = userProfile.cover_image_url;
        const url = new URL(coverUrl);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];

        const { error: storageError } = await supabase.storage
          .from('public')
          .remove([fileName]);

        if (storageError) {
          deletionLog.push(`⚠️ カバー画像削除失敗: ${storageError.message}`);
        } else {
          deletionLog.push('✅ カバー画像を削除');
        }
      } catch (error) {
        deletionLog.push(`⚠️ カバー画像削除をスキップ: ${error}`);
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
