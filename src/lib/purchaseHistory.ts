// src/lib/purchaseHistory.ts
// 購入履歴管理機能

import type { TokenId } from '../config/tokens';
import { getTokenConfig } from '../config/tokens';

/**
 * 購入ステータス
 */
export type PurchaseStatus = 'pending' | 'completed' | 'failed';

/**
 * 購入履歴アイテム
 */
export interface PurchaseHistoryItem {
  id: string;                    // 購入ID (UUID)
  productId: string;             // 商品ID
  productName?: string;          // 商品名
  productSku?: string;           // 商品SKU
  buyer: string;                 // 購入者アドレス
  price: string;                 // 価格（wei）
  priceFormatted: string;        // フォーマット済み価格
  paymentToken: string;          // 決済トークンアドレス
  tokenSymbol: string;           // トークンシンボル
  status: PurchaseStatus;        // ステータス
  transactionHash?: string;      // トランザクションハッシュ
  nftDistributed: boolean;       // NFT配布済みか
  createdAt: string;             // 作成日時（ISO string）
  updatedAt?: string;            // 更新日時（ISO string）
}

/**
 * フィルタ条件
 */
export interface PurchaseFilter {
  startDate?: string;      // 開始日（ISO string）
  endDate?: string;        // 終了日（ISO string）
  status?: PurchaseStatus; // ステータス
  productId?: string;      // 商品ID
  tokenId?: TokenId;       // トークンID
  buyerAddress?: string;   // 購入者アドレス
}

/**
 * Supabaseから購入履歴を取得（モック実装）
 * TODO: Supabaseクライアント統合
 *
 * @param filter フィルタ条件
 * @param limit 取得件数制限
 * @param offset オフセット
 * @returns 購入履歴配列
 */
export async function fetchPurchaseHistory(
  filter?: PurchaseFilter,
  limit: number = 50,
  offset: number = 0
): Promise<PurchaseHistoryItem[]> {
  // TODO: Supabaseから実データを取得
  // const { data, error } = await supabase
  //   .from('purchases')
  //   .select('*')
  //   .range(offset, offset + limit - 1)
  //   .order('created_at', { ascending: false });

  // モックデータ（開発用）
  const mockData: PurchaseHistoryItem[] = [
    {
      id: '1',
      productId: 'prod_001',
      productName: 'サンプル商品A',
      productSku: 'SKU001',
      buyer: '0x1234567890123456789012345678901234567890',
      price: '1000000000000000000', // 1 token
      priceFormatted: '1.0',
      paymentToken: '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
      tokenSymbol: 'tNHT',
      status: 'completed',
      transactionHash: '0xabc...',
      nftDistributed: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      productId: 'prod_002',
      productName: 'サンプル商品B',
      productSku: 'SKU002',
      buyer: '0xabcdef1234567890123456789012345678901234',
      price: '5000000000000000000', // 5 tokens
      priceFormatted: '5.0',
      paymentToken: '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
      tokenSymbol: 'tNHT',
      status: 'pending',
      transactionHash: '0xdef...',
      nftDistributed: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
  ];

  // フィルタリング
  let filtered = mockData;

  if (filter?.status) {
    filtered = filtered.filter(item => item.status === filter.status);
  }

  if (filter?.productId) {
    filtered = filtered.filter(item => item.productId === filter.productId);
  }

  if (filter?.buyerAddress) {
    filtered = filtered.filter(item =>
      item.buyer.toLowerCase().includes(filter.buyerAddress!.toLowerCase())
    );
  }

  if (filter?.tokenId) {
    const tokenConfig = getTokenConfig(filter.tokenId);
    filtered = filtered.filter(
      item => item.paymentToken.toLowerCase() === tokenConfig.currentAddress.toLowerCase()
    );
  }

  if (filter?.startDate) {
    const startTime = new Date(filter.startDate).getTime();
    filtered = filtered.filter(item => new Date(item.createdAt).getTime() >= startTime);
  }

  if (filter?.endDate) {
    const endTime = new Date(filter.endDate).getTime();
    filtered = filtered.filter(item => new Date(item.createdAt).getTime() <= endTime);
  }

  // ページネーション
  return filtered.slice(offset, offset + limit);
}

/**
 * 購入履歴をCSV形式でエクスポート
 *
 * @param items 購入履歴配列
 * @returns CSV文字列
 */
export function exportPurchaseHistoryToCSV(items: PurchaseHistoryItem[]): string {
  const headers = [
    '購入ID',
    '商品ID',
    '商品名',
    'SKU',
    '購入者アドレス',
    '価格',
    'トークン',
    'ステータス',
    'NFT配布済み',
    'トランザクションハッシュ',
    '購入日時',
  ];

  const rows = items.map(item => [
    item.id,
    item.productId,
    item.productName || '',
    item.productSku || '',
    item.buyer,
    item.priceFormatted,
    item.tokenSymbol,
    item.status,
    item.nftDistributed ? 'はい' : 'いいえ',
    item.transactionHash || '',
    new Date(item.createdAt).toLocaleString('ja-JP'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * CSVファイルをダウンロード
 *
 * @param csvContent CSV文字列
 * @param filename ファイル名
 */
export function downloadCSV(csvContent: string, filename: string = 'purchase_history.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 購入統計を計算
 *
 * @param items 購入履歴配列
 * @returns 統計情報
 */
export function calculatePurchaseStats(items: PurchaseHistoryItem[]) {
  const totalSales = items.reduce((sum, item) => {
    return sum + BigInt(item.price || '0');
  }, 0n);

  const completedCount = items.filter(item => item.status === 'completed').length;
  const pendingCount = items.filter(item => item.status === 'pending').length;
  const failedCount = items.filter(item => item.status === 'failed').length;
  const nftDistributedCount = items.filter(item => item.nftDistributed).length;

  return {
    totalCount: items.length,
    completedCount,
    pendingCount,
    failedCount,
    nftDistributedCount,
    totalSales,
  };
}
