// src/hooks/useVendingMachine.ts
// GIFT HUB設定を取得するフック
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { VendingMachine } from '../types/vending';

interface UseVendingMachineOptions {
  slug?: string | null;
}

interface UseVendingMachineResult {
  machine: VendingMachine | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * GIFT HUB設定を取得
 * @param options.slug HUBスラッグ
 */
export function useVendingMachine(options: UseVendingMachineOptions): UseVendingMachineResult {
  const { slug } = options;
  const [machine, setMachine] = useState<VendingMachine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) {
      setMachine(null);
      setIsLoading(false);
      return;
    }

    const fetchMachine = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('vending_machines')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          // Supabaseのスネークケースをキャメルケースに変換
          const mappedMachine: VendingMachine = {
            id: data.id,
            slug: data.slug,
            name: data.name,
            location: data.location || '',
            description: data.description || '',
            products: [], // 商品は別途取得
            isActive: data.is_active,
            totalSales: data.total_sales || 0,
            totalAccessCount: data.total_access_count || 0,
            totalDistributions: data.total_distributions || 0,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            tenantUuid: data.tenant_uuid,
            tenantId: data.tenant_id,
            settings: data.settings || {
              theme: 'default',
              displayName: data.name,
              welcomeMessage: 'いらっしゃいませ！',
              thankYouMessage: 'ありがとうございました！',
              maxSelectionsPerUser: 3,
              operatingHours: { start: '00:00', end: '23:59' },
              acceptedToken: 'NHT'
            }
          };

          setMachine(mappedMachine);
        } else {
          setMachine(null);
        }
      } catch (err) {
        console.error('❌ [useVendingMachine] Error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch vending machine'));
        setMachine(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMachine();
  }, [slug]);

  return { machine, isLoading, error };
}
