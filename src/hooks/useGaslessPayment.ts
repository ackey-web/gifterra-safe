// EIP-3009 Gasless Payment Hooks

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  GaslessPaymentRequest,
  CreateGaslessPaymentRequest,
  SignGaslessPaymentRequest,
} from '../types/gaslessPayment';

// Generate 6-digit PIN
export function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create gasless payment request
export async function createGaslessPaymentRequest(
  data: CreateGaslessPaymentRequest
): Promise<{ data: GaslessPaymentRequest | null; error: Error | null }> {
  try {
    const { data: result, error } = await supabase
      .from('gasless_payment_requests')
      .insert([
        {
          pin: data.pin,
          nonce: data.nonce,
          merchant_address: data.merchant_address,
          amount: data.amount,
          valid_before: data.valid_before,
          valid_after: data.valid_after || 0,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating gasless payment request:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: result as GaslessPaymentRequest, error: null };
  } catch (err) {
    console.error('Error creating gasless payment request:', err);
    return { data: null, error: err as Error };
  }
}

// Get gasless payment request by PIN
export async function getGaslessPaymentRequestByPIN(
  pin: string
): Promise<{ data: GaslessPaymentRequest | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('gasless_payment_requests')
      .select('*')
      .eq('pin', pin)
      .single();

    if (error) {
      console.error('Error fetching gasless payment request:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as GaslessPaymentRequest, error: null };
  } catch (err) {
    console.error('Error fetching gasless payment request:', err);
    return { data: null, error: err as Error };
  }
}

// Update gasless payment request with signature
export async function signGaslessPaymentRequest(
  pin: string,
  signatureData: SignGaslessPaymentRequest
): Promise<{ error: Error | null }> {
  try {
    console.warn('🔐 [SIGN] Supabaseに署名を保存開始 - PIN:', pin);

    const { data, error } = await supabase
      .from('gasless_payment_requests')
      .update({
        from_address: signatureData.from_address,
        signature_v: signatureData.signature_v,
        signature_r: signatureData.signature_r,
        signature_s: signatureData.signature_s,
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('pin', pin) // PINでフィルタリングに変更
      .select();

    if (error) {
      console.error('❌ [SIGN] Supabaseエラー:', error);
      return { error: new Error(error.message) };
    }

    // 0件更新の場合はエラーを返す（サイレント失敗を防ぐ）
    if (!data || data.length === 0) {
      const errorMsg = `PIN "${pin}" が見つかりません。リクエストが期限切れまたは無効です。`;
      console.error('❌ [SIGN] 更新件数0件 - PIN not found:', pin);
      return { error: new Error(errorMsg) };
    }

    console.warn('✅ [SIGN] 署名保存成功 - 更新件数:', data.length, 'Status: signed');
    return { error: null };
  } catch (err) {
    console.error('❌ [SIGN] 予期しないエラー:', err);
    return { error: err as Error };
  }
}

// Mark gasless payment request as completed
export async function completeGaslessPaymentRequest(
  id: string,
  txHash?: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('gasless_payment_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: txHash ? `Success: ${txHash}` : null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error completing gasless payment request:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('Error completing gasless payment request:', err);
    return { error: err as Error };
  }
}

// Mark gasless payment request as failed
export async function failGaslessPaymentRequest(
  id: string,
  errorMessage: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('gasless_payment_requests')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq('id', id);

    if (error) {
      console.error('Error failing gasless payment request:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('Error failing gasless payment request:', err);
    return { error: err as Error };
  }
}

// Subscribe to gasless payment request changes
export function useGaslessPaymentRequestSubscription(
  requestId: string | null,
  onUpdate: (request: GaslessPaymentRequest) => void
) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribe = () => {
    if (!requestId || isSubscribed) return;

    const subscription = supabase
      .channel(`gasless_payment_request:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gasless_payment_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          console.log('Gasless payment request updated:', payload);
          onUpdate(payload.new as GaslessPaymentRequest);
        }
      )
      .subscribe();

    setIsSubscribed(true);

    return () => {
      subscription.unsubscribe();
      setIsSubscribed(false);
    };
  };

  return { subscribe, isSubscribed };
}
