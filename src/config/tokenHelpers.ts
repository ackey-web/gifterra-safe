// src/config/tokenHelpers.ts
// マルチトークン対応ヘルパー関数
// テストネット/メインネット切り替えに対応

import {
  getNetworkEnv,
  getTokenConfig,
  getAvailableTokens,
  formatTokenAmount as formatTokenAmountBase,
  type TokenId,
  type TokenConfig
} from './tokens';

/**
 * 現在の環境で利用可能なトークンを取得
 *
 * @returns 利用可能なトークン配列
 * - testnet: tNHT + JPYC（開発・テスト用）
 * - mainnet: NHT + JPYC
 */
export function getActiveTokens(): (TokenConfig & { currentAddress: string })[] {
  // 開発・本番環境問わず、NHT + JPYC の両方を返す
  // テストネットでは自動的に tNHT として表示される
  return [
    getTokenConfig('NHT'),
    getTokenConfig('JPYC'),
  ];
}

/**
 * デフォルトトークン（主要トークン）を取得
 *
 * @returns デフォルトトークン設定
 * - testnet: tNHT
 * - mainnet: NHT
 */
export function getDefaultToken(): TokenConfig & { currentAddress: string } {
  return getTokenConfig('NHT'); // 環境に応じて自動的にtNHT/NHTが返される
}

/**
 * トークンシンボルからTokenIdを取得
 *
 * @param symbol トークンシンボル（例: "tNHT", "NHT", "JPYC"）
 * @returns TokenId or null
 */
export function getTokenIdBySymbol(symbol: string): TokenId | null {
  const normalizedSymbol = symbol.toUpperCase();

  // NHT/tNHT の正規化
  if (normalizedSymbol === 'TNHT' || normalizedSymbol === 'NHT') {
    return 'NHT';
  }

  if (normalizedSymbol === 'JPYC') {
    return 'JPYC';
  }

  return null;
}

/**
 * 金額フォーマット（BigInt → 表示用文字列）
 *
 * @param amountWei wei単位の金額
 * @param tokenId トークンID
 * @param includeSymbol シンボルを含めるか（デフォルト: true）
 * @returns フォーマットされた文字列
 */
export function formatTokenAmount(
  amountWei: string | bigint,
  tokenId: TokenId,
  includeSymbol = true
): string {
  const formatted = formatTokenAmountBase(amountWei, tokenId);

  if (!includeSymbol) {
    // シンボル部分を削除
    return formatted.split(' ')[0];
  }

  return formatted;
}

/**
 * 短縮フォーマット（小数点以下4桁まで、シンボルなし）
 * Admin Dashboardの fmt18() 互換関数
 *
 * @param amountWei wei単位の金額
 * @param tokenId トークンID
 * @returns 短縮フォーマット文字列
 */
export function formatTokenShort(amountWei: string | bigint, tokenId: TokenId): string {
  try {
    const config = getTokenConfig(tokenId);
    const amount = typeof amountWei === 'string' ? BigInt(amountWei) : amountWei;

    const divisor = BigInt(10) ** BigInt(config.decimals);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;

    if (fractionalPart === 0n) {
      return integerPart.toString();
    }

    // 小数部分を文字列化（ゼロパディング）
    const fractionalStr = fractionalPart.toString().padStart(config.decimals, '0');
    // 小数点以下4桁まで（末尾のゼロは保持）
    const truncated = fractionalStr.slice(0, 4);
    // 末尾のゼロを削除
    const trimmed = truncated.replace(/0+$/, '');

    if (!trimmed) {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmed}`;
  } catch {
    return '0';
  }
}

/**
 * 環境情報の取得（デバッグ用）
 *
 * @returns 環境情報オブジェクト
 */
export function getEnvironmentInfo() {
  const network = getNetworkEnv();
  const tokens = getActiveTokens();

  return {
    network,
    isTestnet: network === 'testnet',
    isMainnet: network === 'mainnet',
    activeTokens: tokens.map(t => ({
      id: t.id,
      symbol: t.symbol,
      address: t.currentAddress,
      category: t.category,
    })),
    defaultToken: {
      id: getDefaultToken().id,
      symbol: getDefaultToken().symbol,
      address: getDefaultToken().currentAddress,
    },
  };
}

/**
 * 後方互換性のための TOKEN エクスポート
 * contract.ts の TOKEN と互換性を保つ
 *
 * @deprecated 新しいコードでは getDefaultToken() または getTokenConfig('NHT') を使用してください
 */
export const TOKEN = {
  get ADDRESS() {
    return getDefaultToken().currentAddress;
  },
  get SYMBOL() {
    return getDefaultToken().symbol;
  },
  get DECIMALS() {
    return getDefaultToken().decimals;
  },
  get ICON() {
    return getDefaultToken().icon || '';
  },
};

/**
 * JPYC トークン取得（後方互換性用）
 *
 * @deprecated 新しいコードでは getTokenConfig('JPYC') を使用してください
 */
export const JPYC_TOKEN = {
  get ADDRESS() {
    return getTokenConfig('JPYC').currentAddress;
  },
  get SYMBOL() {
    return 'JPYC';
  },
  get DECIMALS() {
    return 18;
  },
  get NAME() {
    return 'JPY Coin';
  },
};

/**
 * マルチトークン集計用ヘルパー
 * 複数トークンの金額を個別に管理
 */
export interface TokenAmount {
  tokenId: TokenId;
  symbol: string;
  amount: bigint;
  formatted: string;
}

/**
 * トークン別金額マップの作成
 *
 * @returns TokenId をキーとするMap
 */
export function createTokenAmountMap(): Map<TokenId, bigint> {
  const map = new Map<TokenId, bigint>();
  const tokens = getActiveTokens();

  tokens.forEach(token => {
    map.set(token.id, 0n);
  });

  return map;
}

/**
 * トークン別金額配列の作成（表示用）
 *
 * @param amountMap トークン別金額マップ
 * @returns TokenAmount配列
 */
export function formatTokenAmounts(amountMap: Map<TokenId, bigint>): TokenAmount[] {
  const tokens = getActiveTokens();

  return tokens.map(token => ({
    tokenId: token.id,
    symbol: token.symbol,
    amount: amountMap.get(token.id) || 0n,
    formatted: formatTokenAmount(amountMap.get(token.id) || 0n, token.id, false),
  }));
}
