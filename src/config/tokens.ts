// src/config/tokens.ts
// マルチトークン対応：トークンマスターデータ管理
// テストネット/メインネット切り替え対応

/**
 * ネットワーク環境
 */
export type NetworkEnv = 'testnet' | 'mainnet';

/**
 * サポートするトークンID
 * - NHT: ユーティリティトークン（Reward配布可能）
 * - JPYC: 日本円ステーブルコイン（電子決済手段、決済のみ）
 */
export type TokenId = 'NHT' | 'JPYC';

/**
 * トークン分類
 * - utility: ユーティリティトークン（Reward配布可能、プラットフォーム内で使用）
 * - payment: 決済トークン（資産価値あり、TIP/購入のみ、Reward配布不可）
 */
export type TokenCategory = 'utility' | 'payment';

/**
 * トークン設定
 */
export interface TokenConfig {
  id: TokenId;
  symbol: string;           // 表示用シンボル（テストネット時は"t"が付く）
  name: string;             // トークン名
  decimals: number;         // 小数点桁数
  category: TokenCategory;  // トークン分類（Reward配布可否の判定に使用）
  addresses: {
    testnet: string;        // テストネットアドレス
    mainnet: string;        // メインネットアドレス
  };
  icon?: string;            // アイコンURL（オプション）
  description?: string;     // 説明（オプション）
}

/**
 * 現在のネットワーク環境を取得
 */
export function getNetworkEnv(): NetworkEnv {
  // 環境変数から取得（デフォルトはtestnet）
  const network = import.meta.env.VITE_NETWORK;

  if (network === 'mainnet' || network === 'main') {
    return 'mainnet';
  }

  return 'testnet';
}

/**
 * トークンマスターデータ
 *
 * 新しいトークンを追加する場合はここに定義を追加してください。
 *
 * ⚠️ 環境変数での上書き:
 * - VITE_NHT_TESTNET_ADDRESS: NHTテストネットアドレス
 * - VITE_NHT_MAINNET_ADDRESS: NHTメインネットアドレス
 * - VITE_JPYC_TESTNET_ADDRESS: JPYCテストネットアドレス
 * - VITE_JPYC_MAINNET_ADDRESS: JPYCメインネットアドレス
 */
export const TOKEN_MASTER_DATA: Record<TokenId, TokenConfig> = {
  /**
   * NHT (New Heaven Token)
   * - テストネット: tNHT
   * - メインネット: NHT
   * - ユーティリティトークン（Reward配布可能）
   */
  NHT: {
    id: 'NHT',
    symbol: 'tNHT', // デフォルトはtestnet、getTokenConfig()で動的に変更
    name: 'Test New Heaven Token', // デフォルトはtestnet、getTokenConfig()で動的に変更
    decimals: 18,
    category: 'utility', // ユーティリティトークン：Reward配布可能
    addresses: {
      testnet: import.meta.env.VITE_NHT_TESTNET_ADDRESS || '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea', // Polygon Amoy tNHT
      mainnet: import.meta.env.VITE_NHT_MAINNET_ADDRESS || '0x3cc0e67d0abAbEe99F881AbADa7ef9398Dcf3757', // Polygon Mainnet NHT
    },
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM4MjQ3ZTMiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01aDNWOGg0djRoM2wtNSA1eiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cjwvc3ZnPg==',
    description: 'Gifterraプラットフォームのユーティリティトークン',
  },

  /**
   * JPYC (JPY Coin)
   * - 電子決済手段として発行される日本円ステーブルコイン
   * - 1 JPYC = 1 JPY
   * - 決済トークン（資産価値あり、Reward配布不可）
   *
   * ⚠️ 環境変数での上書き対応:
   * VITE_JPYC_TESTNET_ADDRESS - JPYCテストネットアドレス
   * VITE_JPYC_MAINNET_ADDRESS - JPYCメインネットアドレス（電子決済手段）
   */
  JPYC: {
    id: 'JPYC',
    symbol: 'JPYC',
    name: 'JPY Coin',
    decimals: 18,
    category: 'payment', // 決済トークン：資産価値あり、TIP/購入のみ
    addresses: {
      testnet: import.meta.env.VITE_JPYC_TESTNET_ADDRESS || '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29', // Polygon Amoy JPYC
      mainnet: import.meta.env.VITE_JPYC_MAINNET_ADDRESS || '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29', // Polygon Mainnet JPYC（電子決済手段）
    },
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMwMDg4Y2MiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjE4IiBmb250LXdlaWdodD0iYm9sZCI+wqU8L3RleHQ+Cjwvc3ZnPg==',
    description: '日本円ステーブルコイン（1 JPYC = 1 JPY）',
  },
};

/**
 * 現在の環境に応じたトークンアドレスを取得
 *
 * @param tokenId トークンID
 * @returns 現在の環境のトークンアドレス
 */
export function getTokenAddress(tokenId: TokenId): string {
  const network = getNetworkEnv();
  const token = TOKEN_MASTER_DATA[tokenId];

  if (!token) {
    throw new Error(`Unknown token ID: ${tokenId}`);
  }

  const address = token.addresses[network];

  if (address === '0x0000000000000000000000000000000000000000') {
    console.warn(`⚠️ Token ${tokenId} address not configured for ${network}`);
  }

  return address;
}

/**
 * トークン設定を取得
 *
 * @param tokenId トークンID
 * @returns トークン設定（現在の環境のアドレス含む）
 */
export function getTokenConfig(tokenId: TokenId): TokenConfig & { currentAddress: string } {
  const config = TOKEN_MASTER_DATA[tokenId];

  if (!config) {
    throw new Error(`Token config not found for: ${tokenId}`);
  }

  const currentAddress = getTokenAddress(tokenId);
  const network = getNetworkEnv();

  // NHTの場合、環境に応じてsymbolとnameを動的に設定
  if (tokenId === 'NHT') {
    return {
      ...config,
      symbol: network === 'mainnet' ? 'NHT' : 'tNHT',
      name: network === 'mainnet' ? 'New Heaven Token' : 'Test New Heaven Token',
      currentAddress,
    };
  }

  return {
    ...config,
    currentAddress,
  };
}

/**
 * アドレスからトークンIDを取得
 *
 * @param address トークンアドレス
 * @returns トークンID（見つからない場合はnull）
 */
export function getTokenIdByAddress(address: string): TokenId | null {
  const network = getNetworkEnv();
  const normalizedAddress = address.toLowerCase();

  for (const [tokenId, config] of Object.entries(TOKEN_MASTER_DATA)) {
    if (config.addresses[network].toLowerCase() === normalizedAddress) {
      return tokenId as TokenId;
    }
  }

  return null;
}

/**
 * 利用可能な全トークンのリストを取得
 *
 * @param onlyConfigured trueの場合、アドレスが設定されているトークンのみ返す
 * @param category フィルタ対象のカテゴリ（省略時は全カテゴリ）
 * @returns トークン設定の配列
 */
export function getAvailableTokens(
  onlyConfigured = true,
  category?: TokenCategory
): (TokenConfig & { currentAddress: string })[] {
  const network = getNetworkEnv();
  let tokens = Object.values(TOKEN_MASTER_DATA).map(config => {
    const currentAddress = config.addresses[network];

    // NHTの場合、環境に応じてsymbolとnameを動的に設定
    if (config.id === 'NHT') {
      return {
        ...config,
        symbol: network === 'mainnet' ? 'NHT' : 'tNHT',
        name: network === 'mainnet' ? 'New Heaven Token' : 'Test New Heaven Token',
        currentAddress,
      };
    }

    return {
      ...config,
      currentAddress,
    };
  });

  // カテゴリフィルタ
  if (category) {
    tokens = tokens.filter(token => token.category === category);
  }

  // アドレス設定済みフィルタ
  if (onlyConfigured) {
    return tokens.filter(token =>
      token.currentAddress !== '0x0000000000000000000000000000000000000000'
    );
  }

  return tokens;
}

/**
 * ユーティリティトークンのみ取得（Reward配布可能なトークン）
 *
 * @param onlyConfigured trueの場合、設定済みトークンのみ
 * @returns ユーティリティトークン配列
 */
export function getUtilityTokens(onlyConfigured = true): (TokenConfig & { currentAddress: string })[] {
  return getAvailableTokens(onlyConfigured, 'utility');
}

/**
 * 決済トークンのみ取得（TIP/購入用トークン）
 *
 * @param onlyConfigured trueの場合、設定済みトークンのみ
 * @returns 決済トークン配列
 */
export function getPaymentTokens(onlyConfigured = true): (TokenConfig & { currentAddress: string })[] {
  return getAvailableTokens(onlyConfigured, 'payment');
}

/**
 * トークンシンボルの表示用フォーマット
 *
 * @param tokenId トークンID
 * @param showNetwork trueの場合、ネットワーク情報を含める
 * @returns フォーマットされたシンボル
 */
export function formatTokenSymbol(tokenId: TokenId, showNetwork = false): string {
  const config = TOKEN_MASTER_DATA[tokenId];
  const network = getNetworkEnv();

  if (showNetwork && network === 'testnet') {
    return `${config.symbol} (Testnet)`;
  }

  return config.symbol;
}

/**
 * 価格フォーマット用ヘルパー
 *
 * @param amountWei wei単位の金額
 * @param tokenId トークンID
 * @returns フォーマットされた価格文字列
 */
export function formatTokenAmount(amountWei: string | bigint, tokenId: TokenId): string {
  const config = TOKEN_MASTER_DATA[tokenId];
  const amount = typeof amountWei === 'string' ? BigInt(amountWei) : amountWei;

  // decimalsに応じて変換
  const divisor = BigInt(10) ** BigInt(config.decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return `${integerPart} ${config.symbol}`;
  }

  // 小数部分を文字列化（ゼロパディング）
  const fractionalStr = fractionalPart.toString().padStart(config.decimals, '0');
  // 末尾のゼロを削除
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  return `${integerPart}.${trimmedFractional} ${config.symbol}`;
}

/**
 * wei変換ヘルパー（tokenIdを考慮したdecimals対応）
 *
 * @param amount トークン数量
 * @param tokenId トークンID
 * @returns wei単位の文字列
 */
export function toTokenWei(amount: number, tokenId: TokenId): string {
  const config = TOKEN_MASTER_DATA[tokenId];
  const multiplier = BigInt(10) ** BigInt(config.decimals);
  const amountBigInt = BigInt(Math.floor(amount));

  return (amountBigInt * multiplier).toString();
}

/**
 * デバッグ用：現在のトークン設定を表示
 * 注: 現在はコンソールログを出力しません
 */
export function debugTokenConfig() {
  // デバッグ出力は削除されました
  // 必要に応じて以下のコードを有効化してください
  /*
  const network = getNetworkEnv();
  console.log('🪙 Token Configuration');
  console.log('Network:', network);
  console.log('Available Tokens:');

  Object.entries(TOKEN_MASTER_DATA).forEach(([id, config]) => {
    console.log(`  ${id}:`, {
      symbol: config.symbol,
      address: config.addresses[network],
      decimals: config.decimals,
    });
  });
  */
}
