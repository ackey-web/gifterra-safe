// src/hooks/useTenantKodomi.ts
// テナント所有者のkodomi値を取得・監視するHook

import { useState, useEffect } from 'react';
import { useContract, useContractRead } from '@thirdweb-dev/react';
import { CONTRACT_ABI, getGifterraAddress } from '../contract';

/**
 * テナント所有者のkodomi値を取得・リアルタイム監視
 * @param tenantAddress テナント所有者のウォレットアドレス
 * @param refreshInterval リフレッシュ間隔（ミリ秒）デフォルト: 5秒
 */
export function useTenantKodomi(tenantAddress: string, refreshInterval: number = 5000) {
  const [kodomi, setKodomi] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const gifterraAddress = getGifterraAddress();
  const { contract } = useContract(gifterraAddress, CONTRACT_ABI);

  // コントラクトからkodomi値を取得
  const { data: kodomiData, isLoading, refetch } = useContractRead(
    contract,
    'getUserKodomi',
    [tenantAddress]
  );

  useEffect(() => {
    if (kodomiData !== undefined) {
      const newKodomi = Number(kodomiData);
      setKodomi(newKodomi);
      setLoading(false);
    }
  }, [kodomiData]);

  // 定期的にkodomi値を更新
  useEffect(() => {
    if (!tenantAddress || !contract) return;

    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [tenantAddress, contract, refreshInterval, refetch]);

  return {
    kodomi,
    loading: loading || isLoading,
    refetch
  };
}
