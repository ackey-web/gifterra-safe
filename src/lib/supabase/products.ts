// src/lib/supabase/products.ts
// Supabase 商品管理用のヘルパー関数
// サーバーサイドAPIを使用してRLSをバイパス

import type { ProductFormData } from '../../admin/products/ProductForm';

const DEFAULT_TENANT_ID = 'default';
const DEFAULT_TOKEN = '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea'; // tNHT

export interface CreateProductParams {
  tenantId?: string;
  name: string;
  description: string;
  contentPath: string;
  imageUrl: string;
  priceAmountWei: string;
  stock: number;
  isUnlimited: boolean;
}

export interface UpdateProductParams extends CreateProductParams {
  productId: string;
}

/**
 * 商品を新規作成（サーバーサイドAPIを使用してRLSをバイパス）
 * @param params 商品データ
 * @returns 成功/失敗
 */
export async function createProduct(params: CreateProductParams): Promise<{ success: boolean; error?: string }> {
  try {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;

    const productData = {
      tenant_id: tenantId,
      name: params.name,
      description: params.description,
      content_path: params.contentPath,
      image_url: params.imageUrl,
      price_token: DEFAULT_TOKEN,
      price_amount_wei: params.priceAmountWei,
      stock: params.stock,
      is_unlimited: params.isUnlimited,
      is_active: true,
    };

    // サーバーサイドAPIで作成実行（RLSをバイパス）
    const response = await fetch('/api/products/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ 商品作成API エラー:', errorData);
      return {
        success: false,
        error: errorData.error || errorData.details || `作成に失敗しました (${response.status})`
      };
    }

    await response.json();
    return { success: true };
  } catch (err) {
    console.error('❌ 商品作成エラー (catch):', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 商品を更新（サーバーサイドAPIを使用してRLSをバイパス）
 * @param params 商品データ
 * @returns 成功/失敗
 */
export async function updateProduct(params: UpdateProductParams): Promise<{ success: boolean; error?: string }> {
  try {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;

    const updateData = {
      productId: params.productId,
      tenant_id: tenantId,
      name: params.name,
      description: params.description,
      content_path: params.contentPath,
      image_url: params.imageUrl,
      price_token: DEFAULT_TOKEN,
      price_amount_wei: params.priceAmountWei,
      stock: params.stock,
      is_unlimited: params.isUnlimited,
      is_active: true,
    };

    // サーバーサイドAPIで更新実行（RLSをバイパス）
    const response = await fetch('/api/products/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ 商品更新API エラー:', errorData);
      return {
        success: false,
        error: errorData.error || errorData.details || `更新に失敗しました (${response.status})`
      };
    }

    await response.json();
    return { success: true };
  } catch (err) {
    console.error('❌ 商品更新エラー (catch):', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 商品を完全削除（関連ファイルも削除し、データベースからも削除）
 * サーバーサイドAPIを使用してRLSをバイパス
 * @param productId 商品ID
 * @returns 成功/失敗
 */
export async function deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // サーバーサイドAPIで削除実行（RLSをバイパス）
    const response = await fetch('/api/delete/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ 商品削除API エラー:', errorData);
      return {
        success: false,
        error: errorData.error || errorData.details || `削除に失敗しました (${response.status})`
      };
    }

    await response.json();
    return { success: true };
  } catch (err) {
    console.error('❌ 商品削除エラー (catch):', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * ProductFormData を CreateProductParams に変換
 */
export function formDataToCreateParams(formData: ProductFormData, tenantId?: string): CreateProductParams {
  return {
    tenantId,
    name: formData.name,
    description: formData.description,
    contentPath: formData.contentPath,
    imageUrl: formData.imageUrl,
    priceAmountWei: formData.priceAmountWei,
    stock: formData.stock,
    isUnlimited: formData.isUnlimited,
  };
}

/**
 * ProductFormData を UpdateProductParams に変換
 */
export function formDataToUpdateParams(formData: ProductFormData, tenantId?: string): UpdateProductParams | null {
  if (!formData.id) return null;

  return {
    productId: formData.id,
    tenantId,
    name: formData.name,
    description: formData.description,
    contentPath: formData.contentPath,
    imageUrl: formData.imageUrl,
    priceAmountWei: formData.priceAmountWei,
    stock: formData.stock,
    isUnlimited: formData.isUnlimited,
  };
}
