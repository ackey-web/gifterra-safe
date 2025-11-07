// src/hooks/useTenantRankPlan.ts
// テナントランクプラン管理Hooks

import { useState, useEffect } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';
import type { RankPlan } from '../types/tenantApplication';

/**
 * テナントランクプランデータ
 */
export interface TenantRankPlanData {
  id: string;
  tenant_id: number;
  rank_plan: RankPlan;
  is_active: boolean;
  subscription_start_date: string;
  subscription_end_date: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  notes: string | null;
  custom_token_address: string | null;
  custom_token_approved: boolean;
  custom_token_approved_by: string | null;
  custom_token_approved_at: string | null;
}

/**
 * テナントランクプラン設定フォーム
 */
export interface TenantRankPlanForm {
  tenant_id: number;
  rank_plan: RankPlan;
  is_active?: boolean;
  subscription_end_date?: string | null;
  notes?: string;
}

/**
 * 全テナントのランクプラン取得Hook
 */
export function useAllTenantRankPlans() {
  const [plans, setPlans] = useState<TenantRankPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenant_rank_plans')
        .select('*')
        .order('tenant_id', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('❌ テナントランクプランの取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { plans, loading, error, refetch: fetchPlans };
}

/**
 * 特定テナントのランクプラン取得Hook
 */
export function useTenantRankPlan(tenantId: string | null | undefined) {
  const [plan, setPlan] = useState<TenantRankPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId === null || tenantId === undefined) {
      setPlan(null);
      setLoading(false);
      return;
    }
    fetchPlan();
  }, [tenantId]);

  async function fetchPlan() {
    if (tenantId === null || tenantId === undefined) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenant_rank_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      setPlan(data);
    } catch (err) {
      console.error('❌ テナントランクプランの取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { plan, loading, error, refetch: fetchPlan };
}

/**
 * テナントランクプラン設定Hook (スーパーアドミン専用)
 */
export function useSetTenantRankPlan() {
  const adminAddress = useAddress();
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setPlan(formData: TenantRankPlanForm): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setSetting(true);
      setError(null);

      // 既存のプランをチェック
      const { data: existing } = await supabase
        .from('tenant_rank_plans')
        .select('*')
        .eq('tenant_id', formData.tenant_id)
        .maybeSingle();

      if (existing) {
        // 既存プランを更新
        const { error: updateError } = await supabase
          .from('tenant_rank_plans')
          .update({
            rank_plan: formData.rank_plan,
            is_active: formData.is_active ?? true,
            subscription_end_date: formData.subscription_end_date || null,
            notes: formData.notes || null,
            updated_by: adminAddress.toLowerCase(),
          })
          .eq('tenant_id', formData.tenant_id);

        if (updateError) throw updateError;
      } else {
        // 新規プラン作成
        const { error: insertError } = await supabase
          .from('tenant_rank_plans')
          .insert({
            tenant_id: formData.tenant_id,
            rank_plan: formData.rank_plan,
            is_active: formData.is_active ?? true,
            subscription_end_date: formData.subscription_end_date || null,
            notes: formData.notes || null,
            updated_by: adminAddress.toLowerCase(),
          });

        if (insertError) throw insertError;
      }

      return true;
    } catch (err) {
      console.error('❌ テナントランクプランの設定に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setSetting(false);
    }
  }

  return { setPlan, setting, error };
}

/**
 * テナントランクプラン削除Hook (スーパーアドミン専用)
 */
export function useDeleteTenantRankPlan() {
  const adminAddress = useAddress();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deletePlan(tenantId: number): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setDeleting(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('tenant_rank_plans')
        .delete()
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      console.error('❌ テナントランクプランの削除に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return { deletePlan, deleting, error };
}

/**
 * カスタムトークン承認Hook (スーパーアドミン専用)
 */
export function useApproveCustomToken() {
  const adminAddress = useAddress();
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approveToken(tenantId: number, tokenAddress: string): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setApproving(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('tenant_rank_plans')
        .update({
          custom_token_address: tokenAddress.toLowerCase(),
          custom_token_approved: true,
          custom_token_approved_by: adminAddress.toLowerCase(),
          custom_token_approved_at: new Date().toISOString(),
          updated_by: adminAddress.toLowerCase(),
        })
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('❌ カスタムトークンの承認に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setApproving(false);
    }
  }

  return { approveToken, approving, error };
}

/**
 * カスタムトークン承認取り消しHook (スーパーアドミン専用)
 */
export function useRevokeCustomToken() {
  const adminAddress = useAddress();
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revokeToken(tenantId: number): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setRevoking(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('tenant_rank_plans')
        .update({
          custom_token_approved: false,
          custom_token_approved_by: null,
          custom_token_approved_at: null,
          updated_by: adminAddress.toLowerCase(),
        })
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('❌ カスタムトークン承認の取り消しに失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setRevoking(false);
    }
  }

  return { revokeToken, revoking, error };
}
