// src/utils/transactionSecurity.ts
// トランザクションセキュリティチェック

import { supabase } from '../lib/supabase';

export interface TransactionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  isSuspicious?: boolean;
  isFrozen?: boolean;
  freezeReason?: string;
  isHighAmount?: boolean;
  anomalyScore?: number;
  anomalyReasons?: string[];
}

/**
 * アカウントが凍結されているかチェック
 */
export async function checkAccountFrozen(walletAddress: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_frozen')
      .eq('tenant_id', 'default')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Failed to check account frozen status:', error);
      return false;
    }

    return data?.is_frozen === true;
  } catch (err) {
    console.error('Error checking frozen status:', err);
    return false;
  }
}

/**
 * トランザクション制限をチェック
 */
export async function checkTransactionLimits(
  walletAddress: string,
  amount: number
): Promise<TransactionCheckResult> {
  try {
    // アカウント凍結チェック
    const isFrozen = await checkAccountFrozen(walletAddress);
    if (isFrozen) {
      return {
        allowed: false,
        reason: 'このアカウントは凍結されています。詳細はサポートにお問い合わせください。',
      };
    }

    // PostgreSQL関数を呼び出して制限チェック
    const { data, error } = await supabase.rpc('check_transaction_limits', {
      p_wallet_address: walletAddress.toLowerCase(),
      p_amount: amount,
      p_tenant_id: 'default',
    });

    if (error) {
      console.error('Failed to check transaction limits:', error);
      // エラー時は安全側に倒して拒否
      return {
        allowed: false,
        reason: 'セキュリティチェックに失敗しました。しばらくしてから再度お試しください。',
      };
    }

    if (!data || data.length === 0) {
      return { allowed: true };
    }

    const result = data[0];

    return {
      allowed: result.allowed,
      reason: result.reason !== 'OK' ? result.reason : undefined,
    };
  } catch (err) {
    console.error('Error checking transaction limits:', err);
    return {
      allowed: false,
      reason: 'セキュリティチェックでエラーが発生しました',
    };
  }
}

/**
 * 異常検知チェック
 */
export async function detectTransactionAnomaly(
  walletAddress: string,
  amount: number
): Promise<TransactionCheckResult> {
  try {
    // PostgreSQL関数を呼び出して異常検知
    const { data, error } = await supabase.rpc('detect_transaction_anomaly', {
      p_wallet_address: walletAddress.toLowerCase(),
      p_amount: amount,
      p_tenant_id: 'default',
    });

    if (error) {
      console.error('Failed to detect anomaly:', error);
      // エラー時は続行を許可（検知失敗は送金を止めない）
      return { allowed: true };
    }

    if (!data || data.length === 0) {
      return { allowed: true };
    }

    const result = data[0];

    if (result.is_suspicious) {
      return {
        allowed: true, // 疑わしいが送金は許可
        requiresConfirmation: true, // 追加確認を要求
        isSuspicious: true,
        anomalyScore: result.anomaly_score,
        anomalyReasons: result.reasons,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('Error detecting anomaly:', err);
    return { allowed: true };
  }
}

/**
 * 高額送金チェック
 */
export async function checkHighAmountTransaction(amount: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('security_settings')
      .select('high_amount_threshold')
      .eq('tenant_id', 'default')
      .single();

    if (error || !data) {
      // デフォルト値: 50,000 JPYC
      return amount >= 50000;
    }

    return amount >= data.high_amount_threshold;
  } catch (err) {
    console.error('Error checking high amount:', err);
    return amount >= 50000;
  }
}

/**
 * 送金前の包括的なセキュリティチェック
 */
export async function performTransactionSecurityCheck(
  walletAddress: string,
  amount: number
): Promise<TransactionCheckResult> {
  // 1. アカウント凍結チェック
  const isFrozen = await checkAccountFrozen(walletAddress);
  if (isFrozen) {
    return {
      allowed: false,
      isFrozen: true,
      freezeReason: 'このアカウントは凍結されています',
      reason: 'このアカウントは凍結されています',
    };
  }

  // 2. トランザクション制限チェック
  const limitResult = await checkTransactionLimits(walletAddress, amount);
  if (!limitResult.allowed) {
    return limitResult;
  }

  // 3. 異常検知チェック
  const anomalyResult = await detectTransactionAnomaly(walletAddress, amount);

  // 4. 高額送金チェック
  const isHighAmount = await checkHighAmountTransaction(amount);

  return {
    allowed: true,
    isFrozen: false,
    requiresConfirmation: isHighAmount || anomalyResult.requiresConfirmation,
    isHighAmount,
    isSuspicious: anomalyResult.isSuspicious,
    anomalyScore: anomalyResult.anomalyScore,
    anomalyReasons: anomalyResult.anomalyReasons,
  };
}

/**
 * トランザクション履歴を記録
 */
export async function recordTransaction(
  fromAddress: string,
  toAddress: string,
  amount: number,
  txHash?: string,
  isSuspicious?: boolean,
  anomalyScore?: number,
  anomalyReasons?: string[]
) {
  try {
    const { error } = await supabase.from('transaction_history').insert({
      tenant_id: 'default',
      from_address: fromAddress.toLowerCase(),
      to_address: toAddress.toLowerCase(),
      amount,
      token_symbol: 'JPYC',
      tx_hash: txHash,
      is_suspicious: isSuspicious || false,
      anomaly_score: anomalyScore,
      anomaly_reasons: anomalyReasons,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to record transaction:', error);
    }
  } catch (err) {
    console.error('Error recording transaction:', err);
  }
}
