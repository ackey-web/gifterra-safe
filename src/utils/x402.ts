// src/utils/x402.ts
// X402プロトコルを使った決済QRコードのエンコード/デコード

import { ethers } from 'ethers';

export interface X402PaymentData {
  to: string;           // 受取アドレス
  token: string;        // トークンアドレス (JPYC)
  amount: string;       // Wei単位の金額
  message?: string;     // メモ/説明
  expires?: number;     // 有効期限 (Unix timestamp)
  requestId?: string;   // リクエストID (重複防止)
}

/**
 * X402形式の決済データをJSONエンコード
 *
 * @param data 決済データ
 * @returns JSON文字列
 */
export function encodeX402(data: X402PaymentData): string {
  // シンプルなJSON形式でエンコード
  // 実際のX402仕様に合わせて調整可能
  const payload = {
    version: '1.0',
    type: 'payment',
    to: data.to.toLowerCase(),
    token: data.token.toLowerCase(),
    amount: data.amount,
    message: data.message || '',
    expires: data.expires || 0,
    requestId: data.requestId || '',
  };

  return JSON.stringify(payload);
}

/**
 * X402形式の決済データをデコード
 *
 * @param qrData QRコードから読み取ったデータ
 * @returns 決済データ
 */
export function decodeX402(qrData: string): X402PaymentData {
  try {
    const payload = JSON.parse(qrData);

    // バリデーション
    if (!payload.to || !payload.token || !payload.amount) {
      throw new Error('Invalid X402 payment data: missing required fields');
    }

    if (!payload.to.startsWith('0x') || payload.to.length !== 42) {
      throw new Error('Invalid recipient address');
    }

    if (!payload.token.startsWith('0x') || payload.token.length !== 42) {
      throw new Error('Invalid token address');
    }

    return {
      to: payload.to.toLowerCase(),
      token: payload.token.toLowerCase(),
      amount: payload.amount,
      message: payload.message,
      expires: payload.expires,
      requestId: payload.requestId,
    };
  } catch (error) {
    console.error('Failed to decode X402 data:', error);
    throw new Error('Invalid QR code format');
  }
}

/**
 * 金額を人間が読める形式にフォーマット
 *
 * @param amountWei Wei単位の金額
 * @param decimals トークンの小数点桁数
 * @returns フォーマットされた金額文字列
 */
export function formatPaymentAmount(amountWei: string, decimals: number = 18): string {
  try {
    return ethers.utils.formatUnits(amountWei, decimals);
  } catch {
    return '0';
  }
}

/**
 * 人間が読める金額をWei単位に変換
 *
 * @param amount 金額
 * @param decimals トークンの小数点桁数
 * @returns Wei単位の金額文字列
 */
export function parsePaymentAmount(amount: string, decimals: number = 18): string {
  try {
    return ethers.utils.parseUnits(amount, decimals).toString();
  } catch {
    throw new Error('Invalid amount format');
  }
}

/**
 * 有効期限をチェック
 *
 * @param expires 有効期限 (Unix timestamp)
 * @returns 有効かどうか
 */
export function isPaymentExpired(expires?: number): boolean {
  if (!expires) return false;
  return Date.now() / 1000 > expires;
}

/**
 * 有効期限までの残り時間を取得
 *
 * @param expires 有効期限 (Unix timestamp)
 * @returns 残り秒数
 */
export function getTimeUntilExpiry(expires?: number): number {
  if (!expires) return Infinity;
  return Math.max(0, expires - Date.now() / 1000);
}

/**
 * リクエストIDを生成
 *
 * @returns ユニークなリクエストID
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `req_${timestamp}_${random}`;
}
