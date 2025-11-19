// api/notifications/send.ts
// プッシュ通知送信API

import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// VAPID設定
webpush.setVapidDetails(
  'mailto:support@gifterra.app',
  process.env.VITE_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

interface NotificationPayload {
  walletAddress: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORSヘッダー
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
    const { walletAddress, title, body, url, tag, data } = req.body as NotificationPayload;

    if (!walletAddress || !title) {
      return res.status(400).json({ error: 'walletAddress and title are required' });
    }

    // 購読情報を取得
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (error || !subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // プッシュ通知を送信
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/mypage',
      tag: tag || 'gifterra-notification',
      data,
    });

    await webpush.sendNotification(pushSubscription, payload);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Push notification error:', error);

    // 購読が無効な場合は削除
    if (error.statusCode === 410 || error.statusCode === 404) {
      const { walletAddress } = req.body;
      if (walletAddress) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('wallet_address', walletAddress.toLowerCase());
      }
      return res.status(410).json({ error: 'Subscription expired' });
    }

    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
