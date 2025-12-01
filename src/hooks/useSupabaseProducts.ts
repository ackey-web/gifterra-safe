// src/hooks/useSupabaseProducts.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface SupabaseProduct {
  id: string;
  /**
   * @deprecated Use tenant_uuid instead
   * Legacy tenant_id (TEXT) for backward compatibility
   */
  tenant_id: string;
  /**
   * Tenant UUID from tenant_applications.tenant_id
   * Added in migration 20250301000000
   */
  tenant_uuid?: string | null;
  /**
   * GIFT HUB UUID from vending_machines.id
   * Links product to specific hub
   */
  hub_id?: string | null;
  name: string;
  description: string | null;
  content_path: string;
  image_url: string | null;
  price_token: string;
  price_amount_wei: string;
  stock: number;
  is_unlimited: boolean;
  is_active: boolean;
  category?: 'hub_specific' | 'common_catalog';
  created_at: string;
  updated_at: string;
}

interface UseSupabaseProductsOptions {
  tenantId: string;
  isActive?: boolean;
}

export function useSupabaseProducts({ tenantId, isActive = true }: UseSupabaseProductsOptions) {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    // tenantIdが空の場合は早期リターン（GIFT HUBデータ読み込み中）
    if (!tenantId) {
      setIsLoading(false);
      setProducts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {

      let query = supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      // created_at の降順でソート
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Failed to fetch products:', fetchError);
        throw new Error(fetchError.message);
      }

      setProducts(data || []);

    } catch (err) {
      console.error('❌ Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, isActive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: fetchProducts };
}
