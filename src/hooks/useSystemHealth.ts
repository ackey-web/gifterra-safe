// src/hooks/useSystemHealth.ts
// システムヘルスチェックフック

import { useState, useEffect } from 'react';
import { useContract, useContractRead } from '@thirdweb-dev/react';
import { SBT_CONTRACT, JPYC_TOKEN } from '../contract';
import { supabase } from '../lib/supabase';
import { publicClient } from '../contract';

/**
 * ヘルスステータス
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down';

/**
 * サービスヘルス情報
 */
export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number; // ms
  lastChecked: Date;
  error?: string;
}

/**
 * システム全体のヘルス情報
 */
export interface SystemHealth {
  overall: HealthStatus;
  services: {
    blockchain: ServiceHealth;
    supabase: ServiceHealth;
    rpc: ServiceHealth;
    contracts: ServiceHealth;
  };
  lastChecked: Date;
}

/**
 * システムヘルスチェックフック
 */
export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>({
    overall: 'healthy',
    services: {
      blockchain: {
        name: 'Blockchain',
        status: 'healthy',
        lastChecked: new Date(),
      },
      supabase: {
        name: 'Supabase',
        status: 'healthy',
        lastChecked: new Date(),
      },
      rpc: {
        name: 'RPC Provider',
        status: 'healthy',
        lastChecked: new Date(),
      },
      contracts: {
        name: 'Smart Contracts',
        status: 'healthy',
        lastChecked: new Date(),
      },
    },
    lastChecked: new Date(),
  });

  const [isChecking, setIsChecking] = useState(false);

  // Gifterraコントラクトの接続チェック
  const { contract: gifterraContract } = useContract(SBT_CONTRACT.ADDRESS);
  const { data: contractPaused, isLoading: isCheckingContract } = useContractRead(
    gifterraContract,
    'paused'
  );

  /**
   * ヘルスチェック実行
   */
  const checkHealth = async () => {
    setIsChecking(true);
    const newHealth: SystemHealth = {
      overall: 'healthy',
      services: {
        blockchain: { name: 'Blockchain', status: 'healthy', lastChecked: new Date() },
        supabase: { name: 'Supabase', status: 'healthy', lastChecked: new Date() },
        rpc: { name: 'RPC Provider', status: 'healthy', lastChecked: new Date() },
        contracts: { name: 'Smart Contracts', status: 'healthy', lastChecked: new Date() },
      },
      lastChecked: new Date(),
    };

    // RPC接続チェック
    try {
      const start = Date.now();
      await publicClient.getBlockNumber();
      const responseTime = Date.now() - start;

      newHealth.services.rpc = {
        name: 'RPC Provider',
        status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'down',
        responseTime,
        lastChecked: new Date(),
      };
    } catch (err) {
      newHealth.services.rpc = {
        name: 'RPC Provider',
        status: 'down',
        lastChecked: new Date(),
        error: err instanceof Error ? err.message : 'RPC connection failed',
      };
    }

    // Supabase接続チェック
    try {
      const start = Date.now();
      const { error } = await supabase.from('vending_machines').select('id').limit(1);
      const responseTime = Date.now() - start;

      if (error) throw error;

      newHealth.services.supabase = {
        name: 'Supabase',
        status: responseTime < 500 ? 'healthy' : responseTime < 2000 ? 'degraded' : 'down',
        responseTime,
        lastChecked: new Date(),
      };
    } catch (err) {
      newHealth.services.supabase = {
        name: 'Supabase',
        status: 'down',
        lastChecked: new Date(),
        error: err instanceof Error ? err.message : 'Supabase connection failed',
      };
    }

    // コントラクト状態チェック
    try {
      if (contractPaused === true) {
        newHealth.services.contracts = {
          name: 'Smart Contracts',
          status: 'degraded',
          lastChecked: new Date(),
          error: 'Contract is paused',
        };
      } else {
        newHealth.services.contracts = {
          name: 'Smart Contracts',
          status: 'healthy',
          lastChecked: new Date(),
        };
      }
    } catch (err) {
      newHealth.services.contracts = {
        name: 'Smart Contracts',
        status: 'down',
        lastChecked: new Date(),
        error: err instanceof Error ? err.message : 'Contract check failed',
      };
    }

    // 全体ステータスを判定
    const statuses = Object.values(newHealth.services).map(s => s.status);
    if (statuses.some(s => s === 'down')) {
      newHealth.overall = 'down';
    } else if (statuses.some(s => s === 'degraded')) {
      newHealth.overall = 'degraded';
    } else {
      newHealth.overall = 'healthy';
    }

    setHealth(newHealth);
    setIsChecking(false);
  };

  useEffect(() => {
    // 初回チェック
    checkHealth();

    // 1分ごとに自動チェック
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [contractPaused]);

  return {
    health,
    isChecking,
    refetch: checkHealth,
  };
}

/**
 * ヘルスステータスの表示情報を取得
 */
export function getHealthStatusInfo(status: HealthStatus): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case 'healthy':
      return { label: '正常', color: '#10b981', icon: '✅' };
    case 'degraded':
      return { label: '低下', color: '#f59e0b', icon: '⚠️' };
    case 'down':
      return { label: 'ダウン', color: '#ef4444', icon: '❌' };
    default:
      return { label: '不明', color: '#6b7280', icon: '❓' };
  }
}
