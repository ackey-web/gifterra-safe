// api/admin/products/index.ts
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ========================================
  // GET: 商品一覧取得
  // ========================================
  if (req.method === 'GET') {
    try {
      const { tenantId, isActive } = req.query;

      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      console.log('📦 Fetching products for tenant:', tenantId);

      // クエリ構築
      let query = supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);

      // is_active フィルタ（指定がなければ全件取得）
      if (isActive !== undefined) {
        const activeFilter = isActive === 'true' || isActive === '1';
        query = query.eq('is_active', activeFilter);
      }

      // created_at の降順でソート
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch products:', error);
        return res.status(500).json({ error: 'Failed to fetch products', details: error.message });
      }

      console.log(`✅ Found ${data?.length || 0} products`);

      return res.status(200).json({ products: data || [] });

    } catch (error) {
      console.error('❌ Server error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // ========================================
  // POST: 商品作成（UPSERT）
  // ========================================
  if (req.method === 'POST') {
    try {
      const {
        id,
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

      console.log(`📝 Creating/Updating product for tenant: ${tenantId}`);

      // UPSERT データ構築
      const productData: Partial<ProductRecord> = {
        tenant_id: tenantId,
        name,
        description: description || null,
        content_path: contentPath,
        image_url: imageUrl || null,
        price_token: priceToken,
        price_amount_wei: priceAmountWei,
        stock: isUnlimited ? 0 : stock, // 無制限の場合は stock を無視
        is_unlimited: isUnlimited,
        is_active: isActive !== undefined ? isActive : true
      };

      // 既存レコードの更新（楽観ロック）
      if (id) {
        console.log(`🔄 Updating existing product: ${id}`);

        // 楽観ロック: updated_at の一致を確認
        if (updatedAt) {
          const { data: existing } = await supabase
            .from('products')
            .select('updated_at')
            .eq('id', id)
            .single();

          if (existing && existing.updated_at !== updatedAt) {
            console.warn('⚠️ Optimistic lock conflict detected');
            return res.status(409).json({
              error: 'Conflict: The product has been modified by another user. Please reload and try again.',
              code: 'OPTIMISTIC_LOCK_CONFLICT'
            });
          }
        }

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
      }

      // 新規作成
      console.log('✨ Creating new product');
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create product:', error);
        return res.status(500).json({ error: 'Failed to create product', details: error.message });
      }

      console.log('✅ Product created successfully:', data.id);
      return res.status(201).json({ product: data });

    } catch (error) {
      console.error('❌ Server error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
