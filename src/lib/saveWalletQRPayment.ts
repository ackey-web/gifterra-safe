// src/lib/saveWalletQRPayment.ts
// ウォレットQR決済の軽量トラッキング（プライバシー保護設計）

import { supabase } from './supabase';
import type { WalletQRData } from '../types/qrPayment';

/**
 * ウォレットQR決済をSupabaseに記録
 *
 * 【プライバシー保護】
 * - 顧客のウォレットアドレスは記録しない
 * - 顧客のGIFTERRAユーザー情報は一切保存しない
 * - トランザクションハッシュ、金額、タイムスタンプのみ記録
 *
 * @param params 決済パラメータ
 */
export async function saveWalletQRPayment(params: {
  walletData: WalletQRData;
  amount: string;
  message?: string;
  transactionHash: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { walletData, amount, message, transactionHash } = params;

    // payment_requests テーブルに記録
    const { error } = await supabase.from('payment_requests').insert({
      request_id: `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      tenant_address: walletData.address.toLowerCase(), // 店舗アドレス（受取側）
      amount: amount,
      message: message || `${walletData.name || '店舗'}への支払い`,
      payment_type: 'wallet', // ウォレットQR方式
      transaction_hash: transactionHash,
      paid_from_address: null, // プライバシー保護: 顧客アドレスは記録しない
      status: 'completed', // トランザクション完了後に記録するため常にcompleted
      created_at: new Date().toISOString(),
      expires_at: null, // ウォレットQRには有効期限がない
    });

    if (error) {
      console.error('❌ ウォレットQR決済の記録失敗:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ ウォレットQR決済を記録:', {
      transactionHash,
      amount,
      merchantAddress: walletData.address,
    });

    return { success: true };
  } catch (error: any) {
    console.error('❌ ウォレットQR決済の記録エラー:', error);
    return { success: false, error: error.message || '記録に失敗しました' };
  }
}
