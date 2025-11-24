// src/utils/eip3009.ts
// EIP-3009: Transfer With Authorization ユーティリティ
// JPYCのガスレス決済を実現するための署名生成・検証ロジック

import { ethers } from 'ethers';

/**
 * TransferWithAuthorization パラメータ
 */
export interface TransferWithAuthorizationParams {
  from: string;          // 送信元アドレス
  to: string;            // 受取先アドレス（店舗）
  value: string;         // 金額（wei単位）
  validAfter: number;    // 有効期限開始（Unix timestamp、通常は0）
  validBefore: number;   // 有効期限終了（Unix timestamp）
  nonce: string;         // 一意のnonce（32 bytes hex）
}

/**
 * EIP-712 署名データ
 */
export interface AuthorizationSignature {
  v: number;
  r: string;
  s: string;
}

/**
 * JPYC EIP-712 Domain
 * JPYC v2コントラクトの設定
 */
export const JPYC_EIP712_DOMAIN = {
  name: 'JPY Coin',
  version: '2',
  chainId: 137, // Polygon Mainnet
  verifyingContract: '0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c', // JPYC v2
};

/**
 * TransferWithAuthorization TypeHash
 * EIP-712準拠の型定義
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/**
 * ランダムnonceを生成
 * リプレイアタック防止のための一意識別子
 *
 * @returns 32 bytes hex string
 */
export function generateNonce(): string {
  const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));
  console.log('🎲 Generated nonce:', nonce);
  return nonce;
}

/**
 * EIP-712署名を生成
 *
 * ユーザーがオフチェーンで署名を生成します。
 * この署名はガス代不要で、店舗側がtransferWithAuthorizationを実行する際に使用します。
 *
 * @param signer - ユーザーのSigner
 * @param params - 認証パラメータ
 * @returns 署名データ（v, r, s）
 */
export async function signTransferAuthorization(
  signer: ethers.Signer,
  params: TransferWithAuthorizationParams
): Promise<AuthorizationSignature> {
  console.log('📝 EIP-712署名生成開始:', {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: params.nonce.substring(0, 10) + '...',
  });

  try {
    // EIP-712 Typed Data
    const typedData = {
      domain: JPYC_EIP712_DOMAIN,
      types: TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: params.from,
        to: params.to,
        value: params.value,
        validAfter: params.validAfter,
        validBefore: params.validBefore,
        nonce: params.nonce,
      },
    };

    console.log('📄 Typed Data:', JSON.stringify(typedData, null, 2));

    // 署名生成
    const signature = await signer._signTypedData(
      typedData.domain,
      { TransferWithAuthorization: typedData.types.TransferWithAuthorization },
      typedData.message
    );

    // v, r, s に分解
    const { v, r, s } = ethers.utils.splitSignature(signature);

    console.log('✅ EIP-712署名生成完了:', {
      v,
      r: r.substring(0, 10) + '...',
      s: s.substring(0, 10) + '...',
    });

    return { v, r, s };
  } catch (error: any) {
    console.error('❌ EIP-712署名生成エラー:', error);
    throw new Error(`署名の生成に失敗しました: ${error.message}`);
  }
}

/**
 * 署名を検証（オプション）
 *
 * 署名が正しいアドレスから生成されたかを検証します。
 * 主にデバッグ用途で使用します。
 *
 * @param params - 認証パラメータ
 * @param signature - 署名データ
 * @returns 署名者のアドレス
 */
export function recoverSigner(
  params: TransferWithAuthorizationParams,
  signature: AuthorizationSignature
): string {
  const typedData = {
    domain: JPYC_EIP712_DOMAIN,
    types: TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
    message: {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce,
    },
  };

  const digest = ethers.utils._TypedDataEncoder.hash(
    typedData.domain,
    { TransferWithAuthorization: typedData.types.TransferWithAuthorization },
    typedData.message
  );

  const recovered = ethers.utils.recoverAddress(digest, {
    v: signature.v,
    r: signature.r,
    s: signature.s,
  });

  console.log('🔍 Recovered signer:', recovered);
  console.log('🔍 Expected signer:', params.from);
  console.log('✅ Signature valid:', recovered.toLowerCase() === params.from.toLowerCase());

  return recovered;
}

/**
 * 署名が有効かチェック
 *
 * @param params - 認証パラメータ
 * @param signature - 署名データ
 * @returns 署名が有効か
 */
export function verifySignature(
  params: TransferWithAuthorizationParams,
  signature: AuthorizationSignature
): boolean {
  try {
    const recovered = recoverSigner(params, signature);
    return recovered.toLowerCase() === params.from.toLowerCase();
  } catch (error) {
    console.error('❌ 署名検証エラー:', error);
    return false;
  }
}

/**
 * 有効期限をチェック
 *
 * @param validAfter - 有効期限開始（Unix timestamp）
 * @param validBefore - 有効期限終了（Unix timestamp）
 * @returns 有効期限内か
 */
export function isWithinValidPeriod(
  validAfter: number,
  validBefore: number
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const isValid = now >= validAfter && now <= validBefore;

  if (!isValid) {
    console.warn('⚠️ Authorization expired or not yet valid:', {
      now,
      validAfter,
      validBefore,
      isExpired: now > validBefore,
      isNotYetValid: now < validAfter,
    });
  }

  return isValid;
}

/**
 * 金額をフォーマット（wei → JPYC）
 *
 * @param value - 金額（wei単位）
 * @returns フォーマットされた金額
 */
export function formatAmount(value: string): string {
  try {
    return ethers.utils.formatUnits(value, 18);
  } catch (error) {
    console.error('❌ Amount format error:', error);
    return '0';
  }
}

/**
 * 金額をパース（JPYC → wei）
 *
 * @param amount - 金額（JPYC単位）
 * @returns wei単位の金額
 */
export function parseAmount(amount: string): string {
  try {
    return ethers.utils.parseUnits(amount, 18).toString();
  } catch (error) {
    console.error('❌ Amount parse error:', error);
    throw new Error('金額の形式が不正です');
  }
}
