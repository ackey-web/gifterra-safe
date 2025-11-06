// src/hooks/useRankPlanPricing.ts
// ランクプラン価格管理Hooks

import { useState, useEffect } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';
import type { RankPlan } from '../types/tenantApplication';

/**
 * ランクプラン価格データ
 */
export interface RankPlanPricing {
  id: string;
  rank_plan: RankPlan;
  price_jpy: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * 価格更新フォーム
 */
export interface PriceUpdateForm {
  rank_plan: RankPlan;
  price_jpy: number;
}

/**
 * 全プラン価格取得Hook
 */
export function useRankPlanPricing() {
  const [pricing, setPricing] = useState<RankPlanPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPricing();
  }, []);

  async function fetchPricing() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rank_plan_pricing')
        .select('*')
        .order('price_jpy', { ascending: true });

      if (error) throw error;
      setPricing(data || []);
    } catch (err) {
      console.error('❌ ランクプラン価格の取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { pricing, loading, error, refetch: fetchPricing };
}

/**
 * 特定プランの価格取得Hook
 */
export function getPlanPrice(pricing: RankPlanPricing[], plan: RankPlan): number {
  const found = pricing.find(p => p.rank_plan === plan);

  // デフォルト価格（DBにデータがない場合のフォールバック）
  const defaults: Record<RankPlan, number> = {
    STUDIO: 1500,
    STUDIO_PRO: 3800,
    STUDIO_PRO_MAX: 9800,
  };

  return found ? found.price_jpy : defaults[plan];
}

/**
 * 価格更新Hook (スーパーアドミン専用)
 */
export function useUpdateRankPlanPrice() {
  const adminAddress = useAddress();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePrice(formData: PriceUpdateForm): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    if (formData.price_jpy < 0) {
      setError('価格は0以上の値を入力してください');
      return false;
    }

    try {
      setUpdating(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('rank_plan_pricing')
        .update({
          price_jpy: formData.price_jpy,
          updated_by: adminAddress.toLowerCase(),
        })
        .eq('rank_plan', formData.rank_plan);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('❌ ランクプラン価格の更新に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setUpdating(false);
    }
  }

  return { updatePrice, updating, error };
}
