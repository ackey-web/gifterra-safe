// src/hooks/useTenantApplications.ts
// テナント申請管理Hooks

import { useState, useEffect } from 'react';
import { useAddress, useContract, useContractWrite } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';
import type { TenantApplication, TenantApplicationForm, ApplicationStatus } from '../types/tenantApplication';
import { rankPlanToContractValue } from '../types/tenantApplication';
import { GIFTERRA_FACTORY_ADDRESS, GIFTERRA_FACTORY_ABI, TNHT_TOKEN } from '../contract';

/**
 * テナント申請リスト取得Hook
 * @param status フィルター用ステータス (optional)
 */
export function useTenantApplications(status?: ApplicationStatus) {
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, [status]);

  async function fetchApplications() {
    try {
      setLoading(true);
      let query = supabase
        .from('tenant_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      setApplications(data || []);
    } catch (err) {
      console.error('❌ テナント申請の取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { applications, loading, error, refetch: fetchApplications };
}

/**
 * 自分のテナント申請状況取得Hook
 */
export function useMyTenantApplication() {
  const address = useAddress();
  const [application, setApplication] = useState<TenantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setApplication(null);
      setLoading(false);
      return;
    }
    fetchMyApplication();
  }, [address]);

  async function fetchMyApplication() {
    if (!address) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenant_applications')
        .select('*')
        .eq('applicant_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      setApplication(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error('❌ 自分の申請の取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { application, loading, error, refetch: fetchMyApplication };
}

/**
 * テナント申請送信Hook
 */
export function useSubmitTenantApplication() {
  const address = useAddress();
  const { contract: factoryContract } = useContract(GIFTERRA_FACTORY_ADDRESS, GIFTERRA_FACTORY_ABI);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: TenantApplicationForm): Promise<boolean> {
    if (!address) {
      setError('ウォレットが接続されていません');
      return false;
    }

    // 既存テナント保有チェック
    if (factoryContract) {
      try {
        const tenantId = await factoryContract.call('getTenantIdByAdmin', [address]);
        if (tenantId && Number(tenantId) > 0) {
          setError('既にテナントを保有しています');
          return false;
        }
      } catch (err) {
        // テナント未保有の場合はエラーになるので無視
      }
    }

    // pending申請の重複チェック
    const { data: existingApp } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', address.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existingApp) {
      setError('既に申請中です。承認をお待ちください。');
      return false;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('tenant_applications')
        .insert({
          applicant_address: address.toLowerCase(),
          tenant_name: formData.tenant_name,
          description: formData.description || null,
          rank_plan: formData.rank_plan,
          custom_token_address: formData.has_custom_token ? formData.custom_token_address : null,
          custom_token_reason: formData.has_custom_token ? formData.custom_token_reason : null,
          status: 'pending',
        });

      if (insertError) throw insertError;

      return true;
    } catch (err) {
      console.error('❌ テナント申請の送信に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}

/**
 * テナント申請承認Hook (スーパーアドミン専用)
 */
export function useApproveTenantApplication() {
  const adminAddress = useAddress();
  const { contract: factoryContract } = useContract(GIFTERRA_FACTORY_ADDRESS, GIFTERRA_FACTORY_ABI);
  const { mutateAsync: createTenant } = useContractWrite(factoryContract, 'createTenant');
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve(application: TenantApplication): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    if (!factoryContract) {
      setError('コントラクトが初期化されていません');
      return false;
    }

    try {
      setApproving(true);
      setError(null);

      // createTenant トランザクション実行
      const rankPlanValue = rankPlanToContractValue(application.rank_plan);
      const tx = await createTenant({
        args: [
          application.tenant_name,
          application.applicant_address,
          TNHT_TOKEN.address, // rewardTokenAddress: NHT固定
          application.applicant_address, // tipWalletAddress: 申請者自身
          rankPlanValue,
        ],
      });

      // トランザクションからテナントIDとコントラクトアドレスを取得
      const receipt = tx.receipt;
      const event = receipt.events?.find((e: any) => e.event === 'TenantCreated');

      // TenantCreated イベントの全パラメータを抽出
      const tenantId = event?.args?.tenantId;
      const gifterraAddress = event?.args?.gifterra;
      const rewardNFTAddress = event?.args?.rewardNFT;
      const paySplitterAddress = event?.args?.payLitter; // Note: イベントでは "payLitter" という名前
      const flagNFTAddress = event?.args?.flagNFT;
      const randomRewardEngineAddress = event?.args?.randomRewardEngine;

      // DB更新: 承認済みに変更 + コントラクトアドレスを保存
      const { error: updateError } = await supabase
        .from('tenant_applications')
        .update({
          status: 'approved',
          approved_by: adminAddress.toLowerCase(),
          approved_at: new Date().toISOString(),
          tenant_id: tenantId ? Number(tenantId) : null,
          gifterra_address: gifterraAddress || null,
          reward_nft_address: rewardNFTAddress || null,
          pay_splitter_address: paySplitterAddress || null,
          flag_nft_address: flagNFTAddress || null,
          random_reward_engine_address: randomRewardEngineAddress || null,
        })
        .eq('id', application.id);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('❌ テナント申請の承認に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setApproving(false);
    }
  }

  return { approve, approving, error };
}

/**
 * テナント申請拒否Hook (スーパーアドミン専用)
 */
export function useRejectTenantApplication() {
  const adminAddress = useAddress();
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reject(applicationId: string, reason: string): Promise<boolean> {
    if (!adminAddress) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setRejecting(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('tenant_applications')
        .update({
          status: 'rejected',
          approved_by: adminAddress.toLowerCase(),
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('❌ テナント申請の拒否に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setRejecting(false);
    }
  }

  return { reject, rejecting, error };
}

/**
 * テナント情報更新Hook（テナントオーナー専用）
 */
export function useUpdateTenantInfo() {
  const address = useAddress();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateTenantInfo(
    applicationId: string,
    updates: {
      tenant_name?: string;
      description?: string;
      auto_distribution_enabled?: boolean;
    }
  ): Promise<boolean> {
    if (!address) {
      setError('ウォレットが接続されていません');
      return false;
    }

    try {
      setUpdating(true);
      setError(null);

      // 申請者本人かどうか確認
      const { data: application, error: fetchError } = await supabase
        .from('tenant_applications')
        .select('applicant_address')
        .eq('id', applicationId)
        .single();

      if (fetchError) throw fetchError;

      if (application.applicant_address.toLowerCase() !== address.toLowerCase()) {
        setError('この操作を実行する権限がありません');
        return false;
      }

      // テナント情報を更新
      const { error: updateError } = await supabase
        .from('tenant_applications')
        .update(updates)
        .eq('id', applicationId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('❌ テナント情報の更新に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setUpdating(false);
    }
  }

  return { updateTenantInfo, updating, error };
}
