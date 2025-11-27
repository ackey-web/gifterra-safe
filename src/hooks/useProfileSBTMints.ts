// src/hooks/useProfileSBTMints.ts
// プロフィールSBTミント管理Hooks

import { useState, useEffect } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';

export interface ProfileSBTMint {
  id: string;
  tenant_id: string;
  user_address: string;
  rank_level: number;
  kodomi_at_mint: number;
  minted_at: string;
  tx_hash: string | null;
}

/**
 * ユーザーが獲得したプロフィールSBTのリストを取得
 * @param tenantId テナントID（オプション：指定しない場合は全テナント）
 */
export function useMyProfileSBTs(tenantId?: string) {
  const address = useAddress();
  const [sbts, setSbts] = useState<ProfileSBTMint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setSbts([]);
      setLoading(false);
      return;
    }

    fetchMySBTs();
  }, [address, tenantId]);

  async function fetchMySBTs() {
    if (!address) return;

    try {
      setLoading(true);
      let query = supabase
        .from('profile_sbt_mints')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .order('rank_level', { ascending: true });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSbts(data || []);
    } catch (err) {
      console.error('❌ プロフィールSBT取得エラー:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { sbts, loading, error, refetch: fetchMySBTs };
}

/**
 * 特定のランクのSBTをミント済みかチェック
 */
export function useCheckSBTMinted(tenantId: string, rankLevel: number) {
  const address = useAddress();
  const [isMinted, setIsMinted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !tenantId) {
      setIsMinted(false);
      setLoading(false);
      return;
    }

    checkMinted();
  }, [address, tenantId, rankLevel]);

  async function checkMinted() {
    if (!address || !tenantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profile_sbt_mints')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_address', address.toLowerCase())
        .eq('rank_level', rankLevel)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      setIsMinted(!!data);
    } catch (err) {
      console.error('❌ SBTミント確認エラー:', err);
    } finally {
      setLoading(false);
    }
  }

  return { isMinted, loading, refetch: checkMinted };
}

/**
 * プロフィールSBTをミント（重複防止付き）
 */
export function useMintProfileSBT() {
  const address = useAddress();
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mintSBT(
    tenantId: string,
    rankLevel: number,
    kodomiValue: number,
    txHash?: string
  ): Promise<boolean> {
    if (!address) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setMinting(true);
      setError(null);

      // 重複チェック
      const { data: existing } = await supabase
        .from('profile_sbt_mints')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_address', address.toLowerCase())
        .eq('rank_level', rankLevel)
        .maybeSingle();

      if (existing) {
        setError('このランクのSBTは既にミント済みです');
        return false;
      }

      // ミント記録を保存
      const { error: insertError } = await supabase
        .from('profile_sbt_mints')
        .insert({
          tenant_id: tenantId,
          user_address: address.toLowerCase(),
          rank_level: rankLevel,
          kodomi_at_mint: kodomiValue,
          tx_hash: txHash || null,
        });

      if (insertError) throw insertError;

      console.log(`✅ プロフィールSBT Rank ${rankLevel} をミントしました`);
      return true;
    } catch (err) {
      console.error('❌ SBTミントエラー:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setMinting(false);
    }
  }

  return { mintSBT, minting, error };
}

/**
 * 自動SBTミント判定（kodomi値チェック）
 * kodomi値が閾値に達していて、まだミントしていないランクがあれば自動ミント
 */
export function useAutoMintProfileSBT(
  tenantId: string,
  kodomiValue: number,
  rankThresholds: Record<number, number> // { rankLevel: kodomiThreshold }
) {
  const { mintSBT, minting } = useMintProfileSBT();
  const [autoMinting, setAutoMinting] = useState(false);

  async function checkAndMint() {
    if (!tenantId || kodomiValue <= 0 || minting || autoMinting) return;

    try {
      setAutoMinting(true);

      // kodomi値が閾値を超えているランクを全て取得
      const eligibleRanks = Object.entries(rankThresholds)
        .filter(([_, threshold]) => kodomiValue >= threshold)
        .map(([rank]) => Number(rank))
        .sort((a, b) => a - b);

      if (eligibleRanks.length === 0) return;

      // 各ランクについて、ミント済みかチェックしてミント
      for (const rank of eligibleRanks) {
        await mintSBT(tenantId, rank, kodomiValue);
      }
    } catch (err) {
      console.error('❌ 自動SBTミントエラー:', err);
    } finally {
      setAutoMinting(false);
    }
  }

  return { checkAndMint, autoMinting };
}
