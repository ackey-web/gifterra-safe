// src/hooks/useHubProducts.ts
// GIFT HUBに紐づけられた商品を取得するHook
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SupabaseProduct } from './useSupabaseProducts';

export interface HubProduct extends SupabaseProduct {
  display_order: number;
  is_featured: boolean;
  source_type: 'hub_specific' | 'common';
}

interface UseHubProductsOptions {
  hubId: string;
  isActive?: boolean;
}

/**
 * GIFT HUBに紐づけられた商品を取得するHook
 *
 * 以下の商品を統合して返す:
 * 1. HUB専用商品 (tenant_id = hubId, category = 'hub_specific')
 * 2. 共通カタログから追加された商品 (hub_products経由)
 *
 * v_hub_products_full ビューを使用
 *
 * @param options.hubId - GIFT HUBのID
 * @param options.isActive - アクティブな商品のみ取得（デフォルト: true）
 */
export function useHubProducts({ hubId, isActive = true }: UseHubProductsOptions) {
  const [products, setProducts] = useState<HubProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!hubId) {
      setIsLoading(false);
      setProducts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // v_hub_products_full ビューから取得
      let query = supabase
        .from('v_hub_products_full')
        .select('*')
        .eq('hub_id', hubId);

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      // display_order でソート
      query = query.order('display_order', { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Failed to fetch hub products:', fetchError);
        throw new Error(fetchError.message);
      }

      setProducts((data || []) as HubProduct[]);

    } catch (err) {
      console.error('❌ Error fetching hub products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [hubId, isActive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: fetchProducts };
}

/**
 * 共通カタログ商品をGIFT HUBに追加する
 */
export async function addProductToHub(
  hubId: string,
  productId: string,
  displayOrder: number = 0,
  isFeatured: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('add_product_to_hub', {
      p_hub_id: hubId,
      p_product_id: productId,
      p_display_order: displayOrder,
      p_is_featured: isFeatured
    });

    if (error) {
      console.error('❌ Failed to add product to hub:', error);
      return { success: false, error: error.message };
    }

    return { success: data === true };
  } catch (err) {
    console.error('❌ Error adding product to hub:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * 共通カタログ商品をGIFT HUBから削除する
 */
export async function removeProductFromHub(
  hubId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('remove_product_from_hub', {
      p_hub_id: hubId,
      p_product_id: productId
    });

    if (error) {
      console.error('❌ Failed to remove product from hub:', error);
      return { success: false, error: error.message };
    }

    return { success: data === true };
  } catch (err) {
    console.error('❌ Error removing product from hub:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}
