// src/hooks/useRecipientTenantInfo.ts
// 受信者がテナントオーナーかどうかと自動配布設定を確認するHook

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RecipientTenantInfo {
  isTenant: boolean;
  tenantId: string | null;
  gifterraAddress: string | null;
  autoDistributionEnabled: boolean;
}

/**
 * 指定したウォレットアドレスがテナントオーナーかどうかと、
 * 自動配布設定を確認するHook
 *
 * @param recipientAddress 受信者のウォレットアドレス
 * @param debounceMs デバウンス時間（ミリ秒）
 */
export function useRecipientTenantInfo(
  recipientAddress: string | undefined,
  debounceMs: number = 300
) {
  const [tenantInfo, setTenantInfo] = useState<RecipientTenantInfo>({
    isTenant: false,
    tenantId: null,
    gifterraAddress: null,
    autoDistributionEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipientAddress) {
      setTenantInfo({
        isTenant: false,
        tenantId: null,
        gifterraAddress: null,
        autoDistributionEnabled: false,
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    // デバウンス処理
    const timer = setTimeout(() => {
      fetchTenantInfo(recipientAddress);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [recipientAddress, debounceMs]);

  async function fetchTenantInfo(address: string) {
    try {
      setIsLoading(true);
      setError(null);

      // tenant_applicationsテーブルから受信者がテナントオーナーかどうかを確認
      const { data, error: queryError } = await supabase
        .from('tenant_applications')
        .select('id, tenant_id, gifterra_address, auto_distribution_enabled')
        .eq('applicant_address', address.toLowerCase())
        .eq('status', 'approved')
        .maybeSingle();

      if (queryError) throw queryError;

      if (data && data.gifterra_address) {
        // テナントオーナーかつGifterraコントラクトが設定されている
        setTenantInfo({
          isTenant: true,
          tenantId: data.tenant_id,
          gifterraAddress: data.gifterra_address,
          autoDistributionEnabled: data.auto_distribution_enabled ?? false,
        });
      } else {
        // テナントオーナーではない、またはGifterraコントラクト未設定
        setTenantInfo({
          isTenant: false,
          tenantId: null,
          gifterraAddress: null,
          autoDistributionEnabled: false,
        });
      }
    } catch (err) {
      console.error('❌ テナント情報の取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTenantInfo({
        isTenant: false,
        tenantId: null,
        gifterraAddress: null,
        autoDistributionEnabled: false,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return { tenantInfo, isLoading, error };
}
