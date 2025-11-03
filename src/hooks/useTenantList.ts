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

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setIsLoading(true);

        // TODO: 将来的にSupabaseのtenantsテーブルから取得
        // 現在はデフォルトテナントのみ
        const defaultTenant: TenantInfo = {
          id: 'default',
          name: 'METATRON Default',
          contracts: {
            gifterra: CONTRACT_ADDRESS,
            rewardToken: TOKEN.ADDRESS,
            paymentSplitter: '0x0000000000000000000000000000000000000000',
          },
          owner: '0x66f1274ad5d042b7571c2efa943370dbcd3459ab',
          createdAt: new Date().toISOString(),
          health: {
            status: 'healthy',
            lastChecked: new Date(),
            issues: [],
          },
        };

        // デフォルトテナントの統計情報を取得
        const { data: hubs } = await supabase
          .from('vending_machines')
          .select('id, is_active, total_distributions');

        const { data: purchases } = await supabase
          .from('purchase_history')
          .select('amount');

        defaultTenant.stats = {
          totalHubs: hubs?.length || 0,
          activeHubs: hubs?.filter(h => h.is_active).length || 0,
          totalRevenue: purchases?.reduce((sum, p) => sum + BigInt(p.amount || 0), BigInt(0)).toString() || '0',
          totalDistributions: hubs?.reduce((sum, h) => sum + (h.total_distributions || 0), 0) || 0,
          userCount: 0, // TODO: コントラクトから取得
        };

        setTenants([defaultTenant]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tenants');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();

    // 1分ごとに更新
    const interval = setInterval(fetchTenants, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    tenants,
    isLoading,
    error,
    refetch: () => setIsLoading(true),
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
