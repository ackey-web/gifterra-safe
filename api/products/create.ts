// api/products/create.ts
// 商品を作成するAPI（RLS バイパス用）
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

interface CreateProductRequest {
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
    const productData: CreateProductRequest = req.body;

    console.log('🆕 [API] 商品作成:', {
      tenant_id: productData.tenant_id,
      name: productData.name
    });

    // SERVICE_ROLE_KEYを使用してRLSをバイパス
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

    return res.json({
      success: true,
      product: data
    });

  } catch (error) {
    console.error('❌ [API] サーバーエラー:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '内部サーバーエラー'
    });
  }
}
