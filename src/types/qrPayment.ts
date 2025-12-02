// src/types/qrPayment.ts
// QRコード決済の型定義

/**
 * QRコード決済のタイプ
 *
 * - 'invoice': 請求書QR（X402形式、金額固定）
 * - 'wallet': ウォレットQR（アドレスのみ、金額は手入力）
 * - 'authorization': ガスレス決済QR（EIP-3009、署名のみ）
 */
export type QRPaymentType = 'invoice' | 'wallet' | 'authorization';

/**
 * 請求書QRコード（従来方式）
 * X402形式 - 金額が含まれており、スキャンで即座に送金実行
 */
export interface InvoiceQRData {
  type: 'invoice';
  /** EIP-681形式のペイメントリクエスト */
  data: string;
  /** 請求ID */
  requestId?: string;
}

/**
 * ウォレットQRコード
 * アドレスのみ含まれ、ユーザーが金額を入力
 */
export interface WalletQRData {
  type: 'wallet';
  /** 受取ウォレットアドレス（EIP-55チェックサム形式） */
  address: string;
  /** 店舗名・テナント名（オプション） */
  name?: string;
  /** チェーンID（137 = Polygon Mainnet） */
  chainId: number;
  /** 説明・メモ（オプション） */
  description?: string;
}

/**
 * ガスレス決済QRコード（新規追加）
 * EIP-3009 transferWithAuthorization を使用
 *
 * 特徴:
 * - ユーザーはオフチェーン署名のみ（ガス代不要）
 * - 店舗側がtransferWithAuthorizationを実行（店舗がガス代負担）
 * - JPYCのみ対応
 */
export interface AuthorizationQRData {
  type: 'authorization';
  /** 店舗アドレス（受取先） */
  to: string;
  /** 金額（wei単位） */
  value: string;
  /** 有効期限終了（Unix timestamp） */
  validBefore: number;
  /** 一意のnonce（32 bytes hex） */
  nonce: string;
  /** チェーンID（137 = Polygon Mainnet） */
  chainId: number;
  /** 店舗名（オプション） */
  storeName?: string;
  /** リクエストID（トラッキング用） */
  requestId: string;
}

/**
 * QRコードデータの統合型
 */
export type QRPaymentData = InvoiceQRData | WalletQRData | AuthorizationQRData;

/**
 * QRスキャン結果
 */
export interface QRScanResult {
  success: boolean;
  type?: QRPaymentType;
  data?: InvoiceQRData | WalletQRData | AuthorizationQRData;
  error?: string;
}

/**
 * ウォレットQRコードのJSON文字列をパース
 */
export function parseWalletQR(qrString: string): QRScanResult {
  try {
    const parsed = JSON.parse(qrString);

    if (parsed.type !== 'wallet') {

      return {
        success: false,
        error: 'ウォレットQRコードではありません',
      };
    }

    if (!parsed.address || typeof parsed.address !== 'string') {

      return {
        success: false,
        error: 'アドレスが含まれていません',
      };
    }

    if (!parsed.chainId || parsed.chainId !== 137) {

      return {
        success: false,
        error: 'サポートされていないチェーンです（Polygon Mainnetのみ対応）',
      };
    }

    return {
      success: true,
      type: 'wallet',
      data: {
        type: 'wallet',
        address: parsed.address,
        name: parsed.name,
        chainId: parsed.chainId,
        description: parsed.description,
      },
    };
  } catch (error) {

    return {
      success: false,
      error: 'QRコードの解析に失敗しました',
    };
  }
}

/**
 * 請求書QRコード（X402形式）かチェック
 */
export function isInvoiceQR(qrString: string): boolean {
  return qrString.startsWith('ethereum:') || qrString.startsWith('x402://');
}

/**
 * ガスレス決済QRコードのJSON文字列をパース
 */
export function parseAuthorizationQR(qrString: string): QRScanResult {
  try {
    const parsed = JSON.parse(qrString);

    if (parsed.type !== 'authorization') {

      return {
        success: false,
        error: 'ガスレス決済QRコードではありません',
      };
    }

    // 必須フィールドの検証
    if (!parsed.to || !parsed.value || !parsed.nonce || !parsed.requestId) {

      return {
        success: false,
        error: 'QRコードの形式が不正です',
      };
    }

    if (!parsed.chainId || parsed.chainId !== 137) {

      return {
        success: false,
        error: 'サポートされていないチェーンです（Polygon Mainnetのみ対応）',
      };
    }

    return {
      success: true,
      type: 'authorization',
      data: {
        type: 'authorization',
        to: parsed.to,
        value: parsed.value,
        validBefore: parsed.validBefore,
        nonce: parsed.nonce,
        chainId: parsed.chainId,
        storeName: parsed.storeName,
        requestId: parsed.requestId,
      },
    };
  } catch (error) {

    return {
      success: false,
      error: 'QRコードの解析に失敗しました',
    };
  }
}

/**
 * ウォレットQRコードを生成
 *
 * スキャン成功率を最大化するため、2つの形式を試す:
 * 1. ethereum: URI形式（EIP-681準拠、最もシンプル）- 推奨
 * 2. JSON形式（店舗名などのメタデータが必要な場合）
 */
export function generateWalletQRData(params: {
  address: string;
  name?: string;
  description?: string;
  useSimpleFormat?: boolean; // true = ethereum: URI, false = JSON
}): string {
  // デフォルトは ethereum: URI形式を使用（スキャン成功率が高い）
  const useSimple = params.useSimpleFormat !== false;

  if (useSimple) {
    // ethereum: URI形式 - 最もシンプルでスキャンしやすい
    // 例: ethereum:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb@137
    return `ethereum:${params.address}@137`;
  } else {
    // JSON形式 - メタデータが必要な場合
    const qrData: WalletQRData = {
      type: 'wallet',
      address: params.address,
      name: params.name,
      chainId: 137,
    };
    return JSON.stringify(qrData);
  }
}
