// src/hooks/useNotifications.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_address: string;
  type: 'jpyc_received' | 'tip_received' | 'tenant_status_changed' | 'follow' | 'system_announcement';
  title: string;
  message: string;
  amount?: string;
  token_symbol?: string;
  from_address?: string;
  tx_hash?: string;
  metadata?: any;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export function useNotifications(userAddress: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 通知を取得
  const fetchNotifications = async () => {
    if (!userAddress) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_address', userAddress.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(50); // 最新50件のみ

      if (fetchError) throw fetchError;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
      setError(null);
    } catch (err) {
      console.error('通知取得エラー:', err);
      setError(err instanceof Error ? err.message : '通知の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 通知を既読にする
  const markAsRead = async (notificationId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (updateError) throw updateError;

      // ローカルステートを更新
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('既読マークエラー:', err);
    }
  };

  // 全ての通知を既読にする
  const markAllAsRead = async () => {
    if (!userAddress) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_address', userAddress.toLowerCase())
        .eq('is_read', false);

      if (updateError) throw updateError;

      // ローカルステートを更新
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('全既読マークエラー:', err);
    }
  };

  // 初回読み込みとリアルタイム購読
  useEffect(() => {
    fetchNotifications();

    if (!userAddress) return;

    // Supabase Realtime購読（新しい通知が追加されたら自動更新）
    const channel = supabase
      .channel(`notifications:${userAddress.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_address=eq.${userAddress.toLowerCase()}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_address=eq.${userAddress.toLowerCase()}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => (n.id === (payload.new as Notification).id ? (payload.new as Notification) : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userAddress]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
