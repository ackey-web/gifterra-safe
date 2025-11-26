// src/utils/x402.ts
// X402プロトコルを使った決済QRコードのエンコード/デコード

import { ethers } from 'ethers';

export interface X402PaymentData {
  to: string;           // 受取アドレス
  token: string;        // トークンアドレス (JPYC)
  amount: string;       // Wei単位の金額
  chainId: number;      // チェーンID (Polygon = 137)
  message?: string;     // メモ/説明
  expires?: number;     // 有効期限 (Unix timestamp)
  requestId?: string;   // リクエストID (重複防止)
  // ガスレス決済用フィールド
  gasless?: boolean;    // ガスレス決済フラグ（後方互換性のため）
  isGasless?: boolean;  // ガスレス決済フラグ（新しい命名）
  nonce?: string;       // ERC-2612 Permit nonce
  validAfter?: number;  // Permit有効開始時刻
  validBefore?: number; // Permit有効期限
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
    chainId: data.chainId,
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

    if (!payload.chainId || typeof payload.chainId !== 'number') {
      throw new Error('Invalid or missing chainId');
    }

    return {
      to: payload.to.toLowerCase(),
      token: payload.token.toLowerCase(),
      amount: payload.amount,
      chainId: payload.chainId,
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

/**
 * EIP-55チェックサムアドレス検証
 * ethers.jsのgetAddress()を使用してアドレスの妥当性を検証
 *
 * @param address 検証するアドレス
 * @returns { valid: boolean; checksumAddress?: string; error?: string }
 */
export function validateAddress(address: string): {
  valid: boolean;
  checksumAddress?: string;
  error?: string;
} {
  try {
    // ethers.jsのgetAddress()はEIP-55チェックサム検証を行う
    // 無効なアドレスの場合は例外がスローされる
    const checksumAddress = ethers.utils.getAddress(address);
    return {
      valid: true,
      checksumAddress
    };
  } catch (e: any) {
    return {
      valid: false,
      error: `無効なアドレス形式です: ${e.message}`
    };
  }
}

/**
 * アドレスをEIP-55チェックサム形式に変換
 *
 * @param address 変換するアドレス
 * @returns EIP-55チェックサム形式のアドレス (失敗時はnull)
 */
export function toChecksumAddress(address: string): string | null {
  try {
    return ethers.utils.getAddress(address);
  } catch {
    return null;
  }
}

/**
 * ChainID検証
 * Polygon Mainnet (137) が期待値
 *
 * @param chainId 検証するチェーンID
 * @param expectedChainId 期待するチェーンID (デフォルト: 137 = Polygon)
 * @returns { valid: boolean; chainName?: string; error?: string }
 */
export function validateChainId(
  chainId: number,
  expectedChainId: number = 137
): {
  valid: boolean;
  chainName?: string;
  error?: string;
} {
  // チェーン名マッピング
  const chainNames: Record<number, string> = {
    1: 'Ethereum Mainnet',
    137: 'Polygon Mainnet',
    80001: 'Polygon Mumbai Testnet',
    80002: 'Polygon Amoy Testnet',
  };

  const chainName = chainNames[chainId] || `Unknown Chain (${chainId})`;

  if (chainId === expectedChainId) {
    return {
      valid: true,
      chainName,
    };
  }

  const expectedChainName = chainNames[expectedChainId] || `Chain ${expectedChainId}`;
  return {
    valid: false,
    chainName,
    error: `チェーンIDが一致しません。期待: ${expectedChainName} (${expectedChainId}), 実際: ${chainName} (${chainId})`,
  };
}

/**
 * 現在接続中のチェーンIDを取得
 *
 * @param provider ethers Provider
 * @returns チェーンID
 */
export async function getCurrentChainId(provider: ethers.providers.Provider): Promise<number> {
  const network = await provider.getNetwork();
  return network.chainId;
}
