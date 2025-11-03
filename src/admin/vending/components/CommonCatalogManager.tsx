// src/admin/vending/components/CommonCatalogManager.tsx
// 共通カタログ商品管理画面
import React, { useState, useEffect } from 'react';
import { useCommonCatalogProducts } from '../../../hooks/useCommonCatalogProducts';
import { uploadImage, supabase } from '../../../lib/supabase';
import type { SupabaseProduct } from '../../../hooks/useSupabaseProducts';

const DRAFT_STORAGE_KEY = 'common-catalog:draft';
const COMMON_TENANT_ID = 'common';
const DEFAULT_TOKEN = '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea'; // tNHT

interface DraftProduct {
  id?: string;
  name: string;
  description: string;
  priceAmountWei: string;
  stock: number;
  isUnlimited: boolean;
  contentPath: string;
  imageUrl: string;
  updatedAt?: string;
}

export default function CommonCatalogManager() {
  const { products, isLoading, error, refetch } = useCommonCatalogProducts({ isActive: true });

  const [editingProduct, setEditingProduct] = useState<DraftProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // ドラフトの存在確認
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draft) {
      setShowDraftBanner(true);
    }
  }, []);

  // ドラフトを読み込む
  const handleLoadDraft = () => {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draft) {
      setEditingProduct(JSON.parse(draft));
      setShowDraftBanner(false);
    }
  };

  // ドラフトを破棄
  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setShowDraftBanner(false);
  };

  // 新規商品追加
  const handleAddNew = () => {
    setEditingProduct({
      name: '',
      description: '',
      priceAmountWei: '10000000000000000000', // 10 tNHT
      stock: 0,
      isUnlimited: true,
      contentPath: '',
      imageUrl: ''
    });
  };

  // 商品編集
  const handleEdit = (product: SupabaseProduct) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      description: product.description || '',
      priceAmountWei: product.price_amount_wei,
      stock: product.stock,
      isUnlimited: product.is_unlimited,
      contentPath: product.content_path,
      imageUrl: product.image_url || '',
      updatedAt: product.updated_at
    });
  };

  // フォーム変更
  const handleChange = (field: keyof DraftProduct, value: any) => {
    if (!editingProduct) return;

    const updated = { ...editingProduct, [field]: value };
    setEditingProduct(updated);

    // ドラフト保存
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updated));
  };

  // 画像アップロード
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    setUploadingImage(true);
    try {
      const imageUrl = await uploadImage(file, 'gh-public');

      if (imageUrl) {
        handleChange('imageUrl', imageUrl);
        alert('✅ 画像をアップロードしました');
      } else {
        throw new Error('uploadImage returned null');
      }
    } catch (err) {
      console.error('❌ 画像アップロードエラー:', err);

      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes('bucket') || errorMessage.includes('not found')) {
        alert(
          '❌ 画像アップロードに失敗しました\n\n' +
          '原因: Supabase Storage バケット "gh-public" が存在しないか、アクセスできません。\n\n' +
          '解決策:\n' +
          '1. Supabase Dashboard → Storage\n' +
          '2. "gh-public" バケットが存在するか確認\n' +
          '3. バケットのポリシー設定で public アクセスが許可されているか確認'
        );
      } else {
        alert(`❌ 画像のアップロードに失敗しました\n\n${errorMessage}`);
      }
    } finally {
      setUploadingImage(false);
      // ファイル入力をリセット
      e.target.value = '';
    }
  };

  // ファイルアップロード
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    setUploadingFile(true);
    try {
      // 一時的に gh-public バケットにアップロード
      // TODO: 本番環境では gh-downloads（非公開）+ サーバーサイドAPI経由に変更
      const fileUrl = await uploadImage(file, 'gh-public');

      if (fileUrl) {
        // URLからファイルパスを抽出（公開URLから）
        const urlParts = fileUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];

        handleChange('contentPath', fileName);
        alert('✅ 配布ファイルをアップロードしました');
      } else {
        throw new Error('uploadImage returned null');
      }
    } catch (err) {
      console.error('❌ ファイルアップロードエラー:', err);

      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`❌ 配布ファイルのアップロードに失敗しました\n\n${errorMessage}`);
    } finally {
      setUploadingFile(false);
      // ファイル入力をリセット
      e.target.value = '';
    }
  };

  // 保存
  const handleSave = async () => {
    if (!editingProduct) return;

    // バリデーション
    if (!editingProduct.name || !editingProduct.priceAmountWei) {
      alert('商品名と価格は必須です');
      return;
    }

    // contentPath の検証（警告のみ）
    if (!editingProduct.contentPath) {
      const confirmed = confirm(
        '⚠️ 配布ファイルが設定されていません。\n' +
        'このまま保存すると、購入後のダウンロードができません。\n\n' +
        '保存を続けますか？'
      );
      if (!confirmed) return;
    }

    setIsSaving(true);

    try {
      const productData = {
        tenant_id: COMMON_TENANT_ID,
        category: 'common_catalog', // 共通カタログフラグ
        name: editingProduct.name,
        description: editingProduct.description,
        content_path: editingProduct.contentPath,
        image_url: editingProduct.imageUrl,
        price_token: DEFAULT_TOKEN,
        price_amount_wei: editingProduct.priceAmountWei,
        stock: editingProduct.stock,
        is_unlimited: editingProduct.isUnlimited,
        is_active: true,
      };

      if (editingProduct.id) {
        // 更新
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        alert('✅ 共通カタログ商品を更新しました');
      } else {
        // 新規作成
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        alert('✅ 共通カタログ商品を作成しました');
      }

      // 成功したらドラフトを削除
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setEditingProduct(null);

      // データを再取得
      await refetch();

    } catch (err) {
      console.error('❌ 保存エラー:', err);
      alert(`保存に失敗しました\n\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 削除
  const handleDelete = async (product: SupabaseProduct) => {
    if (!confirm(`「${product.name}」を削除しますか？\n※ストレージのファイルも削除されます`)) return;

    try {
      // API経由で削除（ファイルも含む）
      const response = await fetch('/api/delete/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '削除に失敗しました');
      }

      alert('✅ 商品とファイルを削除しました');
      await refetch();
    } catch (err) {
      console.error('❌ 削除エラー:', err);
      alert(`削除に失敗しました\n\n${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 32, backgroundColor: '#FEE', color: '#C00' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>エラー</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFF', marginBottom: 8 }}>
          📦 共通カタログ管理
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
          テナント全体で共有する商品マスター（ホームページ販売用など）
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          tenant_id: {COMMON_TENANT_ID} / category: common_catalog
        </p>
      </div>

      {/* ドラフト復元バナー */}
      {showDraftBanner && (
        <div style={{
          marginBottom: 24,
          padding: 16,
          backgroundColor: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <p style={{ color: '#92400E', fontWeight: 600, marginBottom: 4 }}>未保存のドラフトがあります</p>
            <p style={{ fontSize: 14, color: '#B45309' }}>前回の編集内容を復元しますか？</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleLoadDraft}
              style={{
                padding: '8px 16px',
                backgroundColor: '#D97706',
                color: '#FFF',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              復元する
            </button>
            <button
              onClick={handleDiscardDraft}
              style={{
                padding: '8px 16px',
                backgroundColor: '#9CA3AF',
                color: '#FFF',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              破棄
            </button>
          </div>
        </div>
      )}

      {/* 商品一覧 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#FFF' }}>商品一覧</h2>
          <button
            onClick={handleAddNew}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3B82F6',
              color: '#FFF',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14
            }}
          >
            ＋ 新規商品追加
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{
              width: 32,
              height: 32,
              border: '4px solid #3B82F6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }} />
            <p style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)' }}>読み込み中...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>共通カタログ商品がまだ登録されていません</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {products.map((product) => (
              <div key={product.id} style={{
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: 16,
                backgroundColor: 'rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FFF', marginBottom: 4 }}>{product.name}</h3>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{product.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: '#60A5FA',
                        borderRadius: 4
                      }}>
                        {(Number(product.price_amount_wei) / 1e18).toFixed(0)} tNHT
                      </span>
                      {product.is_unlimited ? (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: 'rgba(34, 197, 94, 0.2)',
                          color: '#4ADE80',
                          borderRadius: 4
                        }}>∞ 在庫無制限</span>
                      ) : product.stock > 0 ? (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: 'rgba(251, 191, 36, 0.2)',
                          color: '#FBBF24',
                          borderRadius: 4
                        }}>在庫: {product.stock}</span>
                      ) : (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          color: '#F87171',
                          borderRadius: 4
                        }}>SOLD OUT</span>
                      )}
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(156, 163, 175, 0.2)',
                        color: '#9CA3AF',
                        borderRadius: 4
                      }}>{product.content_path}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                    <button
                      onClick={() => handleEdit(product)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#10B981',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 13
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#EF4444',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 13
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集フォーム */}
      {editingProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            backgroundColor: '#FFF',
            borderRadius: 8,
            maxWidth: 640,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: '#1F2937' }}>
                {editingProduct.id ? '商品編集' : '新規商品追加'}
              </h2>

              <div style={{ display: 'grid', gap: 16 }}>
                {/* 商品名 */}
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    商品名 *
                  </label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14
                    }}
                    placeholder="例: ベーシックアバター.glb"
                  />
                </div>

                {/* 説明 */}
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    説明
                  </label>
                  <textarea
                    value={editingProduct.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14,
                      resize: 'vertical'
                    }}
                    rows={3}
                    placeholder="商品の説明を入力してください"
                  />
                </div>

                {/* 価格 */}
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    価格（Wei） *
                  </label>
                  <input
                    type="text"
                    value={editingProduct.priceAmountWei}
                    onChange={(e) => handleChange('priceAmountWei', e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14
                    }}
                    placeholder="10000000000000000000 (= 10 tNHT)"
                  />
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    現在: {(Number(editingProduct.priceAmountWei) / 1e18).toFixed(2)} tNHT
                  </p>
                </div>

                {/* 在庫設定 */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingProduct.isUnlimited}
                      onChange={(e) => handleChange('isUnlimited', e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>在庫無制限（∞）</span>
                  </label>
                </div>

                {!editingProduct.isUnlimited && (
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      在庫数
                    </label>
                    <input
                      type="number"
                      value={editingProduct.stock}
                      onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        border: '1px solid #D1D5DB',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 14
                      }}
                      min="0"
                    />
                  </div>
                )}

                {/* 画像アップロード */}
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    サムネイル画像
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{
                      width: '100%',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14
                    }}
                  />
                  {editingProduct.imageUrl && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={editingProduct.imageUrl}
                        alt="Preview"
                        style={{ width: 128, height: 128, objectFit: 'cover', borderRadius: 6 }}
                      />
                    </div>
                  )}
                </div>

                {/* ファイルアップロード */}
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    配布ファイル
                    <span style={{ color: '#EA580C', marginLeft: 4 }}>(購入後のダウンロードに必要)</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    style={{
                      width: '100%',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14
                    }}
                  />
                  {uploadingFile && (
                    <p style={{ fontSize: 12, color: '#3B82F6', marginTop: 4 }}>⏳ アップロード中...</p>
                  )}
                  {editingProduct.contentPath ? (
                    <p style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>✅ パス: {editingProduct.contentPath}</p>
                  ) : (
                    <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>⚠️ ファイル未設定（保存時に警告が表示されます）</p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#9CA3AF',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3B82F6',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 6,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.5 : 1
                  }}
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
