// src/hooks/useFollowLists.ts
// フォロー/フォロワーリストを取得するカスタムフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface FollowUser {
  wallet_address: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_at?: string;
  is_following_back?: boolean; // 現在のログインユーザーがこのユーザーをフォローしているか(フォロワーリスト用)、またはこのユーザーが現在のログインユーザーをフォローバックしているか(フォローリスト用)
  is_following_me?: boolean; // このユーザーが現在のログインユーザーをフォローしているか(フォロワーリスト用)
}

interface UseFollowListsReturn {
  followers: FollowUser[];
  following: FollowUser[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * フォロー/フォロワーリストを取得するカスタムフック
 * @param walletAddress 対象のウォレットアドレス
 * @param currentUserAddress 現在のユーザーのウォレットアドレス（相互フォロー判定用）
 * @returns フォロワーとフォロー中のユーザーリスト
 */
export function useFollowLists(
  walletAddress: string | null,
  currentUserAddress?: string | null
): UseFollowListsReturn {
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFollowLists = async () => {
    if (!walletAddress) {
      setFollowers([]);
      setFollowing([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // フォロワーリストを取得
      const { data: followersData, error: followersError } = await supabase
        .from('user_follows')
        .select('follower_address, created_at')
        .eq('tenant_id', 'default')
        .eq('following_address', walletAddress.toLowerCase())
        .order('created_at', { ascending: false });

      if (followersError) {
        throw followersError;
      }

      // フォロー中のリストを取得
      const { data: followingData, error: followingError } = await supabase
        .from('user_follows')
        .select('following_address, created_at')
        .eq('tenant_id', 'default')
        .eq('follower_address', walletAddress.toLowerCase())
        .order('created_at', { ascending: false });

      if (followingError) {
        throw followingError;
      }

      // フォロワーのプロフィール情報を取得 + 相互フォロー判定
      const followersWithProfiles = await Promise.all(
        (followersData || []).map(async (follow) => {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('display_name, name, bio, avatar_url, icon_url')
            .eq('wallet_address', follow.follower_address.toLowerCase())
            .limit(1)
            .maybeSingle();

          // フォロワーリスト用の判定（誰のリストを見ていても、現在のログインユーザー視点で判定）
          let isFollowingBack = false; // 現在のログインユーザーがこのフォロワーをフォローしているか
          let isFollowingMe = false; // このフォロワーが現在のログインユーザーをフォローしているか

          if (currentUserAddress) {
            // このフォロワーを現在のログインユーザーがフォローしているか確認
            const { data: iFollowThem } = await supabase
              .from('user_follows')
              .select('id')
              .eq('tenant_id', 'default')
              .eq('follower_address', currentUserAddress.toLowerCase())
              .eq('following_address', follow.follower_address.toLowerCase())
              .maybeSingle();
            isFollowingBack = !!iFollowThem;

            // このフォロワーが現在のログインユーザーをフォローしているか確認
            const { data: theyFollowMe } = await supabase
              .from('user_follows')
              .select('id')
              .eq('tenant_id', 'default')
              .eq('follower_address', follow.follower_address.toLowerCase())
              .eq('following_address', currentUserAddress.toLowerCase())
              .maybeSingle();
            isFollowingMe = !!theyFollowMe;
          }

          return {
            wallet_address: follow.follower_address,
            display_name: profileData?.display_name || profileData?.name || null,
            bio: profileData?.bio || null,
            avatar_url: profileData?.avatar_url || profileData?.icon_url || null,
            created_at: follow.created_at,
            is_following_back: isFollowingBack,
            is_following_me: isFollowingMe,
          };
        })
      );

      // フォロー中のプロフィール情報を取得 + 相互フォロー判定
      const followingWithProfiles = await Promise.all(
        (followingData || []).map(async (follow) => {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('display_name, name, bio, avatar_url, icon_url')
            .eq('wallet_address', follow.following_address.toLowerCase())
            .limit(1)
            .maybeSingle();

          // 相互フォロー判定: このユーザーが現在のログインユーザーをフォローバックしているか
          // 誰のリストを見ていても、現在のログインユーザー視点で判定
          let isFollowingBack = false;
          if (currentUserAddress) {
            // このユーザーが現在のログインユーザーをフォローバックしているか確認
            const { data: followBackData } = await supabase
              .from('user_follows')
              .select('id')
              .eq('tenant_id', 'default')
              .eq('follower_address', follow.following_address.toLowerCase())
              .eq('following_address', currentUserAddress.toLowerCase())
              .maybeSingle();
            isFollowingBack = !!followBackData;
          }

          return {
            wallet_address: follow.following_address,
            display_name: profileData?.display_name || profileData?.name || null,
            bio: profileData?.bio || null,
            avatar_url: profileData?.avatar_url || profileData?.icon_url || null,
            created_at: follow.created_at,
            is_following_back: isFollowingBack,
          };
        })
      );

      setFollowers(followersWithProfiles);
      setFollowing(followingWithProfiles);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowLists();
  }, [walletAddress, currentUserAddress]);

  return {
    followers,
    following,
    isLoading,
    error,
    refetch: fetchFollowLists,
  };
}
