// src/admin/products/ProductForm.tsx
// 商品作成・編集用の再利用可能なフォームコンポーネント
import React, { useState, useRef } from 'react';
import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { uploadImage, deleteFileFromUrl } from '../../lib/supabase';
import { calculateFileHash } from '../../utils/fileHash';
import type { PaymentSplit } from '../../lib/royalty';
import {
  getRoyaltyInfo,
  createPaymentSplit,
  createManualPaymentSplit,
  validatePaymentSplit,
  formatPaymentSplit,
} from '../../lib/royalty';

export interface ProductFormData {
  id?: string;
  name: string;
  description: string;
  priceAmountWei: string;
  stock: number;
  isUnlimited: boolean;
  contentPath: string;
  imageUrl: string;
  updatedAt?: string;
  // PaymentSplitter統合
  paymentSplit?: PaymentSplit | null;
  nftAddress?: string; // EIP-2981検出用
}

interface ProductFormProps {
  initialData?: ProductFormData;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  tokenSymbol?: 'tNHT' | 'JPYC'; // 使用するトークン
  tenantOwnerAddress?: string; // テナントオーナーアドレス（収益分配用）
}

const DEFAULT_FORM_DATA: ProductFormData = {
  name: '',
  description: '',
  priceAmountWei: '10000000000000000000', // 10 tNHT
  stock: 0,
  isUnlimited: true,
  contentPath: '',
  imageUrl: '',
  paymentSplit: null,
  nftAddress: '',
};

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  tokenSymbol = 'tNHT',
  tenantOwnerAddress = '0x0000000000000000000000000000000000000000', // デフォルト値
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>(
    initialData || DEFAULT_FORM_DATA
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // 現在アップロードされているファイルのハッシュを追跡
  const [currentImageHash, setCurrentImageHash] = useState<string | null>(null);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);

  // 初期データから設定されたURLを保持（差し替え時の削除用）
  const previousImageUrlRef = useRef<string | null>(initialData?.imageUrl || null);
  const previousContentPathRef = useRef<string | null>(initialData?.contentPath || null);

  // PaymentSplit関連の状態
  const [detectingRoyalty, setDetectingRoyalty] = useState(false);
  const [manualCreatorAddress, setManualCreatorAddress] = useState('');
  const [manualCreatorShare, setManualCreatorShare] = useState(10); // 10% デフォルト
  const [splitMode, setSplitMode] = useState<'none' | 'auto' | 'manual'>('none');

  const handleChange = (field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // EIP-2981自動検出
  const handleAutoDetectRoyalty = async () => {
    if (!formData.nftAddress) {
      alert('⚠️ NFTアドレスを入力してください');
      return;
    }

    setDetectingRoyalty(true);
    try {
      // publicClientを作成
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(),
      });

      // 仮の販売価格で検出（100 tNHT）
      const testSalePrice = BigInt('100000000000000000000'); // 100 * 10^18
      const royaltyInfo = await getRoyaltyInfo(
        formData.nftAddress,
        0n, // tokenId = 0 (コレクション全体のデフォルト)
        testSalePrice,
        publicClient
      );

      if (!royaltyInfo) {
        alert(
          '⚠️ EIP-2981をサポートしていません\n\n' +
          'このNFTコントラクトはEIP-2981 Royalty Standardに対応していません。\n' +
          '手動で収益分配設定を行ってください。'
        );
        return;
      }

      // PaymentSplit生成
      const split = createPaymentSplit(royaltyInfo, tenantOwnerAddress);

      handleChange('paymentSplit', split);
      setSplitMode('auto');

      const percentage = (royaltyInfo.royaltyBasisPoints / 100).toFixed(1);
      alert(
        `✅ ロイヤリティ情報を検出しました\n\n` +
        `クリエイター: ${royaltyInfo.receiver.slice(0, 6)}...${royaltyInfo.receiver.slice(-4)}\n` +
        `ロイヤリティ: ${percentage}%\n\n` +
        `収益分配設定を自動生成しました。`
      );

    } catch (error) {
      console.error('❌ EIP-2981検出エラー:', error);
      alert(
        `❌ ロイヤリティ情報の取得に失敗しました\n\n` +
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        `手動で収益分配設定を行ってください。`
      );
    } finally {
      setDetectingRoyalty(false);
    }
  };

  // 手動で収益分配設定を作成
  const handleManualSplit = () => {
    if (!manualCreatorAddress) {
      alert('⚠️ クリエイターアドレスを入力してください');
      return;
    }

    if (manualCreatorShare < 0 || manualCreatorShare > 100) {
      alert('⚠️ クリエイターシェアは0〜100%の範囲で入力してください');
      return;
    }

    try {
      const split = createManualPaymentSplit(
        manualCreatorAddress,
        tenantOwnerAddress,
        manualCreatorShare * 100 // % → basis points (10000分率)
      );

      if (!validatePaymentSplit(split)) {
        throw new Error('Invalid payment split configuration');
      }

      handleChange('paymentSplit', split);
      setSplitMode('manual');

      alert(
        `✅ 手動収益分配設定を作成しました\n\n` +
        formatPaymentSplit(split)
      );
    } catch (error) {
      console.error('❌ 手動設定エラー:', error);
      alert(`❌ 収益分配設定の作成に失敗しました\n\n${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 収益分配設定をリセット（テナントオーナー100%）
  const handleResetSplit = () => {
    handleChange('paymentSplit', null);
    setSplitMode('none');
    setManualCreatorAddress('');
    setManualCreatorShare(10);
    alert('✅ 収益分配設定をリセットしました（テナントオーナー100%）');
  };

  // 画像アップロード
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // ファイルハッシュを計算して重複チェック
      const fileHash = await calculateFileHash(file);

      // 同じファイルが既にアップロードされている場合は警告
      if (currentImageHash === fileHash) {
        const proceed = confirm(
          '⚠️ 同じ画像が既にアップロードされています。\n' +
          'このファイルは現在設定されている画像と同一です。\n\n' +
          '再度アップロードしますか？'
        );
        if (!proceed) {
          setUploadingImage(false);
          e.target.value = '';
          return;
        }
      }

      // 新しい画像をアップロード
      const imageUrl = await uploadImage(file, 'gh-public');

      if (imageUrl) {
        // 古い画像を削除（差し替えの場合）
        if (previousImageUrlRef.current && previousImageUrlRef.current !== imageUrl) {
          await deleteFileFromUrl(previousImageUrlRef.current);
        }

        // 新しい画像を設定
        handleChange('imageUrl', imageUrl);
        setCurrentImageHash(fileHash);
        previousImageUrlRef.current = imageUrl;
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
      e.target.value = '';
    }
  };

  // ファイルアップロード（非公開バケットgh-downloads経由）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      // ファイルサイズチェック（100MB）
      if (file.size > 100 * 1024 * 1024) {
        alert('❌ ファイルサイズが大きすぎます（最大100MB）');
        setUploadingFile(false);
        e.target.value = '';
        return;
      }

      // ファイルハッシュを計算して重複チェック
      const fileHash = await calculateFileHash(file);

      // 同じファイルが既にアップロードされている場合は警告
      if (currentFileHash === fileHash) {
        const proceed = confirm(
          '⚠️ 同じ配布ファイルが既にアップロードされています。\n' +
          'このファイルは現在設定されている配布ファイルと同一です。\n\n' +
          '再度アップロードしますか？'
        );
        if (!proceed) {
          setUploadingFile(false);
          e.target.value = '';
          return;
        }
      }

      // ファイルをBase64にエンコード
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // data:...;base64, の部分を削除してBase64のみを取得
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // サーバーサイドAPIでgh-downloads（非公開バケット）にアップロード
      const response = await fetch('/api/upload/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `アップロードに失敗しました (${response.status})`);
      }

      const data = await response.json();

      // 古い配布ファイルを削除（差し替えの場合）
      if (previousContentPathRef.current && previousContentPathRef.current !== data.path) {
        try {
          const deleteResponse = await fetch('/api/delete/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: previousContentPathRef.current })
          });

          if (!deleteResponse.ok) {
            console.warn('⚠️ 古い配布ファイルの削除に失敗しました（続行します）');
          }
        } catch (deleteErr) {
          console.warn('⚠️ 古い配布ファイルの削除エラー（続行します）:', deleteErr);
        }
      }

      // 非公開バケットにアップロードされたファイルパスを保存
      handleChange('contentPath', data.path);
      setCurrentFileHash(fileHash);
      previousContentPathRef.current = data.path;
      alert('✅ 配布ファイルをアップロードしました\n非公開ストレージに安全に保存されました');

    } catch (err) {
      console.error('❌ ファイルアップロードエラー:', err);

      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`❌ 配布ファイルのアップロードに失敗しました\n\n${errorMessage}`);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    // バリデーション
    if (!formData.name || !formData.priceAmountWei) {
      alert('特典名と必要TIP数は必須です');
      return;
    }

    // contentPath の検証（警告のみ）
    if (!formData.contentPath) {
      const confirmed = confirm(
        '⚠️ 配布ファイルが設定されていません。\n' +
        'このまま保存すると、受け取り後のダウンロードができません。\n\n' +
        '保存を続けますか？'
      );
      if (!confirmed) return;
    }

    // PaymentSplit検証
    if (formData.paymentSplit && !validatePaymentSplit(formData.paymentSplit)) {
      alert('❌ 収益分配設定が不正です。設定を確認してください。');
      return;
    }

    await onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          {formData.id ? '特典編集' : '新規特典追加'}
        </h2>

        <div className="space-y-4">
          {/* 特典名 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">特典名 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="例: ベーシックアバター.glb"
            />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">説明</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={3}
              placeholder="特典の説明を入力してください"
            />
          </div>

          {/* 必要TIP数 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">必要TIP数 *</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={Math.floor(Number(formData.priceAmountWei) / 1e18) || ''}
                onChange={(e) => {
                  const tokenAmount = parseInt(e.target.value) || 0;
                  const weiAmount = (tokenAmount * 1e18).toString();
                  handleChange('priceAmountWei', weiAmount);
                }}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-16"
                placeholder="10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-600">
                {tokenSymbol}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ユーザーが特典を受け取るために必要なTIP数（整数のみ）
            </p>
          </div>

          {/* 提供数設定 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isUnlimited}
                onChange={(e) => handleChange('isUnlimited', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-700">提供数無制限（∞）</span>
            </label>
          </div>

          {!formData.isUnlimited && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">提供可能数</label>
              <input
                type="number"
                value={formData.stock}
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
            {formData.imageUrl && (
              <div className="mt-2">
                <img src={formData.imageUrl} alt="Preview" className="w-32 h-32 object-cover rounded" />
              </div>
            )}
          </div>

          {/* ファイルアップロード */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              配布ファイル
              <span className="text-orange-600 ml-1">(受け取り後のダウンロードに必要)</span>
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
            {formData.contentPath ? (
              <p className="text-xs text-green-600 mt-1">✅ パス: {formData.contentPath}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">⚠️ ファイル未設定（保存時に警告が表示されます）</p>
            )}
          </div>

          {/* 収益分配設定セクション */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">💰 収益分配設定</h3>
            <p className="text-sm text-gray-600 mb-4">
              この商品がNFTの場合、クリエイターとテナントオーナーで収益を分配できます。<br />
              設定しない場合はテナントオーナーが100%受け取ります。
            </p>

            {/* 現在の設定を表示 */}
            {formData.paymentSplit && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <p className="text-sm font-semibold text-blue-900">現在の設定:</p>
                <p className="text-sm text-blue-800 mt-1">{formatPaymentSplit(formData.paymentSplit)}</p>
                <p className="text-xs text-blue-600 mt-1">
                  ソース: {formData.paymentSplit.royalty_source === 'EIP2981' ? 'EIP-2981自動検出' : '手動設定'}
                </p>
              </div>
            )}

            {/* タブ切り替え */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSplitMode('none')}
                className={`px-3 py-1 rounded text-sm ${
                  splitMode === 'none' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                なし（100%オーナー）
              </button>
              <button
                onClick={() => setSplitMode('auto')}
                className={`px-3 py-1 rounded text-sm ${
                  splitMode === 'auto' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                自動検出（EIP-2981）
              </button>
              <button
                onClick={() => setSplitMode('manual')}
                className={`px-3 py-1 rounded text-sm ${
                  splitMode === 'manual' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                手動設定
              </button>
            </div>

            {/* 自動検出モード */}
            {splitMode === 'auto' && (
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">NFTコントラクトアドレス</label>
                <input
                  type="text"
                  value={formData.nftAddress || ''}
                  onChange={(e) => handleChange('nftAddress', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
                  placeholder="0x..."
                />
                <button
                  onClick={handleAutoDetectRoyalty}
                  disabled={detectingRoyalty || !formData.nftAddress}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {detectingRoyalty ? '🔍 検出中...' : '🔍 EIP-2981ロイヤリティを自動検出'}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  EIP-2981対応NFTコントラクトからロイヤリティ情報を自動取得します
                </p>
              </div>
            )}

            {/* 手動設定モード */}
            {splitMode === 'manual' && (
              <div className="bg-gray-50 border border-gray-200 rounded p-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">クリエイターアドレス</label>
                  <input
                    type="text"
                    value={manualCreatorAddress}
                    onChange={(e) => setManualCreatorAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="0x..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    クリエイターシェア（%）
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={manualCreatorShare}
                    onChange={(e) => setManualCreatorShare(parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    テナントオーナーシェア: {100 - manualCreatorShare}%
                  </p>
                </div>
                <button
                  onClick={handleManualSplit}
                  disabled={!manualCreatorAddress}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  ✓ 手動設定を適用
                </button>
              </div>
            )}

            {/* リセットボタン */}
            {formData.paymentSplit && (
              <button
                onClick={handleResetSplit}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 mt-3"
              >
                ✕ 収益分配設定をリセット
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
