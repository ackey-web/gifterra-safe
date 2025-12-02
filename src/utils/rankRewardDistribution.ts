// src/utils/rankRewardDistribution.ts
// ランク特典自動配布ロジック
// 総合KODOMI値（JPYC + 応援熱量の合算）に基づいてランク判定・自動配布を行う

import { adminSupabase } from '../lib/adminSupabase';
import type { FlagNFT } from '../types/flagNFT';

/**
 * ランク到達時の自動配布処理
 *
 * @param userAddress ユーザーのウォレットアドレス
 * @param tenantAddress テナントのウォレットアドレス
 * @param newRank 到達したランクレベル
 * @param kodomiValue 到達時の総合KODOMI値（JPYC軸 + 応援軸の合算スコア）
 * @param contract Gifterraコントラクトインスタンス
 * @returns 配布結果
 */
export async function distributeRankRewards(params: {
  userAddress: string;
  tenantAddress: string;
  newRank: number;
  kodomiValue: number;
  contract?: any; // Gifterraコントラクトインスタンス
}): Promise<{
  success: boolean;
  sbtMinted: boolean;
  flagNFTDistributed: boolean;
  distributionId?: string;
  error?: string;
}> {
  const { userAddress, tenantAddress, newRank, kodomiValue, contract } = params;

  try {
    // 1. テナントIDを取得（tenantAddressからtenantIdへの変換が必要な場合）
    const tenantId = tenantAddress; // 簡易実装：addressをそのままIDとして使用

    // 2. KODOMI閾値を取得
    const storageKey = `tip-rank-thresholds-${tenantAddress.toLowerCase()}`;
    const thresholdsStr = localStorage.getItem(storageKey);
    const thresholds = thresholdsStr ? JSON.parse(thresholdsStr) : {};
    const kodomiThreshold = thresholds[newRank] || 0;

    // 3. フラグNFT配布設定を取得
    const nftStorageKey = `rank-flag-nft-${tenantAddress.toLowerCase()}`;
    const nftDistributionStr = localStorage.getItem(nftStorageKey);
    const nftDistribution = nftDistributionStr ? JSON.parse(nftDistributionStr) : {};
    const flagNFTId = nftDistribution[newRank];

    // 4. SBT自動ミント（Gifterraコントラクト経由）
    let sbtMinted = false;
    let sbtTokenId: string | null = null;
    let previousSbtBurned = false;
    let previousSbtTokenId: string | null = null;

    if (contract) {
      try {
        // Gifterraコントラクトのtip関数を呼び出すと、自動的にランクアップ処理が走る
        // ここでは手動でランクアップをトリガーすることも可能
        // （実際の実装では、TIP送信時に自動実行される）

        sbtMinted = true;
      } catch (error: any) {
        console.error('❌ [RankRewardDistribution] SBT mint error:', error);
      }
    }

    // 5. フラグNFT配布（設定されている場合）
    let flagNFTDistributed = false;
    let flagNFTTokenId: string | null = null;

    if (flagNFTId && adminSupabase) {
      try {
        // TODO: FlagNFTコントラクトのmint関数を呼び出し
        // ここではSupabaseに配布記録のみ保存

        flagNFTDistributed = true;
        // flagNFTTokenId = await mintFlagNFT(userAddress, flagNFTId);
      } catch (error: any) {
        console.error('❌ [RankRewardDistribution] Flag NFT distribution error:', error);
      }
    }

    // 6. Supabaseに配布履歴を記録
    if (adminSupabase) {
      const { data, error } = await adminSupabase
        .from('rank_reward_distributions')
        .insert({
          tenant_id: tenantId,
          user_address: userAddress,
          rank_level: newRank,
          kodomi_value: kodomiValue,
          kodomi_threshold: kodomiThreshold,
          sbt_minted: sbtMinted,
          sbt_token_id: sbtTokenId,
          previous_sbt_burned: previousSbtBurned,
          previous_sbt_token_id: previousSbtTokenId,
          flag_nft_id: flagNFTId || null,
          flag_nft_distributed: flagNFTDistributed,
          flag_nft_token_id: flagNFTTokenId,
          status: (sbtMinted || flagNFTDistributed) ? 'completed' : 'pending',
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ [RankRewardDistribution] Failed to record distribution:', error);
      } else {

        return {
          success: true,
          sbtMinted,
          flagNFTDistributed,
          distributionId: data?.id,
        };
      }
    }

    return {
      success: sbtMinted || flagNFTDistributed,
      sbtMinted,
      flagNFTDistributed,
    };
  } catch (error: any) {
    console.error('❌ [RankRewardDistribution] Distribution failed:', error);
    return {
      success: false,
      sbtMinted: false,
      flagNFTDistributed: false,
      error: error?.message || 'Unknown error',
    };
  }
}

/**
 * ユーザーの総合KODOMI値を監視し、ランク到達時に自動配布をトリガー
 *
 * @param userAddress ユーザーのウォレットアドレス
 * @param tenantAddress テナントのウォレットアドレス
 * @param kodomiValue 現在の総合KODOMI値（JPYC軸 + 応援軸の合算）
 * @param previousKodomiValue 前回の総合KODOMI値
 * @param contract Gifterraコントラクトインスタンス
 */
export async function checkAndDistributeRankRewards(params: {
  userAddress: string;
  tenantAddress: string;
  kodomiValue: number;
  previousKodomiValue: number;
  contract?: any;
}): Promise<void> {
  const { userAddress, tenantAddress, kodomiValue, previousKodomiValue, contract } = params;

  // KODOMI閾値を取得
  const storageKey = `tip-rank-thresholds-${tenantAddress.toLowerCase()}`;
  const thresholdsStr = localStorage.getItem(storageKey);
  const thresholds = thresholdsStr ? JSON.parse(thresholdsStr) : {
    1: 100,
    2: 300,
    3: 600,
    4: 1000,
    5: 1500,
  };

  // 新しく到達したランクを検出
  for (const [rank, threshold] of Object.entries(thresholds)) {
    const rankLevel = Number(rank);
    const thresholdValue = Number(threshold);

    // 前回は到達していなかったが、今回到達した場合
    if (previousKodomiValue < thresholdValue && kodomiValue >= thresholdValue) {

      // 自動配布を実行
      await distributeRankRewards({
        userAddress,
        tenantAddress,
        newRank: rankLevel,
        kodomiValue,
        contract,
      });
    }
  }
}

/**
 * 配布履歴を取得
 *
 * @param tenantId テナントID
 * @param limit 取得件数
 * @returns 配布履歴リスト
 */
export async function getDistributionHistory(
  tenantId: string,
  limit: number = 50
): Promise<any[]> {
  if (!adminSupabase) {
    return [];
  }

  try {
    const { data, error } = await adminSupabase
      .from('rank_reward_distributions')
      .select(`
        *,
        flag_nfts (
          name,
          category,
          image
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ [getDistributionHistory] Error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ [getDistributionHistory] Error:', error);
    return [];
  }
}

/**
 * 配布統計を取得
 *
 * @param tenantId テナントID
 * @returns 配布統計
 */
export async function getDistributionStats(tenantId: string): Promise<{
  totalDistributions: number;
  sbtMints: number;
  flagNFTDistributions: number;
}> {
  if (!adminSupabase) {
    return {
      totalDistributions: 0,
      sbtMints: 0,
      flagNFTDistributions: 0,
    };
  }

  try {
    const { data, error } = await adminSupabase
      .from('rank_reward_distributions')
      .select('sbt_minted, flag_nft_distributed')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');

    if (error) {
      console.error('❌ [getDistributionStats] Error:', error);
      return {
        totalDistributions: 0,
        sbtMints: 0,
        flagNFTDistributions: 0,
      };
    }

    const totalDistributions = data?.length || 0;
    const sbtMints = data?.filter(d => d.sbt_minted).length || 0;
    const flagNFTDistributions = data?.filter(d => d.flag_nft_distributed).length || 0;

    return {
      totalDistributions,
      sbtMints,
      flagNFTDistributions,
    };
  } catch (error) {
    console.error('❌ [getDistributionStats] Error:', error);
    return {
      totalDistributions: 0,
      sbtMints: 0,
      flagNFTDistributions: 0,
    };
  }
}
