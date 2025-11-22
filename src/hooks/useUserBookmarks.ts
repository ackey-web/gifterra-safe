// src/hooks/useUserBookmarks.ts
// ユーザーブックマーク機能のカスタムフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface UserBookmark {
  id: string;
  user_address: string;
  bookmarked_address: string;
  nickname: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  // プロフィール情報（JOIN結果）
  profile?: {
    name: string | null;
    bio: string | null;
    avatar_url: string | null;
  };
}

/**
 * ユーザーのブックマーク一覧を取得するフック
 */
export function useUserBookmarks(userAddress: string | undefined) {
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setBookmarks([]);
      setIsLoading(false);
      return;
    }

    const fetchBookmarks = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_bookmarks')
          .select(`
            *,
            profile:user_profiles!user_bookmarks_bookmarked_address_fkey(
              name,
              bio,
              avatar_url
            )
          `)
          .eq('user_address', userAddress.toLowerCase())
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setBookmarks(data || []);
      } catch (err) {
        console.error('ブックマーク取得エラー:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookmarks();

    // リアルタイム更新の購読
    const subscription = supabase
      .channel('user_bookmarks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_bookmarks',
          filter: `user_address=eq.${userAddress.toLowerCase()}`,
        },
        () => {
          fetchBookmarks();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userAddress]);

  return { bookmarks, isLoading, error };
}

/**
 * ブックマークを追加する
 */
export async function addBookmark(
  userAddress: string,
  bookmarkedAddress: string,
  nickname?: string,
  memo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // アドレスを小文字に正規化
    const normalizedUserAddress = userAddress.toLowerCase();
    const normalizedBookmarkedAddress = bookmarkedAddress.toLowerCase();

    // 自分自身をブックマークできないようにする
    if (normalizedUserAddress === normalizedBookmarkedAddress) {
      return {
        success: false,
        error: '自分自身をブックマークすることはできません',
      };
    }

    const { error } = await supabase.from('user_bookmarks').insert({
      user_address: normalizedUserAddress,
      bookmarked_address: normalizedBookmarkedAddress,
      nickname: nickname || null,
      memo: memo || null,
    });

    if (error) {
      // 重複エラーの場合
      if (error.code === '23505') {
        return {
          success: false,
          error: 'このユーザーは既にブックマークされています',
        };
      }
      throw error;
    }

    return { success: true };
  } catch (err) {
    console.error('ブックマーク追加エラー:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラー',
    };
  }
}

/**
 * ブックマークを削除する
 */
export async function removeBookmark(
  bookmarkId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .delete()
      .eq('id', bookmarkId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err) {
    console.error('ブックマーク削除エラー:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラー',
    };
  }
}

/**
 * ブックマークのニックネームを更新する
 */
export async function updateBookmarkNickname(
  bookmarkId: string,
  nickname: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .update({ nickname })
      .eq('id', bookmarkId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err) {
    console.error('ニックネーム更新エラー:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラー',
    };
  }
}

/**
 * ブックマークのメモを更新する
 */
export async function updateBookmarkMemo(
  bookmarkId: string,
  memo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .update({ memo })
      .eq('id', bookmarkId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err) {
    console.error('メモ更新エラー:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラー',
    };
  }
}

/**
 * 特定のアドレスがブックマークされているかチェック
 */
export async function isBookmarked(
  userAddress: string,
  bookmarkedAddress: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .select('id')
      .eq('user_address', userAddress.toLowerCase())
      .eq('bookmarked_address', bookmarkedAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = レコードが見つからない
      throw error;
    }

    return !!data;
  } catch (err) {
    console.error('ブックマークチェックエラー:', err);
    return false;
  }
}
