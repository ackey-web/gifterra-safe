// src/hooks/useTransferMessages.ts
// 送金メッセージ機能のカスタムフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
  tx_hash?: string;
  created_at: string;
  expires_at: string;
  is_read: boolean;
  is_archived: boolean;
}

/**
 * 送金メッセージを保存
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

  // 送信者のプロフィール情報を取得
  // まずテナントIDでフィルタリングして検索し、なければdefaultテナントで検索
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
    console.error('❌ 送金メッセージ保存エラー:', error);
    throw error;
  }

  return data;
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
          console.error('❌ Supabase query error:', fetchError);
          throw fetchError;
        }

        // 各メッセージに対して、送信者の最新プロフィール情報を取得してマージ
        const messagesWithProfiles = await Promise.all(
          (data || []).map(async (message) => {
            try {
              // 送信者の最新プロフィールを取得
              // まずメッセージと同じテナントIDで検索
              let profileData = null;

              if (message.tenant_id && message.tenant_id !== 'default') {
                const { data } = await supabase
                  .from('user_profiles')
                  .select('display_name, name, bio, avatar_url, icon_url')
                  .eq('wallet_address', message.from_address.toLowerCase())
                  .eq('tenant_id', message.tenant_id)
                  .maybeSingle();
                profileData = data;
              }

              // テナント固有のプロフィールがない場合は、defaultテナントで検索
              if (!profileData) {
                const { data } = await supabase
                  .from('user_profiles')
                  .select('display_name, name, bio, avatar_url, icon_url')
                  .eq('wallet_address', message.from_address.toLowerCase())
                  .eq('tenant_id', 'default')
                  .maybeSingle();
                profileData = data;
              }

              // それでも見つからない場合は、tenant_idを問わず検索
              if (!profileData) {
                const { data } = await supabase
                  .from('user_profiles')
                  .select('display_name, name, bio, avatar_url, icon_url')
                  .eq('wallet_address', message.from_address.toLowerCase())
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                profileData = data;
              }

              // プロフィールデータが取得できた場合は、メッセージのsender_profileを更新
              if (profileData) {
                const updatedProfile = {
                  name: profileData.display_name || profileData.name || null,
                  bio: profileData.bio || null,
                  icon_url: profileData.avatar_url || profileData.icon_url || null,
                };

                // デバッグログ: プロフィール取得状況を確認
                if (!updatedProfile.name && message.from_address.toLowerCase() === '0xdf77a8d2bf87c817f61d1786497b6446cde4c563') {
                  console.log('🔍 プロフィール取得デバッグ:', {
                    from_address: message.from_address,
                    profileData,
                    updatedProfile,
                  });
                }

                return {
                  ...message,
                  sender_profile: updatedProfile,
                };
              }

              // プロフィールが見つからない場合は元のメッセージをそのまま返す
              return message;
            } catch (profileError) {
              console.error('プロフィール取得エラー:', profileError);
              return message; // エラー時は元のメッセージをそのまま返す
            }
          })
        );

        setMessages(messagesWithProfiles);
        setUnreadCount(messagesWithProfiles.filter((m: TransferMessage) => !m.is_read).length);
      } catch (err) {
        console.error('❌ 送金メッセージ取得エラー:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // リアルタイム更新をサブスクライブ
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
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, walletAddress]);

  return { messages, isLoading, error, unreadCount };
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
    console.error('既読更新エラー:', error);
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
    console.error('アーカイブエラー:', error);
    throw error;
  }
}
