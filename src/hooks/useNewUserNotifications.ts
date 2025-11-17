// src/hooks/useNewUserNotifications.ts
// 同じロールの新規ユーザー登録を検知して通知するフック

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/profile';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface NewUserNotification {
  id: string;
  displayName: string;
  walletAddress: string;
  roles: UserRole[];
  commonRoles: UserRole[];
  timestamp: Date;
}

interface UseNewUserNotificationsOptions {
  /** 現在のユーザーのロール */
  myRoles?: UserRole[];
  /** 通知を有効にするか */
  enabled?: boolean;
  /** 通知コールバック */
  onNewUser?: (notification: NewUserNotification) => void;
}

/**
 * 同じロールの新規ユーザー登録を監視するフック
 */
export function useNewUserNotifications({
  myRoles = [],
  enabled = true,
  onNewUser,
}: UseNewUserNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<NewUserNotification[]>([]);
  const [isListening, setIsListening] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastNotificationTime = useRef<number>(0);
  const notificationCountToday = useRef<number>(0);
  const lastResetDate = useRef<string>(new Date().toDateString());

  // 通知頻度制限
  const RATE_LIMIT = {
    minIntervalMs: 60 * 60 * 1000, // 1時間に1回まで
    maxPerDay: 5, // 1日5件まで
  };

  /**
   * 通知が許可されているかチェック
   */
  const canNotify = (): boolean => {
    const now = Date.now();
    const currentDate = new Date().toDateString();

    // 日付が変わったらカウントをリセット
    if (currentDate !== lastResetDate.current) {
      notificationCountToday.current = 0;
      lastResetDate.current = currentDate;
    }

    // 1日の上限チェック
    if (notificationCountToday.current >= RATE_LIMIT.maxPerDay) {
      return false;
    }

    // 最小間隔チェック
    if (now - lastNotificationTime.current < RATE_LIMIT.minIntervalMs) {
      return false;
    }

    return true;
  };

  /**
   * 通知を記録
   */
  const recordNotification = () => {
    lastNotificationTime.current = Date.now();
    notificationCountToday.current += 1;
  };

  /**
   * Supabase Realtimeリスナーをセットアップ
   */
  useEffect(() => {
    // 条件チェック
    if (!enabled || !myRoles || myRoles.length === 0) {
      setIsListening(false);
      return;
    }

    // チャンネル作成
    const channel = supabase
      .channel('new-user-registrations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          try {
            const newUser = payload.new as {
              wallet_address: string;
              display_name: string;
              roles?: UserRole[];
              created_at: string;
            };

            // ロールが設定されていない場合はスキップ
            if (!newUser.roles || newUser.roles.length === 0) {
              return;
            }

            // 共通ロールを検出
            const commonRoles = newUser.roles.filter(role => myRoles.includes(role));

            // 共通ロールがない場合はスキップ
            if (commonRoles.length === 0) {
              return;
            }

            // レート制限チェック
            if (!canNotify()) {
              console.log('[NewUserNotifications] Rate limit exceeded, skipping notification');
              return;
            }

            // 通知オブジェクトを作成
            const notification: NewUserNotification = {
              id: `new-user-${newUser.wallet_address}-${Date.now()}`,
              displayName: newUser.display_name || '名無しユーザー',
              walletAddress: newUser.wallet_address,
              roles: newUser.roles,
              commonRoles,
              timestamp: new Date(newUser.created_at),
            };

            // 通知を記録
            recordNotification();

            // 通知を状態に追加
            setNotifications(prev => [notification, ...prev].slice(0, 10)); // 最新10件まで保持

            // コールバック実行
            if (onNewUser) {
              onNewUser(notification);
            }

            console.log('[NewUserNotifications] New user detected:', notification);
          } catch (error) {
            console.error('[NewUserNotifications] Error processing new user:', error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsListening(true);
          console.log('[NewUserNotifications] Listening for new users with roles:', myRoles);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsListening(false);
          console.error('[NewUserNotifications] Channel error:', status);
        }
      });

    channelRef.current = channel;

    // クリーンアップ
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsListening(false);
      }
    };
  }, [enabled, myRoles?.join(','), onNewUser]); // myRolesを文字列化して依存関係に含める

  /**
   * 通知をクリア
   */
  const clearNotifications = () => {
    setNotifications([]);
  };

  /**
   * 特定の通知を削除
   */
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return {
    notifications,
    isListening,
    clearNotifications,
    removeNotification,
  };
}
