// src/hooks/useTransferMessages.ts
// 送金メッセージ機能のカスタムフック

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { supabase } from '../lib/supabase';
import { SUPPORTED_TOKENS } from '../config/supportedTokens';

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
  is_anonymous?: boolean; // 匿名送金フラグ
  reactions?: MessageReaction[];
  reaction_count?: number;
  has_reacted?: boolean;
  source?: 'gifterra' | 'blockchain'; // データソースの識別
}

/**
 * ブロックチェーントランザクションの既読状態を管理するための関数
 */
const BLOCKCHAIN_READ_KEY = 'gifterra_blockchain_read_transactions';

function getReadBlockchainTransactions(walletAddress: string): Set<string> {
  try {
    const stored = localStorage.getItem(`${BLOCKCHAIN_READ_KEY}_${walletAddress.toLowerCase()}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markBlockchainTransactionAsRead(walletAddress: string, txHash: string): void {
  try {
    const readTxs = getReadBlockchainTransactions(walletAddress);
    readTxs.add(txHash);
    localStorage.setItem(
      `${BLOCKCHAIN_READ_KEY}_${walletAddress.toLowerCase()}`,
      JSON.stringify(Array.from(readTxs))
    );
  } catch (error) {
    console.error('Failed to mark blockchain transaction as read:', error);
  }
}

/**
 * Etherscan V2 API (Polygon)から受信トランザクションを取得
 * Note: PolygonScanはEtherscan V2 APIに移行されました
 */
async function fetchBlockchainReceivedTransactions(
  walletAddress: string
): Promise<TransferMessage[]> {
  try {
    // Etherscan V2 API キー (Polygon対応)
    const apiKey = import.meta.env.VITE_POLYGONSCAN_API_KEY || 'V5XJ3EHND6UZ1PNNQ8XJ293QYJNUUUEMQY';

    if (!apiKey) {
      console.warn('⚠️ Etherscan API key not found. Skipping blockchain transactions.');
      return [];
    }

    console.log('🔗 Fetching blockchain transactions from Etherscan V2 API (Polygon)...');

    // 既読済みトランザクションのリストを取得
    const readTxs = getReadBlockchainTransactions(walletAddress);

    const blockchainTxs: TransferMessage[] = [];

    // サポートされている各トークンの受信履歴を取得
    for (const token of SUPPORTED_TOKENS) {
      try {
        // Etherscan V2 API エンドポイント (Polygon Mainnet)
        // Note: api.etherscan.io/v2/api を使用（api.polygonscan.comではない）
        const apiUrl = `https://api.etherscan.io/v2/api?chainid=137&module=account&action=tokentx&contractaddress=${token.ADDRESS}&address=${walletAddress}&page=1&offset=50&sort=desc&apikey=${apiKey}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        // V2 APIのレスポンス形式に対応
        if (data.status !== '1' || !data.result) {
          console.warn(`⚠️ ${token.SYMBOL}: Etherscan API error - ${data.message || 'Unknown error'}`);
          continue;
        }

        if (!Array.isArray(data.result) || data.result.length === 0) {
          console.log(`  - No ${token.SYMBOL} transactions found`);
          continue;
        }

        // 受信トランザクションのみフィルタ
        const receivedTxs = data.result.filter(
          (tx: any) => tx.to.toLowerCase() === walletAddress.toLowerCase()
        );

        console.log(`  - Found ${receivedTxs.length} received ${token.SYMBOL} transactions`);

        // TransferMessage形式に変換
        for (const tx of receivedTxs) {
          blockchainTxs.push({
            id: tx.hash, // トランザクションハッシュをIDとして使用
            tenant_id: 'blockchain',
            from_address: tx.from,
            to_address: tx.to,
            token_symbol: token.SYMBOL,
            amount: ethers.utils.formatUnits(tx.value, 18),
            tx_hash: tx.hash,
            created_at: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1年後
            is_read: readTxs.has(tx.hash), // localStorageから既読状態を取得
            is_archived: false,
            source: 'blockchain',
          });
        }
      } catch (tokenError) {
        console.error(`❌ Failed to fetch ${token.SYMBOL} transactions:`, tokenError);
      }
    }

    console.log(`✅ Total ${blockchainTxs.length} blockchain transactions fetched from Etherscan V2 API`);
    return blockchainTxs;
  } catch (error) {
    console.error('❌ Failed to fetch blockchain transactions:', error);
    return [];
  }
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
  isAnonymous?: boolean;
}) {
  const { tenantId, fromAddress, toAddress, tokenSymbol, amount, message, txHash, isAnonymous } = params;

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
        is_anonymous: isAnonymous || false,
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
        console.log('📨 Fetching received transfer messages...');
        console.log('  - Wallet Address:', walletAddress);
        console.log('  - Tenant ID:', effectiveTenantId);

        // テナントIDが'default'の場合は'default'のみ検索
        // テナントIDが指定されている場合は、そのIDと'default'の両方を検索
        const tenantIdsToSearch = effectiveTenantId === 'default'
          ? ['default']
          : [effectiveTenantId, 'default'];

        console.log('  - Searching in tenants:', tenantIdsToSearch);

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

        console.log(`✅ Found ${(data || []).length} messages from Supabase`);

        // ブロックチェーンからの受信履歴も取得
        const blockchainTxs = await fetchBlockchainReceivedTransactions(walletAddress);

        // N+1問題を解決: 全アドレスを一度に取得
        const allMessages = [...(data || []), ...blockchainTxs];
        const uniqueAddresses = [...new Set(allMessages.map(m => m.from_address.toLowerCase()))];

        console.log(`🔄 Fetching profiles for ${uniqueAddresses.length} unique senders...`);

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
        const messagesWithProfiles = allMessages.map(message => {
          const profile = profilesByAddress.get(message.from_address.toLowerCase());
          const messageWithProfile = profile
            ? { ...message, sender_profile: profile, source: message.source || 'gifterra' }
            : { ...message, source: message.source || 'gifterra' };
          return messageWithProfile;
        });

        // 作成日時でソート（新しい順）
        const sortedMessages = messagesWithProfiles.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // 重複を除去（同じトランザクションハッシュのメッセージ）
        const uniqueMessages = sortedMessages.filter((message, index, self) => {
          if (!message.tx_hash) return true;
          return index === self.findIndex(m => m.tx_hash === message.tx_hash);
        });

        console.log(`✅ Total ${uniqueMessages.length} messages (Gifterra: ${data?.length || 0}, Blockchain: ${blockchainTxs.length})`);

        setMessages(uniqueMessages);
        setUnreadCount(uniqueMessages.filter((m: TransferMessage) => !m.is_read).length);
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
 * ブロックチェーントランザクションの場合はlocalStorageに保存
 */
export async function markMessageAsRead(messageId: string, walletAddress?: string) {
  // トランザクションハッシュ形式（0xで始まる64文字）の場合はブロックチェーントランザクション
  const isBlockchainTx = messageId.startsWith('0x') && messageId.length === 66;

  if (isBlockchainTx && walletAddress) {
    // ブロックチェーントランザクションの場合はlocalStorageに保存
    markBlockchainTransactionAsRead(walletAddress, messageId);
  } else {
    // Gifterra内のメッセージの場合はSupabaseに保存
    const { error } = await supabase
      .from('transfer_messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) {
      throw error;
    }
  }
}

/**
 * 複数のメッセージを一括既読にする
 */
export async function markMultipleMessagesAsRead(messages: TransferMessage[], walletAddress?: string) {
  const gifterraMessages: string[] = [];
  const blockchainTxHashes: string[] = [];

  // メッセージをソース別に分類
  for (const msg of messages) {
    if (msg.is_read) continue; // 既に既読の場合はスキップ

    const isBlockchainTx = msg.id.startsWith('0x') && msg.id.length === 66;
    if (isBlockchainTx) {
      blockchainTxHashes.push(msg.id);
    } else {
      gifterraMessages.push(msg.id);
    }
  }

  // Gifterraメッセージを一括更新
  if (gifterraMessages.length > 0) {
    const { error } = await supabase
      .from('transfer_messages')
      .update({ is_read: true })
      .in('id', gifterraMessages);

    if (error) {
      throw error;
    }
  }

  // ブロックチェーントランザクションをlocalStorageに保存
  if (blockchainTxHashes.length > 0 && walletAddress) {
    for (const txHash of blockchainTxHashes) {
      markBlockchainTransactionAsRead(walletAddress, txHash);
    }
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
