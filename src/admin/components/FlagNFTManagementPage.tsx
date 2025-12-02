// src/admin/FlagNFTManagementPage.tsx
// フラグNFT管理ページ
// 法務対応: 「商品」「購入」などの表現を使用せず、「特典」「チップ」で統一

import React, { useState, useRef, useEffect } from 'react';
import type { FlagNFTCategory } from '../../types/flagNFT';
import { uploadImage, deleteFileFromUrl } from '../../lib/supabase';
import { adminSupabase } from '../../lib/adminSupabase';
import { useTenant } from '../contexts/TenantContext';
import { useMintFlagNFT, useConfigureCategory } from '../../hooks/useFlagNFTContract';
import {
  BenefitConfigForm,
  MembershipConfigForm,
  AchievementConfigForm,
  CampaignConfigForm,
  AccessPassConfigForm,
  CollectibleConfigForm,
} from './FlagNFTCategoryForms';
import { executeSaveFlagNFTWorkflow } from '../utils/flagNFTSaveWorkflow';
import { estimateGasCost, getSuccessMessage } from '../utils/flagNFTContractIntegration';

type CreateStep = 'category' | 'basic' | 'detail';

interface CategoryOption {
  id: FlagNFTCategory;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'BENEFIT',
    label: '特典NFT',
    icon: '💳',
    description: '割引や特典を提供するNFT',
    color: '#3b82f6',
  },
  {
    id: 'MEMBERSHIP',
    label: '会員証NFT',
    icon: '👤',
    description: '会員資格とアクセス権を証明',
    color: '#8b5cf6',
  },
  {
    id: 'ACHIEVEMENT',
    label: '実績バッジNFT',
    icon: '🏆',
    description: 'チップ回数や達成条件で自動配布',
    color: '#f59e0b',
  },
  {
    id: 'CAMPAIGN',
    label: 'キャンペーンNFT',
    icon: '🎪',
    description: '期間限定イベントやキャンペーン',
    color: '#ec4899',
  },
  {
    id: 'ACCESS_PASS',
    label: 'アクセス権NFT',
    icon: '🗝️',
    description: '特定エリアやコンテンツへのアクセス',
    color: '#10b981',
  },
  {
    id: 'COLLECTIBLE',
    label: 'コレクティブルNFT',
    icon: '🎴',
    description: 'コレクション要素を持つNFT',
    color: '#6366f1',
  },
];

interface BasicFormData {
  name: string;
  description: string;
  image: string;
  validFrom: string;
  validUntil: string;
  usageLimit: string;
  maxSupply: string;
  isTransferable: boolean;
  isBurnable: boolean;
  autoDistributionEnabled: boolean;
  requiredTipAmount: string;
  targetToken: 'JPYC' | 'tNHT' | 'both';
}

interface BenefitFormData {
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'GIFT_ITEM';
  discountValue: string;
  minTipAmount: string;
  applicableGifts: string;
  maxDiscountAmount: string;
}

interface CheckpointFormData {
  id: string;
  name: string;
  description: string;
  nfcTagId: string;
  nfcEnabled: boolean;
  qrCode: string;
  qrEnabled: boolean;
  locationLat: string;
  locationLng: string;
  radiusMeters: string;
}

interface StampRallyFormData {
  checkpoints: CheckpointFormData[];
  completionReward: string;
  requireSequential: boolean;
  verificationMethod: 'NFC' | 'QR' | 'BOTH';
}

interface MembershipFormData {
  membershipLevel: string;
  accessAreas: string; // カンマ区切り
  benefits: string; // カンマ区切り
  renewalType: 'AUTO' | 'MANUAL' | 'NONE';
}

interface AchievementFormData {
  triggerType: 'TIP_COUNT' | 'TOTAL_TIPPED' | 'GIFT_COLLECTION' | 'MANUAL';
  threshold: string;
  autoDistribute: boolean;
  additionalBenefits: string; // カンマ区切り
}

interface CollectibleFormData {
  seriesName: string;
  seriesNumber: string;
  totalInSeries: string;
  collectionGoal: string;
  progressReward: string;
  distributionTrigger: 'TIP_AMOUNT' | 'EVENT_PARTICIPATION' | 'CAMPAIGN' | 'MANUAL';
  requiredCondition: string;
  artist: string;
  releaseDate: string;
  description: string;
}

export default function FlagNFTManagementPage() {
  const { tenantId } = useTenant();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [createStep, setCreateStep] = useState<CreateStep>('category');
  const [selectedCategory, setSelectedCategory] = useState<FlagNFTCategory | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<FlagNFTCategory | 'ALL'>('ALL');
  const [isSaving, setIsSaving] = useState(false);

  // NFTリスト管理用の状態
  const [flagNFTs, setFlagNFTs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ミントモーダル用の状態
  const [showMintModal, setShowMintModal] = useState(false);
  const [selectedNFTForMint, setSelectedNFTForMint] = useState<any | null>(null);
  const [mintToAddress, setMintToAddress] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  // ミント用フック
  const { mint: mintNFT, isLoading: isMintLoading } = useMintFlagNFT();

  // カテゴリ設定用フック
  const { configure: configureCategory, isLoading: isConfiguringCategory } = useConfigureCategory();

  // 基本情報フォームの状態
  const [formData, setFormData] = useState<BasicFormData>({
    name: '',
    description: '',
    image: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    usageLimit: '-1',
    maxSupply: '',
    isTransferable: false,
    isBurnable: false,
    autoDistributionEnabled: false,
    requiredTipAmount: '',
    targetToken: 'both',
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 特典NFT詳細設定フォームの状態
  const [benefitData, setBenefitData] = useState<BenefitFormData>({
    discountType: 'PERCENTAGE',
    discountValue: '',
    minTipAmount: '',
    applicableGifts: '',
    maxDiscountAmount: '',
  });

  // スタンプラリーNFT詳細設定フォームの状態
  const [stampRallyData, setStampRallyData] = useState<StampRallyFormData>({
    checkpoints: [],
    completionReward: '',
    requireSequential: false,
    verificationMethod: 'BOTH',
  });

  // 会員証NFT詳細設定フォームの状態
  const [membershipData, setMembershipData] = useState<MembershipFormData>({
    membershipLevel: '',
    accessAreas: '',
    benefits: '',
    renewalType: 'NONE',
  });

  // 実績バッジNFT詳細設定フォームの状態
  const [achievementData, setAchievementData] = useState<AchievementFormData>({
    triggerType: 'TIP_COUNT',
    threshold: '',
    autoDistribute: false,
    additionalBenefits: '',
  });

  // コレクティブルNFT詳細設定フォームの状態
  const [collectibleData, setCollectibleData] = useState<CollectibleFormData>({
    seriesName: '',
    seriesNumber: '',
    totalInSeries: '',
    collectionGoal: '',
    progressReward: '',
    distributionTrigger: 'MANUAL',
    requiredCondition: '',
    artist: '',
    releaseDate: '',
    description: '',
  });

  // 画像アップロード処理
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 古い画像があれば削除
      if (formData.image) {

        await deleteFileFromUrl(formData.image);
      }

      // 新しい画像をアップロード
      const imageUrl = await uploadImage(file, 'PUBLIC');
      if (imageUrl) {

        setFormData((prev) => ({ ...prev, image: imageUrl }));
      } else {
        throw new Error('画像URLの取得に失敗しました');
      }
    } catch (error) {
      console.error('画像アップロード失敗:', error);
      alert('画像のアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  // フォームバリデーション
  const isBasicFormValid = () => {
    return (
      formData.name.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.image !== ''
    );
  };

  // フラグNFTリストをSupabaseから取得
  useEffect(() => {
    const loadFlagNFTs = async () => {
      if (!adminSupabase || !tenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await adminSupabase
          .from('flag_nfts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('フラグNFT取得エラー:', error);
          setFlagNFTs([]);
        } else {
          setFlagNFTs(data || []);
        }
      } catch (err) {
        console.error('予期しないエラー:', err);
        setFlagNFTs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFlagNFTs();
  }, [tenantId, adminSupabase, refreshTrigger]);

  // フラグNFTをSupabaseに保存する関数
  const saveFlagNFT = async (categoryConfig: any) => {
    if (!adminSupabase) {
      alert('管理者Supabaseクライアントが初期化されていません');
      return;
    }

    if (!tenantId) {
      alert('テナントIDが取得できません');
      return;
    }

    if (!selectedCategory) {
      alert('カテゴリが選択されていません');
      return;
    }

    setIsSaving(true);

    try {

      // ガス代推定を表示
      const gasCost = estimateGasCost('configure');

      // ワークフロー実行
      const result = await executeSaveFlagNFTWorkflow({
        tenantId,
        category: selectedCategory,
        name: formData.name,
        description: formData.description,
        image: formData.image,
        categoryConfig: {
          ...categoryConfig,
          // formDataから基本設定も含める
          maxSupply: formData.maxSupply ? parseInt(formData.maxSupply) : null,
          autoDistribute: formData.autoDistributionEnabled,
          requiredTipAmount: formData.requiredTipAmount ? parseFloat(formData.requiredTipAmount) : null,
          targetToken: formData.targetToken,
          isBurnable: formData.isBurnable,
        },
        supabaseClient: adminSupabase,
        configureCategory: async (cat, usageLimit, validFrom, validUntil, isTransferable, metadataURI) => {
          return await configureCategory(cat, usageLimit, validFrom, validUntil, isTransferable, metadataURI);
        },
      });

      if (result.success) {
        const successMsg = getSuccessMessage('configure', selectedCategory);
        alert(`${successMsg}\n\nトランザクションハッシュ: ${result.transactionHash}`);

        // リストビューに戻ってリロード
        setView('list');
        loadFlagNFTs(); // 既存のロード関数を呼ぶ
      } else {
        alert(`作成に失敗しました:\n${result.error}`);
      }

    } catch (err: any) {
      console.error('❌ 予期しないエラー:', err);
      alert(`エラーが発生しました: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 手動ミント処理
  const handleManualMint = async () => {
    if (!selectedNFTForMint || !mintToAddress) {
      alert('ミント先アドレスを入力してください');
      return;
    }

    setIsMinting(true);
    try {
      // 1. コントラクトでNFTをミント

      const tx = await mintNFT(mintToAddress, selectedNFTForMint.category);

      // 2. 配布履歴をSupabaseに保存
      if (adminSupabase) {
        const { error: historyError } = await adminSupabase
          .from('flag_nft_distributions')
          .insert({
            flag_nft_id: selectedNFTForMint.id,
            user_address: mintToAddress,
            distribution_type: 'MANUAL',
            distributed_at: new Date().toISOString(),
          });

        if (historyError) {
          console.error('配布履歴保存エラー:', historyError);
        }

        // 3. total_mintedをインクリメント
        const { error: updateError } = await adminSupabase
          .from('flag_nfts')
          .update({
            total_minted: (selectedNFTForMint.total_minted || 0) + 1
          })
          .eq('id', selectedNFTForMint.id);

        if (updateError) {
          console.error('発行数更新エラー:', updateError);
        }
      }

      alert(`✅ NFTをミントしました！\nアドレス: ${mintToAddress.slice(0, 6)}...${mintToAddress.slice(-4)}`);

      // モーダルを閉じてリフレッシュ
      setShowMintModal(false);
      setMintToAddress('');
      setSelectedNFTForMint(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('❌ ミントエラー:', error);
      alert(`ミントに失敗しました: ${error}`);
    } finally {
      setIsMinting(false);
    }
  };

  // リスト表示
  if (view === 'list') {
    // フィルタリング処理
    const filteredNFTs = categoryFilter === 'ALL'
      ? flagNFTs
      : flagNFTs.filter(nft => nft.category === categoryFilter);

    return (
      <div style={{ padding: 24 }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>
              フラグNFT管理
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '8px 0 0 0' }}>
              特典NFT、スタンプラリー、会員証などを作成・管理
            </p>
          </div>
          <button
            onClick={() => {
              setView('create');
              setCreateStep('category');
              setSelectedCategory(null);
            }}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            }}
          >
            <span style={{ fontSize: 18 }}>➕</span>
            新規作成
          </button>
        </div>

        {/* カテゴリフィルター */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setCategoryFilter('ALL')}
            style={{
              padding: '8px 16px',
              background: categoryFilter === 'ALL' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              border: categoryFilter === 'ALL' ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: categoryFilter === 'ALL' ? '#fff' : 'rgba(255,255,255,0.7)',
              fontSize: 14,
              fontWeight: categoryFilter === 'ALL' ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            全て
          </button>
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              style={{
                padding: '8px 16px',
                background: categoryFilter === cat.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                border: categoryFilter === cat.id ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: categoryFilter === cat.id ? '#fff' : 'rgba(255,255,255,0.7)',
                fontSize: 14,
                fontWeight: categoryFilter === cat.id ? 600 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* NFTリスト */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.7)' }}>
            読み込み中...
          </div>
        ) : filteredNFTs.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            border: '2px dashed rgba(255,255,255,0.2)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚩</div>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              {categoryFilter === 'ALL'
                ? 'まだフラグNFTが作成されていません'
                : `${CATEGORY_OPTIONS.find(c => c.id === categoryFilter)?.label}がありません`
              }
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '8px 0 24px 0' }}>
              「新規作成」ボタンから最初のフラグNFTを作成しましょう
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {filteredNFTs.map((nft) => {
              const categoryInfo = CATEGORY_OPTIONS.find(c => c.id === nft.category);
              return (
                <div
                  key={nft.id}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'all 0.3s',
                  }}
                >
                  {/* NFT画像 */}
                  <div style={{
                    width: '100%',
                    height: 200,
                    backgroundImage: `url(${nft.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      padding: '6px 12px',
                      background: categoryInfo?.color || '#666',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span>{categoryInfo?.icon}</span>
                      <span>{categoryInfo?.label}</span>
                    </div>
                  </div>

                  {/* NFT情報 */}
                  <div style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
                      {nft.name}
                    </h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      {nft.description.length > 80
                        ? nft.description.substring(0, 80) + '...'
                        : nft.description
                      }
                    </p>

                    {/* 統計情報 */}
                    <div style={{
                      display: 'flex',
                      gap: 16,
                      marginBottom: 16,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.7)',
                    }}>
                      <div>
                        <span style={{ opacity: 0.6 }}>発行数: </span>
                        <span style={{ fontWeight: 600 }}>{nft.total_minted || 0}</span>
                        {nft.max_supply && <span style={{ opacity: 0.6 }}> / {nft.max_supply}</span>}
                      </div>
                      <div>
                        <span style={{ opacity: 0.6 }}>使用回数: </span>
                        <span style={{ fontWeight: 600 }}>{nft.total_used || 0}</span>
                      </div>
                    </div>

                    {/* ミントボタン */}
                    <button
                      onClick={() => {
                        setSelectedNFTForMint(nft);
                        setShowMintModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                      }}
                    >
                      🎨 手動ミント
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ミントモーダル */}
        {showMintModal && selectedNFTForMint && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              background: '#1a1a2e',
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
                NFTを手動ミント
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 24px 0' }}>
                {selectedNFTForMint.name}
              </p>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  ミント先アドレス
                </label>
                <input
                  type="text"
                  value={mintToAddress}
                  onChange={(e) => setMintToAddress(e.target.value)}
                  placeholder="0x..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => {
                    setShowMintModal(false);
                    setMintToAddress('');
                    setSelectedNFTForMint(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleManualMint}
                  disabled={isMinting || !mintToAddress}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: isMinting || !mintToAddress
                      ? 'rgba(102, 126, 234, 0.3)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: isMinting || !mintToAddress ? 'not-allowed' : 'pointer',
                    opacity: isMinting || !mintToAddress ? 0.6 : 1,
                  }}
                >
                  {isMinting ? 'ミント中...' : 'ミント実行'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 作成フロー
  return (
    <div style={{ padding: 24 }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => setView('list')}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← 戻る
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>
          新規フラグNFT作成
        </h1>
      </div>

      {/* プログレスバー */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 32,
        maxWidth: 600,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            height: 4,
            background: createStep === 'category' ? '#667eea' : 'rgba(255,255,255,0.1)',
            borderRadius: 2,
          }} />
          <p style={{
            fontSize: 12,
            color: createStep === 'category' ? '#fff' : 'rgba(255,255,255,0.5)',
            marginTop: 8,
            fontWeight: 600,
          }}>
            1. カテゴリ選択
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            height: 4,
            background: createStep === 'basic' ? '#667eea' : 'rgba(255,255,255,0.1)',
            borderRadius: 2,
          }} />
          <p style={{
            fontSize: 12,
            color: createStep === 'basic' ? '#fff' : 'rgba(255,255,255,0.5)',
            marginTop: 8,
            fontWeight: 600,
          }}>
            2. 基本情報
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            height: 4,
            background: createStep === 'detail' ? '#667eea' : 'rgba(255,255,255,0.1)',
            borderRadius: 2,
          }} />
          <p style={{
            fontSize: 12,
            color: createStep === 'detail' ? '#fff' : 'rgba(255,255,255,0.5)',
            marginTop: 8,
            fontWeight: 600,
          }}>
            3. 詳細設定
          </p>
        </div>
      </div>

      {/* ステップ1: カテゴリ選択 */}
      {createStep === 'category' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
            どのような用途でNFTを発行しますか?
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            maxWidth: 1200,
          }}>
            {CATEGORY_OPTIONS.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setCreateStep('basic');
                }}
                style={{
                  padding: 24,
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = category.color;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  fontSize: 40,
                  marginBottom: 12,
                }}>
                  {category.icon}
                </div>
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#fff',
                  margin: '0 0 8px 0',
                }}>
                  {category.label}
                </h3>
                <p style={{
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.6)',
                  margin: 0,
                  lineHeight: 1.6,
                }}>
                  {category.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ステップ2: 基本情報 */}
      {createStep === 'basic' && selectedCategory && (
        <div style={{ maxWidth: 800 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
            基本情報を入力
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 32,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* NFT名 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                NFT名 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={
                  selectedCategory === 'BENEFIT' ? '例: 10%割引特典NFT' :
                  selectedCategory === 'MEMBERSHIP' ? '例: ゴールド会員証NFT' :
                  selectedCategory === 'ACHIEVEMENT' ? '例: 100回投げ銭達成バッジ' :
                  selectedCategory === 'CAMPAIGN' ? '例: 夏季限定スタンプラリー' :
                  selectedCategory === 'ACCESS_PASS' ? '例: VIPラウンジ入場パス' :
                  selectedCategory === 'COLLECTIBLE' ? '例: 限定アートコレクション #1' :
                  '例: 10%割引特典NFT'
                }
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </div>

            {/* 説明 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                説明 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={
                  selectedCategory === 'BENEFIT' ? 'この特典NFTで受けられる割引や特典内容を詳しく説明してください（例: カフェメニュー全品10%オフ）' :
                  selectedCategory === 'MEMBERSHIP' ? '会員証の特典内容や利用できるサービスを説明してください（例: VIPエリアアクセス、限定イベント招待）' :
                  selectedCategory === 'ACHIEVEMENT' ? 'この実績バッジの達成条件と獲得時の特典を説明してください（例: 累計100回投げ銭で獲得、特別称号付与）' :
                  selectedCategory === 'CAMPAIGN' ? 'キャンペーンの内容、参加方法、達成報酬を説明してください（例: 店舗5箇所を巡るスタンプラリー、完走で限定グッズ）' :
                  selectedCategory === 'ACCESS_PASS' ? 'アクセス権の利用可能範囲と有効期限を説明してください（例: VIPラウンジ入場権、イベント当日のみ有効）' :
                  selectedCategory === 'COLLECTIBLE' ? 'コレクションの背景やアーティスト情報を説明してください（例: 限定100枚のデジタルアート、著名イラストレーター作）' :
                  'NFTの用途や特典内容を説明してください'
                }
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 15,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 画像アップロード */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                NFT画像 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {formData.image && (
                  <img
                    src={formData.image}
                    alt="NFT preview"
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '2px solid rgba(255,255,255,0.2)',
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                      padding: '12px 24px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      opacity: isUploading ? 0.6 : 1,
                    }}
                  >
                    {isUploading ? 'アップロード中...' : formData.image ? '画像を変更' : '画像を選択'}
                  </button>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                    推奨: 正方形、1MB以下
                  </p>
                </div>
              </div>
            </div>

            {/* 有効期間 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  有効開始日
                </label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  有効終了日（無期限の場合は空欄）
                </label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* 使用制限・発行上限 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  使用制限回数
                </label>
                <select
                  value={formData.usageLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, usageLimit: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                  }}
                >
                  <option value="-1" style={{ background: '#1a1a1a' }}>無制限</option>
                  <option value="0" style={{ background: '#1a1a1a' }}>表示のみ（使用不可）</option>
                  <option value="1" style={{ background: '#1a1a1a' }}>1回まで</option>
                  <option value="3" style={{ background: '#1a1a1a' }}>3回まで</option>
                  <option value="5" style={{ background: '#1a1a1a' }}>5回まで</option>
                  <option value="10" style={{ background: '#1a1a1a' }}>10回まで</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  発行上限数（無制限の場合は空欄）
                </label>
                <input
                  type="number"
                  value={formData.maxSupply}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxSupply: e.target.value }))}
                  placeholder="例: 100"
                  min="1"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* 譲渡可能設定 */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isTransferable}
                  onChange={(e) => setFormData(prev => ({ ...prev, isTransferable: e.target.checked }))}
                  style={{ marginRight: 8, width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  NFTの譲渡を許可する
                </span>
              </label>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6, marginLeft: 26 }}>
                チェックを入れると、ユーザー間でNFTの譲渡が可能になります
              </p>
            </div>

            {/* バーン機能設定 */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isBurnable}
                  onChange={(e) => setFormData(prev => ({ ...prev, isBurnable: e.target.checked }))}
                  style={{ marginRight: 8, width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  NFTのバーン（焼却）を許可する
                </span>
              </label>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6, marginLeft: 26 }}>
                チェックを入れると、ユーザーがNFTをバーン（削除）できます。クーポン使用後の処理などに使用
              </p>
            </div>

            {/* 自動配布設定 */}
            <div style={{ marginBottom: 32, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={formData.autoDistributionEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoDistributionEnabled: e.target.checked }))}
                  style={{ marginRight: 8, width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  投げ銭累積による自動配布を有効化
                </span>
              </label>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16, marginLeft: 26 }}>
                ユーザーの累積投げ銭額が条件を達成したとき、自動的にこのNFTを配布します
              </p>

              {formData.autoDistributionEnabled && (
                <div style={{ marginLeft: 26 }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 6 }}>
                      必要な累積額
                    </label>
                    <input
                      type="number"
                      value={formData.requiredTipAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, requiredTipAmount: e.target.value }))}
                      placeholder="例: 1000"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: 14,
                      }}
                    />
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                      トークン単位での累積額（JPYC: 1000 = 1000円相当）
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 6 }}>
                      対象トークン
                    </label>
                    <select
                      value={formData.targetToken}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetToken: e.target.value as 'JPYC' | 'tNHT' | 'both' }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="both">JPYC + tNHT（両方）</option>
                      <option value="JPYC">JPYCのみ</option>
                      <option value="tNHT">tNHTのみ</option>
                    </select>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                      どのトークンの累積額をカウントするか
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setCreateStep('category')}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← 戻る
              </button>
              <button
                onClick={() => setCreateStep('detail')}
                disabled={!isBasicFormValid()}
                style={{
                  padding: '12px 24px',
                  background: isBasicFormValid()
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isBasicFormValid() ? 'pointer' : 'not-allowed',
                  opacity: isBasicFormValid() ? 1 : 0.5,
                }}
              >
                次へ: 詳細設定 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ステップ3: 詳細設定 */}
      {createStep === 'detail' && selectedCategory && (
        <div style={{ maxWidth: 800 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
            詳細設定 - {CATEGORY_OPTIONS.find(c => c.id === selectedCategory)?.label}
          </h2>

          {/* ガス代推定表示 */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 14, color: '#10b981', marginBottom: 4 }}>
              ⛽ 推定ガス代: {estimateGasCost('configure')}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(16, 185, 129, 0.7)' }}>
              カテゴリ設定をブロックチェーンに登録します
            </p>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 32,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* カテゴリ別フォーム */}
            {selectedCategory === 'BENEFIT' && (
              <BenefitConfigForm
                onSubmit={saveFlagNFT}
                onCancel={() => setCreateStep('basic')}
                isLoading={isSaving || isConfiguringCategory}
              />
            )}

            {selectedCategory === 'MEMBERSHIP' && (
              <MembershipConfigForm
                onSubmit={saveFlagNFT}
                onCancel={() => setCreateStep('basic')}
                isLoading={isSaving || isConfiguringCategory}
              />
            )}

            {selectedCategory === 'ACHIEVEMENT' && (
              <AchievementConfigForm
                onSubmit={saveFlagNFT}
                onCancel={() => setCreateStep('basic')}
                isLoading={isSaving || isConfiguringCategory}
              />
            )}

            {selectedCategory === 'CAMPAIGN' && (
              <CampaignConfigForm
                onSubmit={saveFlagNFT}
                onCancel={() => setCreateStep('basic')}
                isLoading={isSaving || isConfiguringCategory}
              />
            )}

            {selectedCategory === 'ACCESS_PASS' && (
              <AccessPassConfigForm
                onSubmit={saveFlagNFT}
                onCancel={() => setCreateStep('basic')}
                isLoading={isSaving || isConfiguringCategory}
              />
            )}

            {selectedCategory === 'COLLECTIBLE' && (
              <CollectibleConfigForm
                onSubmit={saveFlagNFT}
                onCancel={() => setCreateStep('basic')}
                isLoading={isSaving || isConfiguringCategory}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
