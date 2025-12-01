// src/hooks/useFlagNFTList.ts
// フラグNFTリストを取得するHook

import { useState, useEffect } from 'react';
import { adminSupabase } from '../lib/adminSupabase';
import type { FlagNFT } from '../types/flagNFT';

/**
 * テナントのフラグNFTリストを取得するHook
 * @param tenantId テナントID
 * @returns フラグNFTリストとロード状態
 */
export function useFlagNFTList(tenantId: string | undefined) {
  const [flagNFTs, setFlagNFTs] = useState<FlagNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFlagNFTs = async () => {
      if (!adminSupabase || !tenantId) {
        setIsLoading(false);
        setFlagNFTs([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await adminSupabase
          .from('flag_nfts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('❌ [useFlagNFTList] フラグNFT取得エラー:', fetchError);
          setError(fetchError.message);
          setFlagNFTs([]);
        } else {
          setFlagNFTs(data || []);
        }
      } catch (err: any) {
        console.error('❌ [useFlagNFTList] 予期しないエラー:', err);
        setError(err?.message || '予期しないエラー');
        setFlagNFTs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFlagNFTs();
  }, [tenantId]);

  return { flagNFTs, isLoading, error };
}
