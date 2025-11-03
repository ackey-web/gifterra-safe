// api/admin/products/[id].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase クライアント（サービスロール）
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ 環境変数が設定されていません', {
    hasUrl: !!supabaseUrl,
    hasServiceRole: !!supabaseServiceRole
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

interface ProductRecord {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  content_path: string;
  image_url?: string;
  price_token: string;
  price_amount_wei: string;
  stock: number;
  is_unlimited: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  // ========================================
  // PUT: 商品更新
  // ========================================
  if (req.method === 'PUT') {
    try {
      const {
        tenantId,
        name,
        description,
        contentPath,
        imageUrl,
        priceToken,
        priceAmountWei,
        stock,
        isUnlimited,
        isActive,
        updatedAt
      } = req.body;

      // バリデーション
      if (!tenantId || !name || !contentPath || !priceToken || !priceAmountWei) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['tenantId', 'name', 'contentPath', 'priceToken', 'priceAmountWei']
        });
      }

      // priceAmountWei が数値文字列であることを検証
      if (!/^\d+$/.test(priceAmountWei)) {
        return res.status(400).json({ error: 'priceAmountWei must be a numeric string' });
      }

      // stock のバリデーション（isUnlimited=false の時のみ）
      if (!isUnlimited && (typeof stock !== 'number' || stock < 0)) {
        return res.status(400).json({ error: 'stock must be a non-negative number when isUnlimited is false' });
      }

      console.log(`🔄 Updating product: ${id}`);

      // 楽観ロック: updated_at の一致を確認
      if (updatedAt) {
        const { data: existing } = await supabase
          .from('products')
          .select('updated_at, tenant_id')
          .eq('id', id)
          .single();

        if (!existing) {
          return res.status(404).json({ error: 'Product not found' });
        }

        // tenant_id の一致も確認（セキュリティ）
        if (existing.tenant_id !== tenantId) {
          return res.status(403).json({ error: 'Forbidden: tenant_id mismatch' });
        }

        if (existing.updated_at !== updatedAt) {
          console.warn('⚠️ Optimistic lock conflict detected');
          return res.status(409).json({
            error: 'Conflict: The product has been modified by another user. Please reload and try again.',
            code: 'OPTIMISTIC_LOCK_CONFLICT'
          });
        }
      }

      // 更新データ構築
      const productData: Partial<ProductRecord> = {
        tenant_id: tenantId,
        name,
        description: description || null,
        content_path: contentPath,
        image_url: imageUrl || null,
        price_token: priceToken,
        price_amount_wei: priceAmountWei,
        stock: isUnlimited ? 0 : stock,
        is_unlimited: isUnlimited,
        is_active: isActive !== undefined ? isActive : true
      };

      // 更新実行
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to update product:', error);
        return res.status(500).json({ error: 'Failed to update product', details: error.message });
      }

      console.log('✅ Product updated successfully');
      return res.status(200).json({ product: data });

    } catch (error) {
      console.error('❌ Server error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // ========================================
  // DELETE: 商品削除（論理削除: is_active=false）
  // ========================================
  if (req.method === 'DELETE') {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      console.log(`🗑️ Deleting product (soft): ${id}`);

      // tenant_id の一致を確認（セキュリティ）
      const { data: existing } = await supabase
        .from('products')
        .select('tenant_id')
        .eq('id', id)
        .single();

      if (!existing) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (existing.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Forbidden: tenant_id mismatch' });
      }

      // 論理削除: is_active を false に
      const { data, error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to delete product:', error);
        return res.status(500).json({ error: 'Failed to delete product', details: error.message });
      }

      console.log('✅ Product deleted (soft) successfully');
      return res.status(200).json({ product: data, message: 'Product deactivated successfully' });

    } catch (error) {
      console.error('❌ Server error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
