// src/hooks/useRecipientProfile.ts
// 送金先アドレスのユーザープロフィールを取得するフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RecipientProfile {
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  receive_message: string | null;
  isGifterraUser: boolean;
}

/**
 * 送金先アドレスからユーザープロフィールを取得するフック
 * @param address - 検索するウォレットアドレス（デバウンス前の値）
 * @param debounceMs - デバウンス時間（ミリ秒）デフォルト500ms
 */
export function useRecipientProfile(address: string, debounceMs: number = 500) {
  const [profile, setProfile] = useState<RecipientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // アドレスが空の場合は何もしない
    if (!address || address.trim().length === 0) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // アドレスの基本検証（0xで始まり、42文字）
    const trimmedAddress = address.trim();
    if (!trimmedAddress.startsWith('0x') || trimmedAddress.length !== 42) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // デバウンス処理
    setIsLoading(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        console.log('🔍 Fetching profile for address:', trimmedAddress.toLowerCase());

        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('wallet_address, display_name, avatar_url, receive_message')
          .eq('wallet_address', trimmedAddress.toLowerCase())
          .maybeSingle();

        console.log('📊 Query result:', { data, error: fetchError });

        if (fetchError) {
          console.error('❌ Supabase error details:', {
            message: fetchError.message,
            code: fetchError.code,
            details: fetchError.details,
            hint: fetchError.hint
          });
        }

        if (fetchError) {
          console.error('Failed to fetch recipient profile:', fetchError);
          setError('プロフィールの取得に失敗しました');
          setProfile(null);
          setIsLoading(false);
          return;
        }

        if (data) {
          // GIFTERRAユーザーが見つかった
          console.log('✅ GIFTERRA user found!', data);
          setProfile({
            wallet_address: data.wallet_address,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            receive_message: data.receive_message || 'ありがとうございました。',
            isGifterraUser: true,
          });
        } else {
          // 未登録ユーザー
          setProfile({
            wallet_address: trimmedAddress.toLowerCase(),
            display_name: null,
            avatar_url: null,
            receive_message: null,
            isGifterraUser: false,
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error in useRecipientProfile:', err);
        setError('エラーが発生しました');
        setProfile(null);
        setIsLoading(false);
      }
    }, debounceMs);

    // クリーンアップ: タイムアウトをキャンセル
    return () => {
      clearTimeout(timeoutId);
    };
  }, [address, debounceMs]);

  return { profile, isLoading, error };
}
