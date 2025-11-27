// src/hooks/useUserContribution.ts
// 特定のテナントに対するユーザーの貢献度を取得するフック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserContribution {
  kodomi: number; // composite_score = 貢献熱量度
  economicScore: number;
  resonanceScore: number;
  isLoading: boolean;
  error: Error | null;
}

/**
 * 特定のテナント（プロフィール所有者）に対する、現在のユーザーの貢献度を取得
 *
 * @param currentUserAddress - 現在ログイン中のユーザーのアドレス
 * @param tenantAddress - プロフィール所有者（テナント）のアドレス
 * @returns ユーザーの貢献度データ
 */
export function useUserContribution(
  currentUserAddress: string | null,
  tenantAddress: string | null
): UserContribution {
  const [kodomi, setKodomi] = useState<number>(0);
  const [economicScore, setEconomicScore] = useState<number>(0);
  const [resonanceScore, setResonanceScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchContribution() {
      // アドレスが両方揃っていない場合はスキップ
      if (!currentUserAddress || !tenantAddress) {
        setKodomi(0);
        setEconomicScore(0);
        setResonanceScore(0);
        setIsLoading(false);
        return;
      }

      // 自分自身のプロフィールを見ている場合は貢献度を表示しない
      if (currentUserAddress.toLowerCase() === tenantAddress.toLowerCase()) {
        setKodomi(0);
        setEconomicScore(0);
        setResonanceScore(0);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // tenant_scoresテーブルから貢献度を取得
        const { data, error: fetchError } = await supabase
          .from('tenant_scores')
          .select('economic_score, resonance_score, composite_score')
          .eq('user_address', currentUserAddress.toLowerCase())
          .eq('tenant_id', tenantAddress.toLowerCase())
          .maybeSingle();

        if (fetchError) {
          console.error('❌ 貢献度データ取得エラー:', fetchError);
          throw fetchError;
        }

        if (data) {
          setKodomi(Math.round(Number(data.composite_score) || 0));
          setEconomicScore(Math.round(Number(data.economic_score) || 0));
          setResonanceScore(Math.round(Number(data.resonance_score) || 0));
        } else {
          // データが存在しない場合は0
          setKodomi(0);
          setEconomicScore(0);
          setResonanceScore(0);
        }
      } catch (err) {
        console.error('❌ useUserContribution エラー:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setKodomi(0);
        setEconomicScore(0);
        setResonanceScore(0);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContribution();
  }, [currentUserAddress, tenantAddress]);

  return {
    kodomi,
    economicScore,
    resonanceScore,
    isLoading,
    error,
  };
}
