// src/admin/products/ProductManager.tsx
// Supabase 正本版の商品管理画面（簡易版）
import React, { useState, useEffect } from 'react';
import { useSupabaseProducts, type SupabaseProduct } from '../../hooks/useSupabaseProducts';
import { uploadImage, supabase } from '../../lib/supabase';

const DRAFT_STORAGE_KEY = 'product-manager:draft';
const DEFAULT_TENANT_ID = 'default';
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

export default function ProductManager() {
  const tenantId = DEFAULT_TENANT_ID;
  const { products, isLoading, error, refetch } = useSupabaseProducts({ tenantId, isActive: true });

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
        tenant_id: tenantId,
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
        alert('✅ 商品を更新しました');
      } else {
        // 新規作成
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        alert('✅ 商品を作成しました');
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
      // 1. Storageのファイルを削除（content_path と image_url）
      const deletePromises = [];

      if (product.content_path) {
        deletePromises.push(
          fetch('/api/delete/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: product.content_path })
          }).catch(err => {
            console.warn('⚠️ 配布ファイル削除エラー:', err);
          })
        );
      }

      // 画像ファイルも削除（公開バケット）
      if (product.image_url) {
        // 画像は公開バケットなので既存のdeleteFileFromUrl関数を使用
        // ※後でimport追加が必要な場合あり
      }

      // Storageファイル削除を待機
      await Promise.all(deletePromises);

      // 2. データベースから商品を完全に削除
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      alert('✅ 特典とファイルを削除しました');
      await refetch();
    } catch (err) {
      console.error('❌ 削除エラー:', err);
      alert(`削除に失敗しました\n\n${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (error) {
    return (
      <div className="p-8 bg-red-50 text-red-700">
        <h2 className="text-xl font-bold mb-2">エラー</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">商品管理（Supabase 版）</h1>
        <p className="text-sm text-gray-600 mt-2">tenant: {tenantId}</p>
      </div>

      {/* ドラフト復元バナー */}
      {showDraftBanner && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-yellow-800 font-semibold">未保存のドラフトがあります</p>
            <p className="text-sm text-yellow-700">前回の編集内容を復元しますか？</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadDraft}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              復元する
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              破棄
            </button>
          </div>
        </div>
      )}

      {/* 商品一覧 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-700">商品一覧</h2>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
          >
            ＋ 新規商品追加
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">商品がまだ登録されていません</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {products.map((product) => (
              <div key={product.id} className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {(Number(product.price_amount_wei) / 1e18).toFixed(0)} tNHT
                      </span>
                      {product.is_unlimited ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">∞ 在庫無制限</span>
                      ) : product.stock > 0 ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">在庫: {product.stock}</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded">SOLD OUT</span>
                      )}
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">{product.content_path}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(product)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                {editingProduct.id ? '商品編集' : '新規商品追加'}
              </h2>

              <div className="space-y-4">
                {/* 商品名 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商品名 *</label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="例: ベーシックアバター.glb"
                  />
                </div>

                {/* 説明 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">説明</label>
                  <textarea
                    value={editingProduct.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    rows={3}
                    placeholder="商品の説明を入力してください"
                  />
                </div>

                {/* 価格 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">価格（Wei） *</label>
                  <input
                    type="text"
                    value={editingProduct.priceAmountWei}
                    onChange={(e) => handleChange('priceAmountWei', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="10000000000000000000 (= 10 tNHT)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    現在: {(Number(editingProduct.priceAmountWei) / 1e18).toFixed(2)} tNHT
                  </p>
                </div>

                {/* 在庫設定 */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.isUnlimited}
                      onChange={(e) => handleChange('isUnlimited', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-semibold text-gray-700">在庫無制限（∞）</span>
                  </label>
                </div>

                {!editingProduct.isUnlimited && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">在庫数</label>
                    <input
                      type="number"
                      value={editingProduct.stock}
                      onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      min="0"
                    />
                  </div>
                )}

                {/* 画像アップロード */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">サムネイル画像</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  {editingProduct.imageUrl && (
                    <div className="mt-2">
                      <img src={editingProduct.imageUrl} alt="Preview" className="w-32 h-32 object-cover rounded" />
                    </div>
                  )}
                </div>

                {/* ファイルアップロード */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    配布ファイル
                    <span className="text-orange-600 ml-1">(購入後のダウンロードに必要)</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  {uploadingFile && (
                    <p className="text-xs text-blue-600 mt-1">⏳ アップロード中...</p>
                  )}
                  {editingProduct.contentPath ? (
                    <p className="text-xs text-green-600 mt-1">✅ パス: {editingProduct.contentPath}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">⚠️ ファイル未設定（保存時に警告が表示されます）</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                  }}
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
