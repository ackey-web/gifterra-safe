// src/hooks/useFollow.ts
// フォロー機能のカスタムフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UseFollowReturn {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

/**
 * フォロー機能を管理するカスタムフック
 * @param targetAddress フォロー対象のウォレットアドレス
 * @param currentUserAddress 現在のユーザーのウォレットアドレス
 * @returns フォロー状態と操作関数
 */
export function useFollow(
  targetAddress: string | null,
  currentUserAddress: string | null
): UseFollowReturn {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // フォロー状態をチェック
  const checkFollowStatus = async () => {
    if (!targetAddress || !currentUserAddress) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('id')
        .eq('tenant_id', 'default')
        .eq('follower_address', currentUserAddress.toLowerCase())
        .eq('following_address', targetAddress.toLowerCase())
        .maybeSingle();

      if (error) {
        setIsFollowing(false);
      } else {
        setIsFollowing(!!data);
      }
    } catch (err) {
      setIsFollowing(false);
    }
  };

  // フォロワー数とフォロー中の数を取得
  const fetchCounts = async () => {
    if (!targetAddress) {
      setIsLoading(false);
      return;
    }

    try {
      // フォロワー数を取得
      const { count: followers, error: followerError } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', 'default')
        .eq('following_address', targetAddress.toLowerCase());

      if (followerError) {
        // エラー時は何もしない
      } else {
        setFollowerCount(followers || 0);
      }

      // フォロー中の数を取得
      const { count: following, error: followingError } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', 'default')
        .eq('follower_address', targetAddress.toLowerCase());

      if (followingError) {
        // エラー時は何もしない
      } else {
        setFollowingCount(following || 0);
      }
    } catch (err) {
      // エラー時は何もしない
    } finally {
      setIsLoading(false);
    }
  };

  // フォロー/フォロー解除を切り替え
  const toggleFollow = async () => {
    if (!targetAddress || !currentUserAddress) {
      return;
    }

    // 自分自身をフォローしようとした場合
    if (targetAddress.toLowerCase() === currentUserAddress.toLowerCase()) {
      return;
    }

    setIsLoading(true);

    try {
      if (isFollowing) {
        // フォロー解除
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('tenant_id', 'default')
          .eq('follower_address', currentUserAddress.toLowerCase())
          .eq('following_address', targetAddress.toLowerCase());

        if (error) {
          throw error;
        }

        setIsFollowing(false);
        setFollowerCount((prev) => Math.max(0, prev - 1));
      } else {
        // フォロー
        const { error } = await supabase.from('user_follows').insert({
          tenant_id: 'default',
          follower_address: currentUserAddress.toLowerCase(),
          following_address: targetAddress.toLowerCase(),
        });

        if (error) {
          throw error;
        }

        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
      }
    } catch (err) {
      // エラー時は状態を再取得
      await checkFollowStatus();
      await fetchCounts();
    } finally {
      setIsLoading(false);
    }
  };

  // カウントを再取得する関数（外部から呼び出し可能）
  const refreshCounts = async () => {
    await fetchCounts();
  };

  // 初回マウント時にフォロー状態とカウントを取得
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await Promise.all([checkFollowStatus(), fetchCounts()]);
      setIsLoading(false);
    };

    initialize();
  }, [targetAddress, currentUserAddress]);

  return {
    isFollowing,
    followerCount,
    followingCount,
    isLoading,
    toggleFollow,
    refreshCounts,
  };
}
