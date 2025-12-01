// src/hooks/useProductTokenCheck.ts
// 商品のトークン重複チェックフック

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { TokenId } from '../config/tokens';

/**
 * 商品の重複チェック結果
 */
export interface ProductTokenCheckResult {
  available: boolean;
  conflictToken?: TokenId;
  conflictHubName?: string;
  conflictHubId?: string;
  message?: string;
}

/**
 * 商品のトークン重複チェックフック
 *
 * NHT HUBとJPYC HUBで同一商品が登録されることを防ぐ
 */
export function useProductTokenCheck() {
  const [isChecking, setIsChecking] = useState(false);

  /**
   * 商品名と画像URLから、他のトークン種別のHUBで使用されていないかチェック
   *
   * @param productName 商品名
   * @param productImageUrl 商品画像URL
   * @param currentHubId 現在のHUB ID
   * @param currentHubToken 現在のHUBの受け入れトークン
   * @param excludeProductId チェックから除外する商品ID（編集時に使用）
   * @returns チェック結果
   */
  const checkProductAvailability = async (
    productName: string,
    productImageUrl: string,
    currentHubId: string,
    currentHubToken: TokenId,
    excludeProductId?: string
  ): Promise<ProductTokenCheckResult> => {
    setIsChecking(true);

    try {
      // 同じ商品名と画像URLを持つ商品を検索
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          image_url,
          accepted_token,
          hub_id,
          vending_machines!inner(
            id,
            name,
            settings
          )
        `)
        .eq('name', productName)
        .eq('is_active', true);

      // 画像URLが設定されている場合のみフィルタ
      if (productImageUrl) {
        query = query.eq('image_url', productImageUrl);
      }

      const { data: existingProducts, error } = await query;

      if (error) {
        console.error('❌ [useProductTokenCheck] Error:', error);
        throw error;
      }

      if (!existingProducts || existingProducts.length === 0) {
        return { available: true };
      }

      // 異なるトークン種別のHUBで同一商品が存在するかチェック
      for (const product of existingProducts) {
        // 編集時：自分自身の商品はスキップ
        if (excludeProductId && product.id === excludeProductId) {
          continue;
        }

        // 同じHUBの商品はスキップ
        if (product.hub_id === currentHubId) {
          continue;
        }

        const productToken = product.accepted_token as TokenId;
        const hubToken = product.vending_machines?.settings?.acceptedToken as TokenId;

        // 異なるトークン種別のHUBで同一商品が見つかった場合
        if (productToken && productToken !== currentHubToken) {
          return {
            available: false,
            conflictToken: productToken,
            conflictHubName: product.vending_machines?.name || '不明なHUB',
            conflictHubId: product.hub_id || undefined,
            message: `この商品は既に${productToken} HUB（${product.vending_machines?.name}）で使用されています。${currentHubToken} HUBでは登録できません。`
          };
        }

        // HUBのトークン設定から判定（accepted_tokenが未設定の古いデータ対応）
        if (!productToken && hubToken && hubToken !== currentHubToken) {
          return {
            available: false,
            conflictToken: hubToken,
            conflictHubName: product.vending_machines?.name || '不明なHUB',
            conflictHubId: product.hub_id || undefined,
            message: `この商品は既に${hubToken} HUB（${product.vending_machines?.name}）で使用されています。${currentHubToken} HUBでは登録できません。`
          };
        }
      }

      return { available: true };

    } catch (err) {
      console.error('❌ [useProductTokenCheck] Error:', err);
      return {
        available: false,
        message: '商品の重複チェック中にエラーが発生しました。'
      };
    } finally {
      setIsChecking(false);
    }
  };

  return {
    checkProductAvailability,
    isChecking
  };
}
