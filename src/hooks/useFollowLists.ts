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
 * @returns フォロワーとフォロー中のユーザーリスト
 */
export function useFollowLists(walletAddress: string | null): UseFollowListsReturn {
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
        console.error('Error fetching followers:', followersError);
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
        console.error('Error fetching following:', followingError);
        throw followingError;
      }

      // フォロワーのプロフィール情報を取得
      const followersWithProfiles = await Promise.all(
        (followersData || []).map(async (follow) => {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('display_name, name, bio, avatar_url, icon_url')
            .eq('wallet_address', follow.follower_address.toLowerCase())
            .limit(1)
            .maybeSingle();

          return {
            wallet_address: follow.follower_address,
            display_name: profileData?.display_name || profileData?.name || null,
            bio: profileData?.bio || null,
            avatar_url: profileData?.avatar_url || profileData?.icon_url || null,
            created_at: follow.created_at,
          };
        })
      );

      // フォロー中のプロフィール情報を取得
      const followingWithProfiles = await Promise.all(
        (followingData || []).map(async (follow) => {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('display_name, name, bio, avatar_url, icon_url')
            .eq('wallet_address', follow.following_address.toLowerCase())
            .limit(1)
            .maybeSingle();

          return {
            wallet_address: follow.following_address,
            display_name: profileData?.display_name || profileData?.name || null,
            bio: profileData?.bio || null,
            avatar_url: profileData?.avatar_url || profileData?.icon_url || null,
            created_at: follow.created_at,
          };
        })
      );

      setFollowers(followersWithProfiles);
      setFollowing(followingWithProfiles);
    } catch (err) {
      console.error('Error fetching follow lists:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowLists();
  }, [walletAddress]);

  return {
    followers,
    following,
    isLoading,
    error,
    refetch: fetchFollowLists,
  };
}
