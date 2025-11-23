// src/admin/components/FlagNFTCategoryForms.tsx
// カテゴリ別フラグNFT設定フォーム

import React from 'react';
import type { FlagNFTCategory } from '../../types/flagNFT';

// ===================================
// 共通インターフェース
// ===================================

interface CategoryConfigFormProps {
  onSubmit: (config: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ===================================
// BENEFIT（特典NFT）設定フォーム
// ===================================

interface BenefitConfigData {
  usageLimit: number; // 使用回数（1回のみ推奨）
  validPeriodDays: number; // 有効期限（日数）
  isTransferable: boolean;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'GIFT_ITEM';
  discountValue: number;
  minTipAmount?: number;
}

export function BenefitConfigForm({ onSubmit, onCancel, isLoading }: CategoryConfigFormProps) {
  const [config, setConfig] = React.useState<BenefitConfigData>({
    usageLimit: 1,
    validPeriodDays: 30,
    isTransferable: false,
    discountType: 'PERCENTAGE',
    discountValue: 10,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">💳 特典NFT設定</h3>
        <p className="text-sm text-blue-700">
          クーポン的な使い方。使用回数制限・有効期限あり、譲渡不可推奨
        </p>
      </div>

      {/* 使用回数制限 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          使用回数制限 <span className="text-red-500">*</span>
        </label>
        <select
          value={config.usageLimit}
          onChange={(e) => setConfig({ ...config, usageLimit: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value={0}>表示のみ（使用不可）</option>
          <option value={1}>1回のみ（推奨）</option>
          <option value={3}>3回まで</option>
          <option value={5}>5回まで</option>
          <option value={10}>10回まで</option>
          <option value={255}>無制限</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          特典クーポンは1回のみ推奨（不正利用防止）
        </p>
      </div>

      {/* 有効期限 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          有効期限（日数） <span className="text-red-500">*</span>
        </label>
        <select
          value={config.validPeriodDays}
          onChange={(e) => setConfig({ ...config, validPeriodDays: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value={7}>7日間</option>
          <option value={14}>14日間</option>
          <option value={30}>30日間（推奨）</option>
          <option value={60}>60日間</option>
          <option value={90}>90日間</option>
          <option value={365}>1年間</option>
        </select>
      </div>

      {/* 割引タイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          特典タイプ <span className="text-red-500">*</span>
        </label>
        <select
          value={config.discountType}
          onChange={(e) => setConfig({ ...config, discountType: e.target.value as any })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="PERCENTAGE">パーセント割引</option>
          <option value="FIXED_AMOUNT">固定金額割引</option>
          <option value="GIFT_ITEM">無料特典アイテム</option>
        </select>
      </div>

      {/* 割引値 */}
      {config.discountType !== 'GIFT_ITEM' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {config.discountType === 'PERCENTAGE' ? '割引率(%)' : '割引金額(円)'}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={config.discountValue}
            onChange={(e) => setConfig({ ...config, discountValue: Number(e.target.value) })}
            min={1}
            max={config.discountType === 'PERCENTAGE' ? 100 : undefined}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      )}

      {/* 最低チップ額 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          特典利用時の最低チップ額（円）
        </label>
        <input
          type="number"
          value={config.minTipAmount || ''}
          onChange={(e) => setConfig({ ...config, minTipAmount: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="任意（例: 500円以上の購入時のみ使用可）"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          空欄の場合は制限なし
        </p>
      </div>

      {/* 譲渡可否 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="benefit-transferable"
          checked={config.isTransferable}
          onChange={(e) => setConfig({ ...config, isTransferable: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="benefit-transferable" className="text-sm text-gray-700">
          譲渡可能にする（非推奨: 不正転売のリスクあり）
        </label>
      </div>

      {/* ボタン */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={isLoading}
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '設定中...' : '次へ進む'}
        </button>
      </div>
    </form>
  );
}

// ===================================
// MEMBERSHIP（会員証NFT）設定フォーム
// ===================================

interface MembershipConfigData {
  usageLimit: number; // 255固定（無制限）
  validPeriodDays: number; // 有効期限
  isTransferable: boolean;
  membershipLevel: string;
  renewalType: 'AUTO' | 'MANUAL' | 'NONE';
}

export function MembershipConfigForm({ onSubmit, onCancel, isLoading }: CategoryConfigFormProps) {
  const [config, setConfig] = React.useState<MembershipConfigData>({
    usageLimit: 255, // 無制限固定
    validPeriodDays: 365,
    isTransferable: false,
    membershipLevel: '',
    renewalType: 'MANUAL',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-medium text-purple-900 mb-2">👤 会員証NFT設定</h3>
        <p className="text-sm text-purple-700">
          会員資格証明。無制限使用、譲渡可否選択可能
        </p>
      </div>

      {/* 会員レベル */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          会員レベル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={config.membershipLevel}
          onChange={(e) => setConfig({ ...config, membershipLevel: e.target.value })}
          placeholder="例: ゴールド会員、VIP会員"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      {/* 有効期限 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          有効期限 <span className="text-red-500">*</span>
        </label>
        <select
          value={config.validPeriodDays}
          onChange={(e) => setConfig({ ...config, validPeriodDays: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value={90}>3ヶ月</option>
          <option value={180}>6ヶ月</option>
          <option value={365}>1年間（推奨）</option>
          <option value={730}>2年間</option>
          <option value={0}>無期限</option>
        </select>
      </div>

      {/* 更新タイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          更新方法 <span className="text-red-500">*</span>
        </label>
        <select
          value={config.renewalType}
          onChange={(e) => setConfig({ ...config, renewalType: e.target.value as any })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="NONE">更新なし（期限切れで失効）</option>
          <option value="MANUAL">手動更新</option>
          <option value="AUTO">自動更新</option>
        </select>
      </div>

      {/* 譲渡可否 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="membership-transferable"
          checked={config.isTransferable}
          onChange={(e) => setConfig({ ...config, isTransferable: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="membership-transferable" className="text-sm text-gray-700">
          譲渡可能にする（会員権の譲渡を許可）
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          {isLoading ? '設定中...' : '次へ進む'}
        </button>
      </div>
    </form>
  );
}

// ===================================
// ACHIEVEMENT（実績バッジNFT）設定フォーム
// ===================================

interface AchievementConfigData {
  usageLimit: number; // 0固定（表示のみ）
  validPeriodDays: number;
  isTransferable: boolean;
  triggerType: 'TIP_COUNT' | 'TOTAL_TIPPED' | 'GIFT_COLLECTION' | 'MANUAL';
  threshold: number;
  autoDistribute: boolean;
}

export function AchievementConfigForm({ onSubmit, onCancel, isLoading }: CategoryConfigFormProps) {
  const [config, setConfig] = React.useState<AchievementConfigData>({
    usageLimit: 0, // 表示のみ固定
    validPeriodDays: 0, // 無期限固定
    isTransferable: true,
    triggerType: 'TIP_COUNT',
    threshold: 10,
    autoDistribute: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-medium text-amber-900 mb-2">🏆 実績バッジNFT設定</h3>
        <p className="text-sm text-amber-700">
          達成条件で自動配布。表示専用、譲渡可能
        </p>
      </div>

      {/* トリガータイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          達成条件タイプ <span className="text-red-500">*</span>
        </label>
        <select
          value={config.triggerType}
          onChange={(e) => setConfig({ ...config, triggerType: e.target.value as any })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="TIP_COUNT">チップ回数（例: 10回チップした）</option>
          <option value="TOTAL_TIPPED">累積チップ額（例: 10,000円分）</option>
          <option value="GIFT_COLLECTION">特典収集数（例: 5個獲得）</option>
          <option value="MANUAL">手動配布</option>
        </select>
      </div>

      {/* 閾値 */}
      {config.triggerType !== 'MANUAL' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            達成条件の閾値 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={config.threshold}
            onChange={(e) => setConfig({ ...config, threshold: Number(e.target.value) })}
            min={1}
            placeholder={
              config.triggerType === 'TIP_COUNT'
                ? '回数（例: 10）'
                : config.triggerType === 'TOTAL_TIPPED'
                ? '金額（例: 10000）'
                : '個数（例: 5）'
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {config.triggerType === 'TIP_COUNT' && 'チップした回数'}
            {config.triggerType === 'TOTAL_TIPPED' && '累積チップ額（円）'}
            {config.triggerType === 'GIFT_COLLECTION' && '獲得した特典の数'}
          </p>
        </div>
      )}

      {/* 自動配布 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="achievement-auto"
          checked={config.autoDistribute}
          onChange={(e) => setConfig({ ...config, autoDistribute: e.target.checked })}
          className="mr-2"
          disabled={config.triggerType === 'MANUAL'}
        />
        <label htmlFor="achievement-auto" className="text-sm text-gray-700">
          条件達成時に自動配布する（推奨）
        </label>
      </div>

      {/* 譲渡可否 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="achievement-transferable"
          checked={config.isTransferable}
          onChange={(e) => setConfig({ ...config, isTransferable: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="achievement-transferable" className="text-sm text-gray-700">
          譲渡可能にする（バッジのトレードを許可）
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          {isLoading ? '設定中...' : '次へ進む'}
        </button>
      </div>
    </form>
  );
}

// ===================================
// CAMPAIGN（キャンペーンNFT）設定フォーム
// ===================================

interface CampaignConfigData {
  usageLimit: number;
  validPeriodDays: number;
  isTransferable: boolean;
  campaignStartDate: string;
  campaignEndDate: string;
}

export function CampaignConfigForm({ onSubmit, onCancel, isLoading }: CategoryConfigFormProps) {
  const [config, setConfig] = React.useState<CampaignConfigData>({
    usageLimit: 3,
    validPeriodDays: 30,
    isTransferable: false,
    campaignStartDate: new Date().toISOString().split('T')[0],
    campaignEndDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
        <h3 className="font-medium text-pink-900 mb-2">🎪 キャンペーンNFT設定</h3>
        <p className="text-sm text-pink-700">
          期間限定イベント。明確な開始・終了日時設定
        </p>
      </div>

      {/* キャンペーン期間 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            開始日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={config.campaignStartDate}
            onChange={(e) => setConfig({ ...config, campaignStartDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            終了日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={config.campaignEndDate}
            onChange={(e) => setConfig({ ...config, campaignEndDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
            required
          />
        </div>
      </div>

      {/* 使用回数 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          使用回数制限 <span className="text-red-500">*</span>
        </label>
        <select
          value={config.usageLimit}
          onChange={(e) => setConfig({ ...config, usageLimit: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
        >
          <option value={1}>1回のみ</option>
          <option value={3}>3回まで（推奨）</option>
          <option value={5}>5回まで</option>
          <option value={255}>無制限</option>
        </select>
      </div>

      {/* 譲渡可否 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="campaign-transferable"
          checked={config.isTransferable}
          onChange={(e) => setConfig({ ...config, isTransferable: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="campaign-transferable" className="text-sm text-gray-700">
          譲渡可能にする
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
        >
          {isLoading ? '設定中...' : '次へ進む'}
        </button>
      </div>
    </form>
  );
}

// ===================================
// ACCESS_PASS（アクセス権NFT）設定フォーム
// ===================================

interface AccessPassConfigData {
  usageLimit: number;
  validPeriodDays: number;
  isTransferable: boolean;
  accessType: 'SINGLE_ENTRY' | 'UNLIMITED' | 'LIMITED_PERIOD';
}

export function AccessPassConfigForm({ onSubmit, onCancel, isLoading }: CategoryConfigFormProps) {
  const [config, setConfig] = React.useState<AccessPassConfigData>({
    usageLimit: 1,
    validPeriodDays: 1,
    isTransferable: false,
    accessType: 'SINGLE_ENTRY',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">🗝️ アクセス権NFT設定</h3>
        <p className="text-sm text-green-700">
          入場・閲覧権限。時間帯制限、入場回数制限設定可能
        </p>
      </div>

      {/* アクセスタイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          アクセスタイプ <span className="text-red-500">*</span>
        </label>
        <select
          value={config.accessType}
          onChange={(e) => {
            const accessType = e.target.value as any;
            setConfig({
              ...config,
              accessType,
              usageLimit: accessType === 'SINGLE_ENTRY' ? 1 : accessType === 'UNLIMITED' ? 255 : 3,
              validPeriodDays: accessType === 'SINGLE_ENTRY' ? 1 : accessType === 'UNLIMITED' ? 365 : 30,
            });
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="SINGLE_ENTRY">1回限りの入場</option>
          <option value="LIMITED_PERIOD">期間限定パス</option>
          <option value="UNLIMITED">無制限アクセス</option>
        </select>
      </div>

      {/* 有効期限 */}
      {config.accessType !== 'SINGLE_ENTRY' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            有効期限 <span className="text-red-500">*</span>
          </label>
          <select
            value={config.validPeriodDays}
            onChange={(e) => setConfig({ ...config, validPeriodDays: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value={1}>1日間</option>
            <option value={7}>1週間</option>
            <option value={30}>1ヶ月間</option>
            <option value={90}>3ヶ月間</option>
            <option value={365}>1年間</option>
            <option value={0}>無期限</option>
          </select>
        </div>
      )}

      {/* 譲渡可否 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="access-transferable"
          checked={config.isTransferable}
          onChange={(e) => setConfig({ ...config, isTransferable: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="access-transferable" className="text-sm text-gray-700">
          譲渡可能にする（チケット転売対策のため非推奨）
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          {isLoading ? '設定中...' : '次へ進む'}
        </button>
      </div>
    </form>
  );
}

// ===================================
// COLLECTIBLE（コレクティブルNFT）設定フォーム
// ===================================

interface CollectibleConfigData {
  usageLimit: number; // 0固定（表示のみ）
  validPeriodDays: number; // 0固定（無期限）
  isTransferable: boolean;
  seriesName: string;
  maxSupply: number;
}

export function CollectibleConfigForm({ onSubmit, onCancel, isLoading }: CategoryConfigFormProps) {
  const [config, setConfig] = React.useState<CollectibleConfigData>({
    usageLimit: 0, // 表示のみ固定
    validPeriodDays: 0, // 無期限固定
    isTransferable: true,
    seriesName: '',
    maxSupply: 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h3 className="font-medium text-indigo-900 mb-2">🎴 コレクティブルNFT設定</h3>
        <p className="text-sm text-indigo-700">
          収集・記念品。表示専用、譲渡可能、希少性管理
        </p>
      </div>

      {/* シリーズ名 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          シリーズ名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={config.seriesName}
          onChange={(e) => setConfig({ ...config, seriesName: e.target.value })}
          placeholder="例: 2024年夏季限定コレクション"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>

      {/* 発行上限 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          発行上限（希少性） <span className="text-red-500">*</span>
        </label>
        <select
          value={config.maxSupply}
          onChange={(e) => setConfig({ ...config, maxSupply: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value={10}>限定10個（超レア）</option>
          <option value={50}>限定50個（レア）</option>
          <option value={100}>限定100個（推奨）</option>
          <option value={500}>限定500個</option>
          <option value={1000}>限定1000個</option>
          <option value={0}>無制限</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          希少性を高めるために発行上限を設定できます
        </p>
      </div>

      {/* 譲渡可否 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="collectible-transferable"
          checked={config.isTransferable}
          onChange={(e) => setConfig({ ...config, isTransferable: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="collectible-transferable" className="text-sm text-gray-700">
          譲渡可能にする（トレード・売買を許可）
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {isLoading ? '設定中...' : '次へ進む'}
        </button>
      </div>
    </form>
  );
}
