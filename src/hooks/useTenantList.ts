// src/hooks/useTenantList.ts
// テナント一覧管理フック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TenantConfig } from '../admin/contexts/TenantContext';
import { CONTRACT_ADDRESS, TOKEN } from '../contract';

/**
 * テナント情報（拡張版）
 */
export interface TenantInfo extends TenantConfig {
  // 統計情報
  stats?: {
    totalHubs: number;
    activeHubs: number;
    totalRevenue: string; // wei
    totalDistributions: number;
    userCount: number;
  };

  // ヘルス状態
  health: {
    status: 'healthy' | 'warning' | 'error';
    lastChecked: Date;
    issues: string[];
  };

  // オーナー情報
  owner: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * テナント一覧取得フック
 */
export function useTenantList() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      setIsLoading(true);

      // tenant_applicationsから承認済みテナントを取得
      const { data: applications, error: fetchError } = await supabase
        .from('tenant_applications')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const tenantList: TenantInfo[] = [];

      if (applications && applications.length > 0) {
        for (const app of applications) {
          const tenant: TenantInfo = {
            id: app.id, // UUIDをテナントIDとして使用
            name: app.tenant_name,
            contracts: {
              gifterra: app.gifterra_address || CONTRACT_ADDRESS,
              rewardToken: TOKEN.ADDRESS,
              paymentSplitter: app.pay_splitter_address || '0x0000000000000000000000000000000000000000',
              rewardNFT: app.reward_nft_address,
              flagNFT: app.flag_nft_address,
              randomRewardEngine: app.random_reward_engine_address,
            },
            owner: app.applicant_address,
            createdAt: app.created_at,
            updatedAt: app.approved_at,
            health: {
              status: 'healthy', // TODO: 実際のヘルスチェック実装
              lastChecked: new Date(),
              issues: [],
            },
            stats: {
              totalHubs: 0, // TODO: コントラクトまたはDBから取得
              activeHubs: 0,
              totalRevenue: '0',
              totalDistributions: 0,
              userCount: 0,
            },
          };

          tenantList.push(tenant);
        }
      }

      setTenants(tenantList);
      setError(null);
    } catch (err) {
      console.error('❌ テナント一覧の取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tenants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();

    // 1分ごとに更新
    const interval = setInterval(fetchTenants, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    tenants,
    isLoading,
    error,
    refetch: fetchTenants,
  };
}

/**
 * 特定テナントの詳細情報取得
 */
export function useTenantDetail(tenantId: string) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenantDetail = async () => {
      try {
        setIsLoading(true);

        // TODO: Supabaseから取得
        // 現在はデフォルトテナントのみ対応
        if (tenantId !== 'default') {
          throw new Error('Tenant not found');
        }

        const defaultTenant: TenantInfo = {
          id: 'default',
          name: 'METATRON Default',
          contracts: {
            gifterra: CONTRACT_ADDRESS,
            rewardToken: TOKEN.ADDRESS,
          },
          owner: '0x66f1274ad5d042b7571c2efa943370dbcd3459ab',
          createdAt: new Date().toISOString(),
          health: {
            status: 'healthy',
            lastChecked: new Date(),
            issues: [],
          },
        };

        setTenant(defaultTenant);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tenant');
      } finally {
        setIsLoading(false);
      }
    };

    if (tenantId) {
      fetchTenantDetail();
    }
  }, [tenantId]);

  return {
    tenant,
    isLoading,
    error,
  };
}
