// src/admin/utils/flagNFTSaveWorkflow.ts
// FlagNFT作成のワークフロー: コントラクト設定 → Supabaseメタデータ保存

import type { FlagNFTCategory } from '../../types/flagNFT';
import {
  convertToCategoryConfig,
  generateMetadataURI,
  translateContractError,
  getSuccessMessage,
} from './flagNFTContractIntegration';

/**
 * FlagNFT作成の完全なワークフロー
 *
 * 1. カテゴリ設定をコントラクトに登録（configureCategory）
 * 2. メタデータをSupabaseに保存
 * 3. ミント可能な状態にする
 */
export interface SaveFlagNFTWorkflowParams {
  // 基本情報
  tenantId: string;
  category: FlagNFTCategory;
  name: string;
  description: string;
  image: string;

  // カテゴリ固有の設定データ
  categoryConfig: any;

  // Supabase クライアント
  supabaseClient: any;

  // コントラクトフック
  configureCategory: (
    category: FlagNFTCategory,
    usageLimit: number,
    validFrom: number,
    validUntil: number,
    isTransferable: boolean,
    metadataURI: string
  ) => Promise<any>;
}

export interface SaveFlagNFTResult {
  success: boolean;
  flagNFTId?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * FlagNFT作成ワークフロー実行
 */
export async function executeSaveFlagNFTWorkflow(
  params: SaveFlagNFTWorkflowParams
): Promise<SaveFlagNFTResult> {
  const {
    tenantId,
    category,
    name,
    description,
    image,
    categoryConfig,
    supabaseClient,
    configureCategory,
  } = params;

  try {
    console.log('🚀 FlagNFT作成ワークフロー開始:', { category, name });

    // Step 1: Supabaseに仮データを保存してIDを取得
    console.log('📝 Step 1: Supabaseに仮データ保存中...');

    const flagNFTData = {
      tenant_id: tenantId,
      name,
      description,
      image,
      category,
      // カテゴリ設定から基本パラメータを抽出
      usage_limit: categoryConfig.usageLimit || 0,
      valid_from: new Date().toISOString(),
      valid_until: categoryConfig.validPeriodDays
        ? new Date(Date.now() + categoryConfig.validPeriodDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
      is_active: false, // コントラクト設定完了後にtrue
      is_transferable: categoryConfig.isTransferable ?? false,
      is_burnable: categoryConfig.isBurnable ?? true,
      auto_distribution_enabled: categoryConfig.autoDistribute ?? false,
      required_tip_amount: categoryConfig.requiredTipAmount || null,
      target_token: categoryConfig.targetToken || 'both',
      flags: [],
      total_minted: 0,
      total_used: 0,
      max_supply: categoryConfig.maxSupply || null,
      // カテゴリ固有設定を保存
      benefit_config: category === 'BENEFIT' ? buildBenefitConfig(categoryConfig) : null,
      stamp_rally_config: category === 'CAMPAIGN' ? buildStampRallyConfig(categoryConfig) : null,
      membership_config: category === 'MEMBERSHIP' ? buildMembershipConfig(categoryConfig) : null,
      achievement_config: category === 'ACHIEVEMENT' ? buildAchievementConfig(categoryConfig) : null,
      collectible_config: category === 'COLLECTIBLE' ? buildCollectibleConfig(categoryConfig) : null,
    };

    const { data: savedData, error: saveError } = await supabaseClient
      .from('flag_nfts')
      .insert(flagNFTData)
      .select()
      .single();

    if (saveError || !savedData) {
      throw new Error(`Supabase保存エラー: ${saveError?.message || '不明なエラー'}`);
    }

    const flagNFTId = savedData.id;
    console.log('✅ Supabaseに保存完了:', flagNFTId);

    // Step 2: メタデータURIを生成
    const metadataURI = generateMetadataURI(tenantId, flagNFTId, category);
    console.log('📋 メタデータURI:', metadataURI);

    // Step 3: カテゴリ設定をコントラクトに登録
    console.log('⛓️  Step 2: コントラクトにカテゴリ設定を登録中...');

    const contractConfig = convertToCategoryConfig(category, categoryConfig, metadataURI);

    const tx = await configureCategory(
      contractConfig.category,
      contractConfig.usageLimit,
      contractConfig.validFrom,
      contractConfig.validUntil,
      contractConfig.isTransferable,
      contractConfig.metadataURI
    );

    console.log('✅ コントラクト設定完了:', tx);

    // Step 4: Supabaseのis_activeをtrueに更新（ミント可能状態）
    console.log('🔄 Step 3: is_activeをtrueに更新中...');

    const { error: updateError } = await supabaseClient
      .from('flag_nfts')
      .update({ is_active: true })
      .eq('id', flagNFTId);

    if (updateError) {
      console.warn('⚠️ is_active更新に失敗:', updateError);
    } else {
      console.log('✅ ミント可能状態に更新完了');
    }

    return {
      success: true,
      flagNFTId,
      transactionHash: tx.hash || tx.receipt?.transactionHash,
    };

  } catch (error: any) {
    console.error('❌ FlagNFT作成ワークフローエラー:', error);

    // エラーメッセージを日本語に変換
    const errorMessage = translateContractError(error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ===================================
// カテゴリ固有設定のビルダー関数
// ===================================

function buildBenefitConfig(config: any) {
  return {
    discountType: config.discountType || 'PERCENTAGE',
    discountValue: config.discountValue || 0,
    minTipAmount: config.minTipAmount || undefined,
    applicableGifts: config.applicableGifts || undefined,
    maxDiscountAmount: config.maxDiscountAmount || undefined,
  };
}

function buildStampRallyConfig(config: any) {
  // CAMPAIGNカテゴリはスタンプラリーとして使用可能
  return {
    checkpoints: config.checkpoints || [],
    completionReward: config.completionReward || undefined,
    requireSequential: config.requireSequential ?? false,
    verificationMethod: config.verificationMethod || 'QR',
  };
}

function buildMembershipConfig(config: any) {
  return {
    membershipLevel: config.membershipLevel || 'Standard',
    accessAreas: config.accessAreas || [],
    benefits: config.benefits || [],
    renewalType: config.renewalType || 'MANUAL',
  };
}

function buildAchievementConfig(config: any) {
  return {
    triggerType: config.triggerType || 'MANUAL',
    threshold: config.threshold || 0,
    autoDistribute: config.autoDistribute ?? false,
    additionalBenefits: config.additionalBenefits || undefined,
  };
}

function buildCollectibleConfig(config: any) {
  return {
    seriesName: config.seriesName || '',
    seriesNumber: config.seriesNumber || undefined,
    totalInSeries: config.totalInSeries || undefined,
    collectionGoal: config.collectionGoal || undefined,
    progressReward: config.progressReward || undefined,
    distributionTrigger: config.distributionTrigger || 'MANUAL',
    requiredCondition: config.requiredCondition || undefined,
    artist: config.artist || undefined,
    releaseDate: config.releaseDate || undefined,
    description: config.description || undefined,
  };
}
