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
        console.error('Error checking follow status:', error);
        setIsFollowing(false);
      } else {
        setIsFollowing(!!data);
      }
    } catch (err) {
      console.error('Error checking follow status:', err);
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
        console.error('Error fetching follower count:', followerError);
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
        console.error('Error fetching following count:', followingError);
      } else {
        setFollowingCount(following || 0);
      }
    } catch (err) {
      console.error('Error fetching counts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // フォロー/フォロー解除を切り替え
  const toggleFollow = async () => {
    if (!targetAddress || !currentUserAddress) {
      console.error('Missing addresses');
      return;
    }

    // 自分自身をフォローしようとした場合
    if (targetAddress.toLowerCase() === currentUserAddress.toLowerCase()) {
      console.error('Cannot follow yourself');
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
          console.error('Error unfollowing:', error);
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
          console.error('Error following:', error);
          throw error;
        }

        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
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
