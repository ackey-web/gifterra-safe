// src/hooks/useCommonCatalogProducts.ts
// 共通カタログ商品を取得するHook
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SupabaseProduct } from './useSupabaseProducts';

interface UseCommonCatalogProductsOptions {
  isActive?: boolean;
}

/**
 * 共通カタログ商品を取得するHook
 *
 * 共通カタログ: 複数のGIFT HUBで共有できる商品マスター
 * - category = 'common_catalog'
 * - tenant_id = 'common'
 *
 * @param options.isActive - アクティブな商品のみ取得（デフォルト: true）
 */
export function useCommonCatalogProducts({ isActive = true }: UseCommonCatalogProductsOptions = {}) {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('category', 'common_catalog')
        .eq('tenant_id', 'common');

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      // created_at の降順でソート
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Failed to fetch common catalog products:', fetchError);
        throw new Error(fetchError.message);
      }

      setProducts(data || []);

    } catch (err) {
      console.error('❌ Error fetching common catalog products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [isActive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: fetchProducts };
}
