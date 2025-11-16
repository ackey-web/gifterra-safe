// src/hooks/useRoleUsers.ts
// 特定のロールを持つユーザーリストを取得するカスタムフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/profile';

export interface RoleUser {
  wallet_address: string;
  display_name: string;
  bio: string;
  avatar_url?: string;
  roles?: UserRole[];
}

/**
 * 特定のロールを持つユーザーリストを取得
 * @param role 取得したいロール
 * @param isOpen モーダルが開いているかどうか
 */
export function useRoleUsers(role: UserRole | null, isOpen: boolean) {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !role) {
      setUsers([]);
      return;
    }

    const fetchRoleUsers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // rolesカラムにroleが含まれるユーザーを取得
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('wallet_address, display_name, bio, avatar_url, roles')
          .eq('tenant_id', 'default')
          .contains('roles', [role])
          .order('created_at', { ascending: false })
          .limit(100); // 最大100件

        if (fetchError) throw fetchError;

        setUsers(data || []);
      } catch (err) {
        console.error('ロール別ユーザー取得エラー:', err);
        setError(err instanceof Error ? err.message : 'ユーザーの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoleUsers();
  }, [role, isOpen]);

  return {
    users,
    isLoading,
    error,
  };
}
