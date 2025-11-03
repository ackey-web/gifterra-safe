// ========================================
// Adapter層 統合エクスポート
// ========================================

// Wallet Adapter
export {
  useWalletClient,
  usePrivyWalletAdapter,
  useThirdwebWalletAdapter,
  type WalletAdapter,
  type TransactionRequest,
} from './walletClient';

// Token Adapter
export { useTokenClient, type TokenAdapter } from './tokenClient';

// Scan/Link Adapter
export {
  useScanLink,
  type ScanLinkAdapter,
  type QROptions,
  type R2PParams,
  type R2PLink,
  type R2PVerification,
} from './scanLink';

// DB Adapter
export {
  useDBClient,
  type DBAdapter,
  type QueryOptions,
} from './dbClient';
