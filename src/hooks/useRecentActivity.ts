// src/hooks/useRecentActivity.ts
// 最近のアクティビティ取得フック

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * アクティビティの種類
 */
export type ActivityCategory =
  | 'distribution'  // 特典配布
  | 'hub_created'   // GIFT HUB作成
  | 'hub_updated'   // GIFT HUB更新
  | 'product_added' // 商品追加
  | 'tip_sent'      // Tip送信
  | 'reward_claimed' // Reward受取
  | 'system';       // システムイベント

/**
 * アクティビティアイテム
 */
export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    hubId?: string;
    hubName?: string;
    productId?: string;
    productName?: string;
    userAddress?: string;
    amount?: string;
    txHash?: string;
  };
  severity?: 'info' | 'warning' | 'error' | 'success';
}

/**
 * 最近のアクティビティ取得フック
 *
 * @param limit - 取得件数（デフォルト: 50）
 * @param category - フィルタするカテゴリ（オプション）
 */
export function useRecentActivity(limit: number = 50, category?: ActivityCategory) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setIsLoading(true);
        const activityList: ActivityItem[] = [];

        // 配布履歴を取得
        if (!category || category === 'distribution') {
          const { data: purchases, error: purchasesError } = await supabase
            .from('purchase_history')
            .select('id, hub_id, product_name, buyer_address, amount, created_at')
            .order('created_at', { ascending: false })
            .limit(category === 'distribution' ? limit : 20);

          if (purchasesError) throw purchasesError;

          if (purchases) {
            activityList.push(...purchases.map(p => ({
              id: `purchase-${p.id}`,
              category: 'distribution' as ActivityCategory,
              title: '特典配布',
              description: `${p.product_name} が配布されました`,
              timestamp: new Date(p.created_at),
              metadata: {
                hubId: p.hub_id,
                productName: p.product_name,
                userAddress: p.buyer_address,
                amount: p.amount,
              },
              severity: 'success' as const,
            })));
          }
        }

        // GIFT HUB作成イベントを取得
        if (!category || category === 'hub_created') {
          const { data: hubs, error: hubsError } = await supabase
            .from('vending_machines')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(category === 'hub_created' ? limit : 10);

          if (hubsError) throw hubsError;

          if (hubs) {
            activityList.push(...hubs.map(h => ({
              id: `hub-created-${h.id}`,
              category: 'hub_created' as ActivityCategory,
              title: 'GIFT HUB作成',
              description: `新しいGIFT HUB「${h.name}」が作成されました`,
              timestamp: new Date(h.created_at),
              metadata: {
                hubId: h.id,
                hubName: h.name,
              },
              severity: 'info' as const,
            })));
          }
        }

        // 商品追加イベントを取得
        if (!category || category === 'product_added') {
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(category === 'product_added' ? limit : 10);

          if (productsError) throw productsError;

          if (products) {
            activityList.push(...products.map(p => ({
              id: `product-added-${p.id}`,
              category: 'product_added' as ActivityCategory,
              title: '商品追加',
              description: `新しい商品「${p.name}」が追加されました`,
              timestamp: new Date(p.created_at),
              metadata: {
                productId: p.id,
                productName: p.name,
              },
              severity: 'info' as const,
            })));
          }
        }

        // タイムスタンプでソート（新しい順）
        activityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // 制限数まで切り詰め
        setActivities(activityList.slice(0, limit));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch activities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();

    // 30秒ごとに更新
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [limit, category]);

  return {
    activities,
    isLoading,
    error,
    refetch: () => setIsLoading(true),
  };
}

/**
 * アクティビティカテゴリの表示情報を取得
 */
export function getActivityCategoryInfo(category: ActivityCategory): {
  icon: string;
  color: string;
  label: string;
} {
  switch (category) {
    case 'distribution':
      return { icon: '🎁', color: '#10b981', label: '配布' };
    case 'hub_created':
      return { icon: '🏪', color: '#3b82f6', label: 'HUB作成' };
    case 'hub_updated':
      return { icon: '✏️', color: '#8b5cf6', label: 'HUB更新' };
    case 'product_added':
      return { icon: '📦', color: '#06b6d4', label: '商品追加' };
    case 'tip_sent':
      return { icon: '💸', color: '#f59e0b', label: 'Tip送信' };
    case 'reward_claimed':
      return { icon: '🎉', color: '#ec4899', label: 'Reward受取' };
    case 'system':
      return { icon: '⚙️', color: '#6b7280', label: 'システム' };
    default:
      return { icon: '📝', color: '#6b7280', label: '不明' };
  }
}
