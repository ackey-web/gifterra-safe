// api/delete/index.ts
// 削除API（商品削除、コンテンツ削除、ユーザー削除を統合）
// セキュリティ: サーバーサイドでSERVICE_ROLE_KEYを使用して安全に削除

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket } from '../../src/lib/storageBuckets.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// スーパーアドミンアドレス（環境変数から取得）
// Note: Vercelではbackend用にSUPER_ADMIN_ADDRESSESを設定してください
const SUPER_ADMIN_ADDRESSES_ENV = process.env.SUPER_ADMIN_ADDRESSES || process.env.VITE_SUPER_ADMIN_ADDRESSES || '';
const SUPER_ADMIN_ADDRESSES: string[] = SUPER_ADMIN_ADDRESSES_ENV
  ? SUPER_ADMIN_ADDRESSES_ENV.split(',').map((addr: string) => addr.trim().toLowerCase())
  : ['0x66f1274ad5d042b7571c2efa943370dbcd3459ab']; // デフォルト: METATRON管理者

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface DeleteRequest {
  type: 'product' | 'content' | 'user';
  productId?: string;
  filePath?: string;
  walletAddress?: string;
  adminAddress?: string;
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
    // 初回リクエストでスーパーアドミン設定をログ出力
    console.log('🔐 [DELETE API] Super admin configuration:', {
      configuredAddresses: SUPER_ADMIN_ADDRESSES,
      envValue: SUPER_ADMIN_ADDRESSES_ENV,
      hasEnvVar: !!SUPER_ADMIN_ADDRESSES_ENV
    });

    const { type, productId, filePath, walletAddress, adminAddress }: DeleteRequest = req.body;

    console.log('🔍 [DELETE API] Request received:', {
      type,
      walletAddress,
      adminAddress,
      hasWalletAddress: !!walletAddress,
      hasAdminAddress: !!adminAddress,
      bodyKeys: Object.keys(req.body),
      fullBody: req.body
    });

    // ユーザー削除（スーパーアドミン専用）
    if (type === 'user') {
      if (!walletAddress || !adminAddress) {
        console.error('❌ [DELETE API] Missing required fields:', {
          walletAddress: !!walletAddress,
          adminAddress: !!adminAddress
        });
        return res.status(400).json({
          error: 'walletAddress と adminAddress は必須です',
          received: { walletAddress, adminAddress }
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

      // ユーザープロフィールを取得
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', normalizedAddress)
        .single();

      if (userProfile) {
        deletionLog.push(`✅ ユーザー情報取得: ${userProfile.display_name || normalizedAddress}`);
      }

      // 全テーブルからユーザーデータを削除
      const tables = [
        { table: 'push_subscriptions', column: 'wallet_address' },
        { table: 'user_activities', column: 'wallet_address' },
        { table: 'tip_history', column: 'sender_address' },
        { table: 'tip_history', column: 'recipient_address' },
        { table: 'purchases', column: 'wallet_address' },
        { table: 'product_reviews', column: 'wallet_address' },
        { table: 'user_stats', column: 'wallet_address' },
        { table: 'user_sessions', column: 'wallet_address' },
        { table: 'download_tokens', column: 'buyer' },
        { table: 'transfer_messages', column: 'from_address' },
        { table: 'transfer_messages', column: 'to_address' },
        { table: 'notifications', column: 'user_address' },
        { table: 'user_notification_settings', column: 'user_address' },
        { table: 'user_scores', column: 'address' },
        { table: 'score_transactions', column: 'user_address' },
        { table: 'tenant_scores', column: 'user_address' },
        { table: 'account_freezes', column: 'wallet_address' },
        { table: 'transaction_history', column: 'from_address' },
        { table: 'transaction_history', column: 'to_address' },
        { table: 'user_login_history', column: 'wallet_address' },
        { table: 'payment_requests', column: 'tenant_address' },
        { table: 'payment_requests', column: 'completed_by' },
        { table: 'tenant_applications', column: 'applicant_address' },
      ];

      for (const { table, column } of tables) {
        try {
          await supabase.from(table).delete().eq(column, normalizedAddress);
          deletionLog.push(`✅ ${table}.${column} を削除`);
        } catch (error) {
          deletionLog.push(`⚠️ ${table}.${column} 削除エラー`);
        }
      }

      // NFT関連（外部キー制約を考慮）
      try {
        const { data: userFlagNfts } = await supabase
          .from('user_flag_nfts')
          .select('id')
          .eq('user_id', normalizedAddress);

        if (userFlagNfts && userFlagNfts.length > 0) {
          const userFlagNftIds = userFlagNfts.map(nft => nft.id);
          await supabase.from('stamp_check_ins').delete().in('user_flag_nft_id', userFlagNftIds);
          deletionLog.push('✅ スタンプチェックインを削除');
        }

        await supabase.from('user_flag_nfts').delete().eq('user_id', normalizedAddress);
        deletionLog.push('✅ ユーザー保有NFTを削除');
      } catch (error) {
        deletionLog.push('⚠️ NFT関連削除エラー');
      }

      // ストレージ削除（アバター・カバー画像）
      if (userProfile?.avatar_url || userProfile?.icon_url) {
        try {
          const avatarUrl = userProfile.avatar_url || userProfile.icon_url;
          const url = new URL(avatarUrl);
          const fileName = url.pathname.split('/').pop();
          await supabase.storage.from('public').remove([fileName!]);
          deletionLog.push('✅ アバター画像を削除');
        } catch { deletionLog.push('⚠️ アバター画像削除をスキップ'); }
      }

      if (userProfile?.cover_image_url) {
        try {
          const url = new URL(userProfile.cover_image_url);
          const fileName = url.pathname.split('/').pop();
          await supabase.storage.from('public').remove([fileName!]);
          deletionLog.push('✅ カバー画像を削除');
        } catch { deletionLog.push('⚠️ カバー画像削除をスキップ'); }
      }

      // 最後にユーザープロフィールを削除
      const { error: deleteProfileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('wallet_address', normalizedAddress);

      if (deleteProfileError) {
        return res.status(500).json({
          error: 'ユーザープロフィールの削除に失敗しました',
          details: deleteProfileError.message,
          log: deletionLog
        });
      }

      deletionLog.push('✅ ユーザープロフィールを削除');
      console.log('✅ [DELETE USER] User deletion completed:', normalizedAddress);

      return res.json({
        success: true,
        message: `ユーザー ${userProfile?.display_name || normalizedAddress} を完全に削除しました`,
        walletAddress: normalizedAddress,
        deletionLog
      });
    }

    // 商品削除
    if (type === 'product') {
      if (!productId) {
        return res.status(400).json({ error: 'productId は必須です' });
      }

      // まず商品データを取得
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('image_url, content_path, name')
        .eq('id', productId)
        .single();

      if (fetchError) {
        console.error('❌ [API] 商品取得エラー:', fetchError);
        return res.status(404).json({
          error: '商品が見つかりません',
          details: fetchError.message
        });
      }

      const deletionResults: string[] = [];

      // サムネイル画像を削除
      if (product?.image_url) {
        try {
          const url = new URL(product.image_url);
          const pathParts = url.pathname.split('/');
          const fileName = pathParts[pathParts.length - 1];

          const { error: imgError } = await supabase.storage
            .from(bucket('PUBLIC'))
            .remove([fileName]);

          if (imgError) {
            deletionResults.push('サムネイル画像の削除に失敗しました');
          } else {
            deletionResults.push('サムネイル画像を削除しました');
          }
        } catch {
          deletionResults.push('サムネイル画像の削除をスキップしました');
        }
      }

      // 配布ファイルを削除
      if (product?.content_path) {
        try {
          const { error: contentError } = await supabase.storage
            .from(bucket('DOWNLOADS'))
            .remove([product.content_path]);

          if (contentError) {
            deletionResults.push('配布ファイルの削除に失敗しました');
          } else {
            deletionResults.push('配布ファイルを削除しました');
          }
        } catch {
          deletionResults.push('配布ファイルの削除をスキップしました');
        }
      }

      // データベースから商品を削除
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        return res.status(500).json({
          error: '商品の削除に失敗しました',
          details: deleteError.message
        });
      }

      return res.json({
        success: true,
        message: '商品とファイルを削除しました',
        deletionResults
      });
    }

    // コンテンツ削除
    if (type === 'content') {
      if (!filePath) {
        return res.status(400).json({ error: 'filePath は必須です' });
      }

      const { data, error } = await supabase.storage
        .from(bucket('DOWNLOADS'))
        .remove([filePath]);

      if (error) {
        return res.status(500).json({
          error: 'ファイルの削除に失敗しました',
          details: error.message
        });
      }

      return res.json({
        success: true,
        deleted: data,
        message: 'ファイルを削除しました'
      });
    }

    return res.status(400).json({ error: 'type は product, content, または user を指定してください' });

  } catch (error) {
    console.error('❌ [API] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
