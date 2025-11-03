// src/lib/vendingStats.ts
// GIFT HUB統計データの計算ロジック

import type { PurchaseHistoryItem } from './purchaseHistory';
import type { Product } from '../types/vending';
import type { TokenId } from '../config/tokens';
import { TOKEN_MASTER_DATA } from '../config/tokens';

/**
 * 時系列データポイント
 */
export interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD format
  sales: number; // 売上額（wei単位）
  salesFormatted: string; // フォーマット済み売上
  count: number; // 販売数
  tokenId: TokenId;
  tokenSymbol: string;
}

/**
 * 商品別統計
 */
export interface ProductStats {
  productId: string;
  productName: string;
  productSku: string;
  salesCount: number; // 販売数
  totalRevenue: string; // 総売上（wei）
  totalRevenueFormatted: string; // フォーマット済み
  tokenBreakdown: {
    tokenId: TokenId;
    tokenSymbol: string;
    count: number;
    revenue: string;
    revenueFormatted: string;
  }[];
}

/**
 * トークン別統計
 */
export interface TokenStats {
  tokenId: TokenId;
  tokenSymbol: string;
  salesCount: number;
  totalRevenue: string;
  totalRevenueFormatted: string;
  percentage: number; // 全体売上に対する割合
}

/**
 * 全体サマリー統計
 */
export interface VendingStatsSummary {
  totalSales: number; // 総販売数
  totalRevenue: string; // 総売上（全トークン合計、単位は統一されていない）
  totalRevenueByToken: TokenStats[]; // トークン別売上
  completedPurchases: number;
  pendingPurchases: number;
  failedPurchases: number;
  uniqueBuyers: number;
  averageOrderValue: string; // 平均注文額
}

/**
 * 時間フィルタの種類
 */
export type TimePeriod = 'day' | 'week' | 'month' | 'all';

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 時間フィルタに基づいて日付範囲を計算
 */
export function getDateRange(period: TimePeriod): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = formatDate(now);

  let startDate: string;

  switch (period) {
    case 'day':
      // 過去24時間
      startDate = endDate;
      break;
    case 'week':
      // 過去7日間
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = formatDate(weekAgo);
      break;
    case 'month':
      // 過去30日間
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      startDate = formatDate(monthAgo);
      break;
    case 'all':
      // 全期間（2020年1月1日から）
      startDate = '2020-01-01';
      break;
  }

  return { startDate, endDate };
}

/**
 * フォーマット用ヘルパー: wei から読みやすい形式に変換
 */
function formatWeiAmount(weiAmount: string, tokenId: TokenId): string {
  const config = TOKEN_MASTER_DATA[tokenId];
  if (!config) return weiAmount;

  const amount = BigInt(weiAmount);
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
 * 全体サマリー統計を計算
 */
export function calculateVendingStatsSummary(
  purchases: PurchaseHistoryItem[]
): VendingStatsSummary {
  // ステータス別カウント
  const completedPurchases = purchases.filter(p => p.status === 'completed').length;
  const pendingPurchases = purchases.filter(p => p.status === 'pending').length;
  const failedPurchases = purchases.filter(p => p.status === 'failed').length;

  // ユニークな購入者数
  const uniqueBuyers = new Set(purchases.map(p => p.buyer.toLowerCase())).size;

  // トークン別売上集計
  const tokenRevenueMap = new Map<TokenId, { count: number; revenue: bigint }>();

  purchases.forEach(purchase => {
    if (purchase.status !== 'completed') return;

    const tokenId = purchase.tokenSymbol.replace('t', '') as TokenId; // tNHT -> NHT
    const existing = tokenRevenueMap.get(tokenId) || { count: 0, revenue: 0n };

    tokenRevenueMap.set(tokenId, {
      count: existing.count + 1,
      revenue: existing.revenue + BigInt(purchase.price),
    });
  });

  // トークン別統計を配列に変換
  const totalRevenueByToken: TokenStats[] = Array.from(tokenRevenueMap.entries()).map(
    ([tokenId, data]) => ({
      tokenId,
      tokenSymbol: TOKEN_MASTER_DATA[tokenId]?.symbol || tokenId,
      salesCount: data.count,
      totalRevenue: data.revenue.toString(),
      totalRevenueFormatted: formatWeiAmount(data.revenue.toString(), tokenId),
      percentage: 0, // 後で計算
    })
  );

  // 全体売上計算（NHTベースで統一、他トークンは換算不可のため個別表示）
  const totalSales = completedPurchases;
  const totalRevenue = totalRevenueByToken.length > 0
    ? totalRevenueByToken[0].totalRevenue
    : '0';

  // 割合計算（販売数ベース）
  totalRevenueByToken.forEach(token => {
    token.percentage = totalSales > 0 ? (token.salesCount / totalSales) * 100 : 0;
  });

  // 平均注文額（NHTベース）
  const averageOrderValue =
    totalSales > 0 && totalRevenueByToken.length > 0
      ? (BigInt(totalRevenueByToken[0].totalRevenue) / BigInt(totalSales)).toString()
      : '0';

  return {
    totalSales,
    totalRevenue,
    totalRevenueByToken,
    completedPurchases,
    pendingPurchases,
    failedPurchases,
    uniqueBuyers,
    averageOrderValue,
  };
}

/**
 * 商品別統計を計算
 */
export function calculateProductStats(
  purchases: PurchaseHistoryItem[],
  products: Product[]
): ProductStats[] {
  const productStatsMap = new Map<string, {
    productId: string;
    productName: string;
    productSku: string;
    salesCount: number;
    tokenRevenue: Map<TokenId, { count: number; revenue: bigint }>;
  }>();

  // 完了した購入のみ集計
  const completedPurchases = purchases.filter(p => p.status === 'completed');

  completedPurchases.forEach(purchase => {
    const productId = purchase.productId;
    const tokenId = purchase.tokenSymbol.replace('t', '') as TokenId;

    if (!productStatsMap.has(productId)) {
      const product = products.find(p => p.id === productId);
      productStatsMap.set(productId, {
        productId,
        productName: purchase.productName || product?.name || 'Unknown Product',
        productSku: purchase.productSku || product?.id || productId,
        salesCount: 0,
        tokenRevenue: new Map(),
      });
    }

    const stats = productStatsMap.get(productId)!;
    stats.salesCount += 1;

    const existingToken = stats.tokenRevenue.get(tokenId) || { count: 0, revenue: 0n };
    stats.tokenRevenue.set(tokenId, {
      count: existingToken.count + 1,
      revenue: existingToken.revenue + BigInt(purchase.price),
    });
  });

  // Map を ProductStats[] に変換
  const productStats: ProductStats[] = Array.from(productStatsMap.values()).map(stats => {
    const tokenBreakdown = Array.from(stats.tokenRevenue.entries()).map(([tokenId, data]) => ({
      tokenId,
      tokenSymbol: TOKEN_MASTER_DATA[tokenId]?.symbol || tokenId,
      count: data.count,
      revenue: data.revenue.toString(),
      revenueFormatted: formatWeiAmount(data.revenue.toString(), tokenId),
    }));

    // 総売上（最初のトークンベース、複数トークンの場合は合算不可）
    const totalRevenue = tokenBreakdown.length > 0 ? tokenBreakdown[0].revenue : '0';
    const totalRevenueFormatted = tokenBreakdown.length > 0
      ? tokenBreakdown[0].revenueFormatted
      : '0';

    return {
      productId: stats.productId,
      productName: stats.productName,
      productSku: stats.productSku,
      salesCount: stats.salesCount,
      totalRevenue,
      totalRevenueFormatted,
      tokenBreakdown,
    };
  });

  // 販売数で降順ソート
  return productStats.sort((a, b) => b.salesCount - a.salesCount);
}

/**
 * 時系列データを計算（日別売上推移）
 */
export function calculateTimeSeriesData(
  purchases: PurchaseHistoryItem[],
  period: TimePeriod
): TimeSeriesDataPoint[] {
  const { startDate, endDate } = getDateRange(period);
  const completedPurchases = purchases.filter(p => p.status === 'completed');

  // 日付ごと、トークンごとにグループ化
  const dateTokenMap = new Map<string, Map<TokenId, { count: number; revenue: bigint }>>();

  completedPurchases.forEach(purchase => {
    // createdAt から日付部分を取得 (YYYY-MM-DD)
    const purchaseDate = purchase.createdAt.split('T')[0];

    // 期間フィルタ
    if (purchaseDate < startDate || purchaseDate > endDate) return;

    const tokenId = purchase.tokenSymbol.replace('t', '') as TokenId;

    if (!dateTokenMap.has(purchaseDate)) {
      dateTokenMap.set(purchaseDate, new Map());
    }

    const tokenMap = dateTokenMap.get(purchaseDate)!;
    const existing = tokenMap.get(tokenId) || { count: 0, revenue: 0n };

    tokenMap.set(tokenId, {
      count: existing.count + 1,
      revenue: existing.revenue + BigInt(purchase.price),
    });
  });

  // TimeSeriesDataPoint[] に変換
  const dataPoints: TimeSeriesDataPoint[] = [];

  dateTokenMap.forEach((tokenMap, date) => {
    tokenMap.forEach((data, tokenId) => {
      dataPoints.push({
        date,
        sales: Number(data.revenue), // グラフ表示用にnumberに変換
        salesFormatted: formatWeiAmount(data.revenue.toString(), tokenId),
        count: data.count,
        tokenId,
        tokenSymbol: TOKEN_MASTER_DATA[tokenId]?.symbol || tokenId,
      });
    });
  });

  // 日付で昇順ソート
  return dataPoints.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 人気商品ランキングを取得（トップN）
 */
export function getTopProducts(
  productStats: ProductStats[],
  limit: number = 10
): ProductStats[] {
  return productStats.slice(0, limit);
}
