// api/products/index.ts
// 商品の作成・更新API（RLS バイパス用）
// セキュリティ: サーバーサイドでSERVICE_ROLE_KEYを使用

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ProductRequest {
  action: 'create' | 'update';
  productId?: string;
  tenant_id: string;
  name: string;
  description: string;
  content_path: string;
  image_url: string;
  price_token: string;
  price_amount_wei: string;
  stock: number;
  is_unlimited: boolean;
  is_active: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, productId, ...productData }: ProductRequest = req.body;

    if (action === 'create') {
      console.log('🆕 [API] 商品作成:', {
        tenant_id: productData.tenant_id,
        name: productData.name
      });

      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) {
        console.error('❌ [API] 商品作成エラー:', error);
        return res.status(500).json({
          error: '商品の作成に失敗しました',
          details: error.message,
          code: error.code
        });
      }

      console.log('✅ [API] 商品作成成功:', data.id);
      return res.json({ success: true, product: data });
    }

    if (action === 'update') {
      if (!productId) {
        return res.status(400).json({ error: 'productId は必須です' });
      }

      console.log('🔄 [API] 商品更新:', {
        productId,
        tenant_id: productData.tenant_id,
        name: productData.name
      });

      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        console.error('❌ [API] 商品更新エラー:', error);
        return res.status(500).json({
          error: '商品の更新に失敗しました',
          details: error.message,
          code: error.code
        });
      }

      console.log('✅ [API] 商品更新成功:', productId);
      return res.json({ success: true, product: data });
    }

    return res.status(400).json({ error: 'action は create または update を指定してください' });

  } catch (error) {
    console.error('❌ [API] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
