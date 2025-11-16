// src/hooks/useLoginHistory.ts
// ログイン履歴の記録と取得

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface LoginHistoryEntry {
  id: string;
  wallet_address: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: any;
}

/**
 * ログイン履歴を記録する
 */
export async function recordLogin(walletAddress: string) {
  try {
    // ユーザーエージェント情報を取得
    const userAgent = navigator.userAgent;

    // デバイス情報を収集
    const deviceInfo = {
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // ログイン履歴を記録
    const { error } = await supabase
      .from('user_login_history')
      .insert({
        tenant_id: 'default',
        wallet_address: walletAddress.toLowerCase(),
        user_agent: userAgent,
        device_info: deviceInfo,
        // ip_addressはバックエンドで設定するのが理想的
        // フロントエンドからは取得できないため、nullのまま
      });

    if (error) {
      console.error('Failed to record login history:', error);
    }
  } catch (err) {
    console.error('Error recording login:', err);
  }
}

/**
 * ログイン履歴を取得する
 */
export function useLoginHistory(walletAddress: string | undefined) {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('user_login_history')
          .select('*')
          .eq('tenant_id', 'default')
          .eq('wallet_address', walletAddress.toLowerCase())
          .order('login_at', { ascending: false })
          .limit(20); // 最新20件のみ取得

        if (fetchError) {
          throw fetchError;
        }

        setHistory(data || []);
      } catch (err) {
        console.error('Failed to fetch login history:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [walletAddress]);

  return { history, isLoading, error };
}
