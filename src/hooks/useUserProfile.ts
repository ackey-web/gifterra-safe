// src/hooks/useUserProfile.ts
// ユーザープロフィールデータ取得フック

import { useEffect, useState, useMemo } from 'react';
import { useAddress, useContractRead, useContract } from '@thirdweb-dev/react';
import { SBT_CONTRACT, READ_ABI } from '../contract';
import { calculateRank } from '../utils/userProfile';
import type { UserProfile, Activity, SBT, UserStats } from '../types/user';

/**
 * ユーザープロフィール取得フック
 *
 * @param targetAddress - 取得対象のウォレットアドレス（未指定時は接続中のウォレット）
 */
export function useUserProfile(targetAddress?: string) {
  const connectedAddress = useAddress();
  const address = targetAddress || connectedAddress;

  // コントラクト接続
  const { contract } = useContract(SBT_CONTRACT.ADDRESS, READ_ABI);

  // ユーザーの基本情報を取得
  const { data: userInfo, isLoading: isLoadingUserInfo } = useContractRead(
    contract,
    'userInfo',
    address ? [address] : undefined
  );

  // ユーザーの現在のランクレベルを取得
  const { data: userLevel, isLoading: isLoadingLevel } = useContractRead(
    contract,
    'userNFTLevel',
    address ? [address] : undefined
  );

  // ランク閾値を取得（Level 0-4）
  const { data: threshold0 } = useContractRead(contract, 'rankThresholds', [0]);
  const { data: threshold1 } = useContractRead(contract, 'rankThresholds', [1]);
  const { data: threshold2 } = useContractRead(contract, 'rankThresholds', [2]);
  const { data: threshold3 } = useContractRead(contract, 'rankThresholds', [3]);
  const { data: threshold4 } = useContractRead(contract, 'rankThresholds', [4]);

  // アクティビティ履歴（TODO: ブロックチェーンイベントまたはSupabaseから取得）
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // SBT情報（TODO: 実装されたら取得）
  const [sbts, setSbts] = useState<SBT[]>([]);

  /**
   * ユーザープロフィールデータを計算
   */
  const profile: UserProfile | null = useMemo(() => {
    if (!address || !userInfo || userLevel === undefined) {
      return null;
    }

    // コントラクトから取得した生データ
    const totalTips = userInfo[1] ? BigInt(userInfo[1].toString()) : BigInt(0);
    const currentLevel = userLevel ? Number(userLevel) : 0;

    // ランク閾値の配列を構築
    const thresholds = [
      threshold0 ? BigInt(threshold0.toString()) : BigInt(0),
      threshold1 ? BigInt(threshold1.toString()) : BigInt(1000),
      threshold2 ? BigInt(threshold2.toString()) : BigInt(5000),
      threshold3 ? BigInt(threshold3.toString()) : BigInt(20000),
      threshold4 ? BigInt(threshold4.toString()) : BigInt(100000),
    ];

    // ランク設定を動的に作成
    const rankConfigs = [
      { name: 'Bronze' as const, level: 0, threshold: thresholds[0], color: '#CD7F32', badge: '🥉' },
      { name: 'Silver' as const, level: 1, threshold: thresholds[1], color: '#C0C0C0', badge: '🥈' },
      { name: 'Gold' as const, level: 2, threshold: thresholds[2], color: '#FFD700', badge: '🥇' },
      { name: 'Platinum' as const, level: 3, threshold: thresholds[3], color: '#E5E4E2', badge: '💎' },
      { name: 'Diamond' as const, level: 4, threshold: thresholds[4], color: '#B9F2FF', badge: '👑' },
    ];

    // ランクを計算
    const rank = calculateRank(totalTips, rankConfigs);

    // 統計情報を構築（アクティビティから計算）
    const stats: UserStats = {
      totalTipsSent: totalTips,
      totalTipsReceived: BigInt(0), // TODO: イベントログから計算
      tipSentCount: activities.filter(a => a.type === 'tip_sent').length,
      tipReceivedCount: activities.filter(a => a.type === 'tip_received').length,
      purchaseCount: activities.filter(a => a.type === 'purchase').length,
      rewardClaimedCount: activities.filter(a => a.type === 'reward_claimed').length,
      activeDays: 0, // TODO: アクティビティから計算
      firstActivityAt: activities.length > 0 ? activities[activities.length - 1].timestamp : undefined,
      lastActivityAt: activities.length > 0 ? activities[0].timestamp : undefined,
    };

    return {
      address,
      rank,
      sbts,
      stats,
      recentActivities: activities.slice(0, 10), // 最新10件
    };
  }, [address, userInfo, userLevel, threshold0, threshold1, threshold2, threshold3, threshold4, activities, sbts]);

  /**
   * アクティビティ履歴を取得
   * TODO: ブロックチェーンイベントまたはSupabaseから取得
   */
  useEffect(() => {
    if (!address) return;

    const fetchActivities = async () => {
      setIsLoadingActivities(true);
      try {
        // TODO: ブロックチェーンのイベントログまたはSupabaseから取得
        // 現在はダミーデータ
        const dummyActivities: Activity[] = [
          // {
          //   id: '1',
          //   type: 'tip_sent',
          //   timestamp: new Date(Date.now() - 86400000),
          //   txHash: '0x123...',
          //   details: {
          //     amount: BigInt(100),
          //     to: '0xabc...',
          //   },
          // },
        ];
        setActivities(dummyActivities);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        setActivities([]);
      } finally {
        setIsLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [address]);

  /**
   * SBT情報を取得
   * TODO: SBTコントラクトから取得
   */
  useEffect(() => {
    if (!address || !contract) return;

    const fetchSBTs = async () => {
      try {
        // TODO: SBTコントラクトにtokensOfOwner関数があれば取得
        // 現在は userNFTLevel から推測
        if (userLevel && Number(userLevel) > 0) {
          const level = Number(userLevel);
          const dummySBT: SBT = {
            tokenId: BigInt(level),
            mintedAt: new Date(), // TODO: イベントログから取得
            metadata: {
              name: `Gifterra SBT Level ${level}`,
              description: `レベル${level}のSoulbound Token`,
              level,
            },
          };
          setSbts([dummySBT]);
        } else {
          setSbts([]);
        }
      } catch (error) {
        console.error('Failed to fetch SBTs:', error);
        setSbts([]);
      }
    };

    fetchSBTs();
  }, [address, contract, userLevel]);

  /**
   * プロフィールを再取得
   */
  const refetch = () => {
    // thirdwebのuseContractReadは自動的にrefetchをサポート
    // アクティビティとSBTは上記のuseEffectで自動更新される
  };

  return {
    profile,
    activities,
    isLoading: isLoadingUserInfo || isLoadingLevel || isLoadingActivities,
    isError: !profile && !isLoadingUserInfo && !isLoadingLevel && !!address,
    refetch,
  };
}

/**
 * 接続中のウォレットのプロフィールを取得する簡易フック
 */
export function useMyProfile() {
  const address = useAddress();
  return useUserProfile(address);
}
