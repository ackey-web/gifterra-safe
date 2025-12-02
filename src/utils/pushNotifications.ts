// src/utils/pushNotifications.ts
// プッシュ通知のユーティリティ関数

import { supabase } from '../lib/supabase';

// VAPID公開鍵（環境変数から取得）
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BKFe1z52R0e717gcLnuvn7THjf7OB0DIbInanL-wlsPpieMsTnZf4Zz0YciUE6i8t5ugVTGBzUs7t4_6Lz0OpGk';

/**
 * Base64文字列をUint8Arrayに変換（VAPID用）
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * プッシュ通知がサポートされているかチェック
 */
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * 通知の許可状態を取得
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * 通知の許可をリクエスト
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * プッシュ通知を購読
 */
export async function subscribeToPushNotifications(walletAddress: string): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    console.warn('Push notifications are not supported');
    return null;
  }

  try {
    // 通知許可をリクエスト
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    // Service Workerの準備を待つ
    const registration = await navigator.serviceWorker.ready;

    // 既存の購読をチェック
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 新しい購読を作成
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // Supabaseに購読情報を保存
    await savePushSubscription(walletAddress, subscription);

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

/**
 * プッシュ通知の購読を解除
 */
export async function unsubscribeFromPushNotifications(walletAddress: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await deletePushSubscription(walletAddress);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

/**
 * 現在の購読状態を取得
 */
export async function getPushSubscriptionStatus(): Promise<{
  isSubscribed: boolean;
  permission: NotificationPermission;
}> {
  if (!isPushNotificationSupported()) {
    return {
      isSubscribed: false,
      permission: 'denied',
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return {
      isSubscribed: !!subscription,
      permission: getNotificationPermission(),
    };
  } catch (error) {
    return {
      isSubscribed: false,
      permission: getNotificationPermission(),
    };
  }
}

/**
 * 購読情報をSupabaseに保存
 */
async function savePushSubscription(walletAddress: string, subscription: PushSubscription): Promise<void> {
  const subscriptionData = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      wallet_address: walletAddress.toLowerCase(),
      endpoint: subscription.endpoint,
      p256dh: subscriptionData.keys?.p256dh || '',
      auth: subscriptionData.keys?.auth || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'wallet_address',
    });

  if (error) {
    console.error('Failed to save push subscription:', error);
    throw error;
  }
}

/**
 * 購読情報をSupabaseから削除
 */
async function deletePushSubscription(walletAddress: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('wallet_address', walletAddress.toLowerCase());

  if (error) {
    console.error('Failed to delete push subscription:', error);
    throw error;
  }
}

/**
 * テスト通知を送信（開発用）
 */
export async function sendTestNotification(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification('GIFTERRA テスト通知', {
    body: 'プッシュ通知が正常に動作しています！',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'test-notification',
  } as any);
}

/**
 * PWA/アプリアイコンにバッジを設定（Badge API）
 * @param count バッジに表示する数値（0で非表示）
 */
export async function setAppBadge(count: number): Promise<void> {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);

      } else {
        await (navigator as any).clearAppBadge();

      }
    } else {

    }
  } catch (error) {
    console.error('Failed to set app badge:', error);
  }
}

/**
 * アプリバッジをクリア
 */
export async function clearAppBadge(): Promise<void> {
  await setAppBadge(0);
}

/**
 * 新規JPYC受信の通知を送信
 */
export async function sendJpycReceivedNotification(
  amount: string,
  fromAddress: string,
  senderName?: string
): Promise<void> {
  try {
    const permission = getNotificationPermission();
    if (permission !== 'granted') {

      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const displayName = senderName || `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`;

    await registration.showNotification('💴 JPYC受信', {
      body: `${displayName}から ${amount} JPYC を受け取りました`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'jpyc-received',
      requireInteraction: false,
      data: {
        type: 'jpyc_received',
        fromAddress,
        amount,
      },
    } as any);

  } catch (error) {
    console.error('Failed to send JPYC received notification:', error);
  }
}
