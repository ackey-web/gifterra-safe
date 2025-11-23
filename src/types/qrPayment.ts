// src/types/qrPayment.ts
// QRコード決済の型定義

/**
 * QRコード決済のタイプ
 */
export type QRPaymentType = 'invoice' | 'wallet';

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
 * QRコードデータの統合型
 */
export type QRPaymentData = InvoiceQRData | WalletQRData;

/**
 * QRスキャン結果
 */
export interface QRScanResult {
  success: boolean;
  type?: QRPaymentType;
  data?: InvoiceQRData | WalletQRData;
  error?: string;
}

/**
 * ウォレットQRコードのJSON文字列をパース
 */
export function parseWalletQR(qrString: string): QRScanResult {
  try {
    console.log('🔍 parseWalletQR 入力:', qrString.substring(0, 100));
    const parsed = JSON.parse(qrString);
    console.log('📦 JSON parse成功:', parsed);

    if (parsed.type !== 'wallet') {
      console.log('❌ typeがwalletではない:', parsed.type);
      return {
        success: false,
        error: 'ウォレットQRコードではありません',
      };
    }

    if (!parsed.address || typeof parsed.address !== 'string') {
      console.log('❌ addressが不正:', parsed.address);
      return {
        success: false,
        error: 'アドレスが含まれていません',
      };
    }

    if (!parsed.chainId || parsed.chainId !== 137) {
      console.log('❌ chainIdが不正:', parsed.chainId);
      return {
        success: false,
        error: 'サポートされていないチェーンです（Polygon Mainnetのみ対応）',
      };
    }

    console.log('✅ ウォレットQR parse成功');
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
    console.log('❌ JSON parseエラー:', error);
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
 * ウォレットQRコードを生成
 * QRコードのスキャン成功率を上げるため、データを最小化
 */
export function generateWalletQRData(params: {
  address: string;
  name?: string;
  description?: string;
}): string {
  // 必須フィールドのみのコンパクトな形式
  const qrData: WalletQRData = {
    type: 'wallet',
    address: params.address,
    name: params.name,
    chainId: 137, // Polygon Mainnet
    // descriptionは含めない（QRコードのデータ量削減のため）
  };

  // 不要なスペースを削除したコンパクトなJSON
  return JSON.stringify(qrData);
}
