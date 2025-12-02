// src/config/wallets.ts
// ハイブリッドウォレット設定: スマートウォレット + 外部ウォレット

// Note: SmartWallet is commented out as ENABLE_SMART_WALLET is false
// import {
//   SmartWallet,
//   type SmartWalletConfig,
// } from "@thirdweb-dev/wallets";

import {
  embeddedWallet,
  metamaskWallet,
  coinbaseWallet,
} from "@thirdweb-dev/react";
import { PolygonAmoyTestnet, Polygon } from "@thirdweb-dev/chains";
import { getNetworkEnv } from "./tokens";

/**
 * スマートウォレットの設定
 *
 * Note: Currently disabled as ENABLE_SMART_WALLET is false
 */
/*
function getSmartWalletConfig(): SmartWalletConfig {
  return {
    chain: getActiveChain(),
    factoryAddress: import.meta.env.VITE_SMART_WALLET_FACTORY || "",
    gasless: true,
  };
}
*/

/**
 * サポートするウォレット一覧
 *
 * 戦略:
 * 1. スマートウォレット（推奨）- 初心者向け、ガスレス
 * 2. 外部ウォレット直接接続 - 上級者向け、自己管理
 */
/**
 * スマートウォレットの有効/無効を制御するフラグ
 *
 * 初期段階ではコスト削減のため無効化
 * 将来的にアップグレード可能
 *
 * - true: スマートウォレット有効（Thirdweb有料プラン必要）
 * - false: 従来のウォレットのみ（無料）
 */
const ENABLE_SMART_WALLET = false; // Thirdweb有料プランが必要なため初期は無効化

/**
 * スマートウォレット用のパーソナルウォレット設定
 *
 * Note: Currently not used as ENABLE_SMART_WALLET is false
 * If you enable smart wallet in the future, use the function forms:
 * - embeddedWallet() instead of new EmbeddedWallet()
 * - metamaskWallet() instead of new MetaMaskWallet()
 */
/*
function getPersonalWalletsForSmartWallet() {
  return [
    embeddedWallet({
      auth: {
        options: ["email", "google"],
      },
    }),
    metamaskWallet(),
  ];
}
*/

export const supportedWallets = [
  // Note: SmartWallet is disabled (ENABLE_SMART_WALLET = false)
  // Note: embeddedWallet is temporarily disabled due to "Missing recovery share" errors

  // MetaMask（直接接続）
  metamaskWallet({
    recommended: true,
  }),

  // Coinbase Wallet
  coinbaseWallet({
    recommended: true,
  }),

  // Embedded Wallet（一時的に無効化 - Google OAuth / Email認証エラーのため）
  // TODO: Thirdweb v5にアップグレード後に再度有効化を検討
  // embeddedWallet({
  //   auth: {
  //     options: ["google", "email"], // Googleを最初に
  //   },
  //   recommended: true, // スマートウォレット無効時は推奨
  // }),
];

/**
 * ガススポンサーシップのルール設定
 *
 * スマートウォレット使用時のみ適用
 * 外部ウォレット直接接続時はユーザーが自己負担
 */
export interface GasSponsorshipRules {
  // 新規ユーザー: 最初のN回は無料
  firstTransactions: number;

  // 関数別スポンサーシップ
  sponsoredFunctions: {
    // Tip機能: 常に無料（上限あり）
    tip: {
      enabled: boolean;
      maxAmount: string; // wei単位
    };

    // GIFT HUB購入: 一定額以下は無料
    purchase: {
      enabled: boolean;
      threshold: string; // wei単位
    };

    // Reward受け取り: 常に無料
    claimReward: {
      enabled: boolean;
    };
  };

  // 1トランザクションあたりの最大ガススポンサー額
  maxGasPerTransaction: string; // wei単位
}

/**
 * デフォルトのガススポンサーシップルール
 */
export const defaultGasSponsorshipRules: GasSponsorshipRules = {
  // 新規ユーザー: 最初の5トランザクション無料
  firstTransactions: 5,

  sponsoredFunctions: {
    // Tip: 1000 JPYC以下は常に無料
    tip: {
      enabled: true,
      maxAmount: "1000000000000000000000", // 1000 * 10^18
    },

    // Purchase: 100 JPYC以下は無料
    purchase: {
      enabled: true,
      threshold: "100000000000000000000", // 100 * 10^18
    },

    // Reward: 常に無料
    claimReward: {
      enabled: true,
    },
  },

  // 最大ガス: 0.02 POL相当
  maxGasPerTransaction: "20000000000000000", // 0.02 * 10^18
};

/**
 * アクティブチェーンの取得
 *
 * 環境変数に応じてTestnet/Mainnetを切り替え
 */
export function getActiveChain() {
  const network = getNetworkEnv();
  return network === "mainnet" ? Polygon : PolygonAmoyTestnet;
}

/**
 * ウォレット接続のデフォルト設定
 */
export const walletConnectionConfig = {
  // 自動接続
  autoConnect: true,

  // 接続状態の永続化
  persist: true,

  // セッション管理
  authConfig: {
    domain: typeof window !== "undefined" ? window.location.origin : "",
    authUrl: "/api/auth",
  },
};

/**
 * デバッグ用: ウォレット設定の確認
 * 注: 現在はコンソールログを出力しません
 */
export function debugWalletConfig() {
  // デバッグ出力は削除されました
  // 必要に応じて以下のコードを有効化してください
  /*

  */
}
