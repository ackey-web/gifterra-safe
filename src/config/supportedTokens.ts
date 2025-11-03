// src/config/supportedTokens.ts
// GIFTERRA で履歴表示対象となるトークン一覧

import { JPYC_TOKEN, NHT_TOKEN } from '../contract';

/**
 * トークン情報の型定義
 */
export interface SupportedToken {
  ADDRESS: string;
  SYMBOL: string;
  DECIMALS: number;
  NAME: string;
}

/**
 * 履歴表示対象のトークン一覧
 *
 * 【運用方法】
 * テナントオーナーから独自トークン追加申請があり、運営で審査・承認した場合:
 * 1. このリストに新しいトークン情報を追加
 * 2. デプロイ
 *
 * これにより、ユーザーのマイページ履歴に自動的に新トークンのトランザクションが表示されます。
 */
export const SUPPORTED_TOKENS: SupportedToken[] = [
  {
    ADDRESS: JPYC_TOKEN.ADDRESS,
    SYMBOL: JPYC_TOKEN.SYMBOL,
    DECIMALS: JPYC_TOKEN.DECIMALS,
    NAME: JPYC_TOKEN.NAME,
  },
  {
    ADDRESS: NHT_TOKEN.ADDRESS,
    SYMBOL: NHT_TOKEN.SYMBOL,
    DECIMALS: NHT_TOKEN.DECIMALS,
    NAME: NHT_TOKEN.NAME,
  },
  // 【将来的な独自トークン追加例】
  // {
  //   ADDRESS: '0x...',
  //   SYMBOL: 'TENANT1',
  //   DECIMALS: 18,
  //   NAME: 'Tenant 1 Token',
  // },
];

/**
 * トークンアドレスからトークン情報を取得
 */
export function getTokenByAddress(address: string): SupportedToken | undefined {
  return SUPPORTED_TOKENS.find(
    token => token.ADDRESS.toLowerCase() === address.toLowerCase()
  );
}

/**
 * トークンシンボル一覧を取得
 */
export function getSupportedTokenSymbols(): string[] {
  return SUPPORTED_TOKENS.map(token => token.SYMBOL);
}
