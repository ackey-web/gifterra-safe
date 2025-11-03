// src/lib/adminApi.ts
/**
 * Admin API クライアント
 * Supabase products テーブルとの CRUD 操作
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface ProductData {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  contentPath: string;
  imageUrl?: string;
  priceToken: string;
  priceAmountWei: string;
  stock: number;
  isUnlimited: boolean;
  isActive?: boolean;
  updatedAt?: string; // 楽観ロック用
}

export interface ProductRecord extends ProductData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetProductsResponse {
  products: ProductRecord[];
}

export interface SaveProductResponse {
  product: ProductRecord;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

/**
 * 商品一覧を取得
 */
export async function getProducts(
  tenantId: string,
  options?: { isActive?: boolean }
): Promise<ProductRecord[]> {
  const params = new URLSearchParams({ tenantId });

  if (options?.isActive !== undefined) {
    params.append('isActive', options.isActive ? 'true' : 'false');
  }

  const url = `${API_BASE_URL}/api/admin/products?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Failed to fetch products');
  }

  const data: GetProductsResponse = await response.json();
  return data.products;
}

/**
 * 商品を作成または更新（UPSERT）
 */
export async function saveProduct(productData: ProductData): Promise<ProductRecord> {
  const url = `${API_BASE_URL}/api/admin/products`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();

    // 楽観ロック衝突
    if (response.status === 409) {
      throw new Error(error.error || 'Conflict detected');
    }

    throw new Error(error.error || 'Failed to save product');
  }

  const data: SaveProductResponse = await response.json();
  return data.product;
}

/**
 * 商品を更新（PUT）
 */
export async function updateProduct(
  id: string,
  productData: ProductData
): Promise<ProductRecord> {
  const url = `${API_BASE_URL}/api/admin/products/${id}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();

    // 楽観ロック衝突
    if (response.status === 409) {
      throw new Error(error.error || 'Conflict detected');
    }

    throw new Error(error.error || 'Failed to update product');
  }

  const data: SaveProductResponse = await response.json();
  return data.product;
}

/**
 * 商品を削除（論理削除: is_active=false）
 */
export async function deleteProduct(id: string, tenantId: string): Promise<void> {
  const url = `${API_BASE_URL}/api/admin/products/${id}?tenantId=${encodeURIComponent(tenantId)}`;

  const response = await fetch(url, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Failed to delete product');
  }
}
