// src/hooks/useTransferMessages.ts
// 送金メッセージ機能のカスタムフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface MessageReaction {
  id: string;
  message_id: string;
  reactor_address: string;
  reaction_type: string;
  created_at: string;
}

export interface TransferMessage {
  id: string;
  tenant_id: string;
  from_address: string;
  to_address: string;
  token_symbol: string;
  amount: string;
  message?: string;
  sender_profile?: {
    name?: string;
    bio?: string;
    icon_url?: string;
  };
  recipient_profile?: {
    name?: string;
    bio?: string;
    icon_url?: string;
  };
  tx_hash?: string;
  created_at: string;
  expires_at: string;
  is_read: boolean;
  is_archived: boolean;
  reactions?: MessageReaction[];
  reaction_count?: number;
  has_reacted?: boolean;
}

/**
 * 送金メッセージを保存（リトライ機能付き）
 */
export async function saveTransferMessage(params: {
  tenantId: string;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  amount: string;
  message?: string;
  txHash?: string;
}) {
  const { tenantId, fromAddress, toAddress, tokenSymbol, amount, message, txHash } = params;

  // テナントIDがない場合はデフォルト値を使用
  const effectiveTenantId = tenantId || 'default';

  // リトライロジック（最大3回）
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 送信者のプロフィール情報を取得
      let profileData = null;

      // テナントIDが指定されている場合は、そのテナントのプロフィールを優先
      if (effectiveTenantId !== 'default') {
        const { data } = await supabase
          .from('user_profiles')
          .select('display_name, name, bio, avatar_url, icon_url')
          .eq('wallet_address', fromAddress.toLowerCase())
          .eq('tenant_id', effectiveTenantId)
          .maybeSingle();
        profileData = data;
      }

      // テナント固有のプロフィールがない場合は、defaultテナントで検索
      if (!profileData) {
        const { data } = await supabase
          .from('user_profiles')
          .select('display_name, name, bio, avatar_url, icon_url')
          .eq('wallet_address', fromAddress.toLowerCase())
          .eq('tenant_id', 'default')
          .maybeSingle();
        profileData = data;
      }

      // それでも見つからない場合は、tenant_idを問わず最新のプロフィールを取得
      if (!profileData) {
        const { data } = await supabase
          .from('user_profiles')
          .select('display_name, name, bio, avatar_url, icon_url')
          .eq('wallet_address', fromAddress.toLowerCase())
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        profileData = data;
      }

      // display_name と avatar_url を優先し、なければ古いカラム名にフォールバック
      const senderProfile = profileData ? {
        name: profileData.display_name || profileData.name || null,
        bio: profileData.bio || null,
        icon_url: profileData.avatar_url || profileData.icon_url || null,
      } : null;

      // transfer_messagesテーブルに保存
      const insertData = {
        tenant_id: effectiveTenantId,
        from_address: fromAddress.toLowerCase(),
        to_address: toAddress.toLowerCase(),
        token_symbol: tokenSymbol,
        amount,
        message: message || null,
        sender_profile: senderProfile || null,
        tx_hash: txHash || null,
      };

      const { data, error } = await supabase
        .from('transfer_messages')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 成功したらデータを返す
      console.log(`✅ Transfer message saved successfully (attempt ${attempt}/${MAX_RETRIES})`);
      return data;

    } catch (error: any) {
      lastError = error;
      console.error(`❌ Failed to save transfer message (attempt ${attempt}/${MAX_RETRIES}):`, error);

      // 最後のリトライでない場合は、指数バックオフで待機
      if (attempt < MAX_RETRIES) {
        const waitTime = Math.pow(2, attempt - 1) * 1000; // 1秒, 2秒, 4秒
        console.log(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // すべてのリトライが失敗した場合はエラーを投げる
  throw new Error(
    `送金メッセージの保存に${MAX_RETRIES}回失敗しました: ${lastError?.message || '不明なエラー'}`
  );
}

/**
 * 受信した送金メッセージを取得
 */
export function useReceivedTransferMessages(
  tenantId: string | undefined,
  walletAddress: string | undefined
) {
  const [messages, setMessages] = useState<TransferMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // テナントIDがない場合はデフォルト値を使用
    const effectiveTenantId = tenantId || 'default';

    if (!walletAddress) {
      setMessages([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // テナントIDが'default'の場合は'default'のみ検索
        // テナントIDが指定されている場合は、そのIDと'default'の両方を検索
        const tenantIdsToSearch = effectiveTenantId === 'default'
          ? ['default']
          : [effectiveTenantId, 'default'];

        const { data, error: fetchError } = await supabase
          .from('transfer_messages')
          .select('*')
          .in('tenant_id', tenantIdsToSearch)
          .eq('to_address', walletAddress.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(50);

        if (fetchError) {
          throw fetchError;
        }

        // N+1問題を解決: 全アドレスを一度に取得
        const uniqueAddresses = [...new Set((data || []).map(m => m.from_address.toLowerCase()))];

        // バッチでプロフィール情報を取得
        const profilesByAddress = new Map<string, any>();

        for (const address of uniqueAddresses) {
          try {
            // テナント固有のプロフィールを優先取得
            let profileData = null;

            if (effectiveTenantId !== 'default') {
              const { data: tenantProfile } = await supabase
                .from('user_profiles')
                .select('display_name, name, bio, avatar_url, icon_url')
                .eq('wallet_address', address)
                .eq('tenant_id', effectiveTenantId)
                .maybeSingle();
              profileData = tenantProfile;
            }

            // defaultテナントで検索
            if (!profileData) {
              const { data: defaultProfile } = await supabase
                .from('user_profiles')
                .select('display_name, name, bio, avatar_url, icon_url')
                .eq('wallet_address', address)
                .eq('tenant_id', 'default')
                .maybeSingle();
              profileData = defaultProfile;
            }

            // 最終フォールバック: tenant_idを問わず検索
            if (!profileData) {
              const { data: anyProfile } = await supabase
                .from('user_profiles')
                .select('display_name, name, bio, avatar_url, icon_url')
                .eq('wallet_address', address)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              profileData = anyProfile;
            }

            if (profileData) {
              profilesByAddress.set(address, {
                name: profileData.display_name || profileData.name || null,
                bio: profileData.bio || null,
                icon_url: profileData.avatar_url || profileData.icon_url || null,
              });
            }
          } catch (profileError) {
            console.error(`⚠️ Failed to fetch profile for ${address}:`, profileError);
            // エラーは無視して続行
          }
        }

        // メッセージにプロフィールをマージ
        const messagesWithProfiles = (data || []).map(message => {
          const profile = profilesByAddress.get(message.from_address.toLowerCase());
          return profile ? { ...message, sender_profile: profile } : message;
        });

        setMessages(messagesWithProfiles);
        setUnreadCount(messagesWithProfiles.filter((m: TransferMessage) => !m.is_read).length);
        setRetryCount(0); // 成功したらリトライカウントをリセット
      } catch (err) {
        console.error('❌ Failed to fetch received transfer messages:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // リアルタイム更新をサブスクライブ（再接続ロジック付き）
    const channel = supabase
      .channel('transfer_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfer_messages',
          filter: `to_address=eq.${walletAddress.toLowerCase()}`,
        },
        () => {
          console.log('📨 Received transfer message update (real-time)');
          fetchMessages();
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);

        // 接続エラー時は再接続を試みる
        if (status === 'CHANNEL_ERROR' && retryCount < 3) {
          console.warn(`⚠️ Realtime connection error, retrying... (attempt ${retryCount + 1})`);
          setRetryCount(prev => prev + 1);

          // 指数バックオフで再接続
          setTimeout(() => {
            supabase.removeChannel(channel);
            fetchMessages();
          }, Math.pow(2, retryCount) * 1000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, walletAddress, retryCount]);

  return { messages, isLoading, error, unreadCount };
}

/**
 * 送信した送金メッセージを取得
 */
export function useSentTransferMessages(
  tenantId: string | undefined,
  walletAddress: string | undefined
) {
  const [messages, setMessages] = useState<TransferMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // テナントIDがない場合はデフォルト値を使用
    const effectiveTenantId = tenantId || 'default';

    if (!walletAddress) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // テナントIDが'default'の場合は'default'のみ検索
        // テナントIDが指定されている場合は、そのIDと'default'の両方を検索
        const tenantIdsToSearch = effectiveTenantId === 'default'
          ? ['default']
          : [effectiveTenantId, 'default'];

        const { data, error: fetchError } = await supabase
          .from('transfer_messages')
          .select('*')
          .in('tenant_id', tenantIdsToSearch)
          .eq('from_address', walletAddress.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(50);

        if (fetchError) {
          throw fetchError;
        }

        // N+1問題を解決: 全アドレスを一度に取得
        const uniqueAddresses = [...new Set((data || []).map(m => m.to_address.toLowerCase()))];

        // バッチでプロフィール情報を取得
        const profilesByAddress = new Map<string, any>();

        for (const address of uniqueAddresses) {
          try {
            // テナント固有のプロフィールを優先取得
            let profileData = null;

            if (effectiveTenantId !== 'default') {
              const { data: tenantProfile } = await supabase
                .from('user_profiles')
                .select('display_name, name, bio, avatar_url, icon_url')
                .eq('wallet_address', address)
                .eq('tenant_id', effectiveTenantId)
                .maybeSingle();
              profileData = tenantProfile;
            }

            // defaultテナントで検索
            if (!profileData) {
              const { data: defaultProfile } = await supabase
                .from('user_profiles')
                .select('display_name, name, bio, avatar_url, icon_url')
                .eq('wallet_address', address)
                .eq('tenant_id', 'default')
                .maybeSingle();
              profileData = defaultProfile;
            }

            // 最終フォールバック: tenant_idを問わず検索
            if (!profileData) {
              const { data: anyProfile } = await supabase
                .from('user_profiles')
                .select('display_name, name, bio, avatar_url, icon_url')
                .eq('wallet_address', address)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              profileData = anyProfile;
            }

            if (profileData) {
              profilesByAddress.set(address, {
                name: profileData.display_name || profileData.name || null,
                bio: profileData.bio || null,
                icon_url: profileData.avatar_url || profileData.icon_url || null,
              });
            }
          } catch (profileError) {
            console.error(`⚠️ Failed to fetch profile for ${address}:`, profileError);
            // エラーは無視して続行
          }
        }

        // メッセージにプロフィールをマージ
        const messagesWithProfiles = (data || []).map(message => {
          const profile = profilesByAddress.get(message.to_address.toLowerCase());
          return profile ? { ...message, recipient_profile: profile } : message;
        });

        setMessages(messagesWithProfiles);
        setRetryCount(0); // 成功したらリトライカウントをリセット
      } catch (err) {
        console.error('❌ Failed to fetch sent transfer messages:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // リアルタイム更新をサブスクライブ（再接続ロジック付き）
    const channel = supabase
      .channel('sent_transfer_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfer_messages',
          filter: `from_address=eq.${walletAddress.toLowerCase()}`,
        },
        () => {
          console.log('📤 Sent transfer message update (real-time)');
          fetchMessages();
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);

        // 接続エラー時は再接続を試みる
        if (status === 'CHANNEL_ERROR' && retryCount < 3) {
          console.warn(`⚠️ Realtime connection error, retrying... (attempt ${retryCount + 1})`);
          setRetryCount(prev => prev + 1);

          // 指数バックオフで再接続
          setTimeout(() => {
            supabase.removeChannel(channel);
            fetchMessages();
          }, Math.pow(2, retryCount) * 1000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, walletAddress, retryCount]);

  return { messages, isLoading, error };
}

/**
 * メッセージを既読にする
 */
export async function markMessageAsRead(messageId: string) {
  const { error } = await supabase
    .from('transfer_messages')
    .update({ is_read: true })
    .eq('id', messageId);

  if (error) {
    throw error;
  }
}

/**
 * メッセージをアーカイブする
 */
export async function archiveMessage(messageId: string) {
  const { error } = await supabase
    .from('transfer_messages')
    .update({ is_archived: true })
    .eq('id', messageId);

  if (error) {
    throw error;
  }
}

/**
 * メッセージにリアクションを追加
 */
export async function addMessageReaction(params: {
  messageId: string;
  reactorAddress: string;
  reactionType?: string;
}) {
  const { messageId, reactorAddress, reactionType = 'heart' } = params;

  const { data, error } = await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      reactor_address: reactorAddress.toLowerCase(),
      reaction_type: reactionType,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * メッセージからリアクションを削除
 */
export async function removeMessageReaction(params: {
  messageId: string;
  reactorAddress: string;
  reactionType?: string;
}) {
  const { messageId, reactorAddress, reactionType = 'heart' } = params;

  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('reactor_address', reactorAddress.toLowerCase())
    .eq('reaction_type', reactionType);

  if (error) {
    throw error;
  }
}

/**
 * メッセージのリアクション一覧を取得
 */
export async function getMessageReactions(messageId: string): Promise<MessageReaction[]> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * メッセージに対するリアクション通知を作成
 */
export async function createReactionNotification(params: {
  messageId: string;
  reactorAddress: string;
  senderAddress: string;
  reactionType?: string;
}) {
  const { messageId, reactorAddress, senderAddress, reactionType = 'heart' } = params;

  // リアクションしたユーザーのプロフィールを取得
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('display_name, avatar_url')
    .eq('wallet_address', reactorAddress.toLowerCase())
    .maybeSingle();

  const reactorName = profileData?.display_name || '匿名ユーザー';
  const reactionEmoji = reactionType === 'heart' ? '❤️' : '👍';

  // 通知を作成
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_address: senderAddress.toLowerCase(),
      type: 'message_reaction',
      title: `${reactionEmoji} リアクションがつきました`,
      message: `${reactorName}さんがあなたのメッセージに${reactionEmoji}をつけました`,
      from_address: reactorAddress.toLowerCase(),
      metadata: {
        message_id: messageId,
        reaction_type: reactionType,
      },
    });

  if (error) {
    console.error('Failed to create reaction notification:', error);
  }
}
