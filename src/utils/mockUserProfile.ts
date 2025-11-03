// src/utils/mockUserProfile.ts
// モックユーザープロフィール生成ユーティリティ

import type { UserProfile, Activity, SBT, RankName } from '../types/user';
import { DEFAULT_RANK_CONFIGS } from '../types/user';
import { calculateRank } from '../utils/userProfile';

/**
 * モックプロフィール生成オプション
 */
export interface MockProfileOptions {
  /** ウォレットアドレス */
  address: string;
  /** ランク（指定しない場合は貢献度ポイントから自動計算） */
  rank?: RankName;
  /** 貢献度ポイント */
  contributionPoints?: bigint;
  /** Tip送信額 */
  totalTipsSent?: bigint;
  /** Tip受取額 */
  totalTipsReceived?: bigint;
  /** 特典配布回数 */
  purchaseCount?: number;
  /** Reward受取回数 */
  rewardClaimedCount?: number;
  /** アクティビティ数 */
  activityCount?: number;
  /** SBT数 */
  sbtCount?: number;
  /** ENS名 */
  ensName?: string;
}

/**
 * モックアクティビティを生成
 */
function generateMockActivities(count: number, address: string): Activity[] {
  const activities: Activity[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const dayOffset = i * 86400000; // 1日ごと
    const timestamp = new Date(now - dayOffset);

    // ランダムにアクティビティタイプを選択
    const types: Activity['type'][] = ['tip_sent', 'tip_received', 'purchase', 'reward_claimed'];
    const type = types[Math.floor(Math.random() * types.length)];

    let activity: Activity;

    switch (type) {
      case 'tip_sent':
        activity = {
          id: `mock-${i}`,
          type: 'tip_sent',
          timestamp,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          details: {
            amount: BigInt(Math.floor(Math.random() * 5000) + 100),
            tokenSymbol: 'JPYC',
            to: `0x${Math.random().toString(16).substring(2, 42)}`,
            description: 'Tipを送信しました',
          },
        };
        break;

      case 'tip_received':
        activity = {
          id: `mock-${i}`,
          type: 'tip_received',
          timestamp,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          details: {
            amount: BigInt(Math.floor(Math.random() * 3000) + 50),
            tokenSymbol: 'JPYC',
            from: `0x${Math.random().toString(16).substring(2, 42)}`,
            description: 'Tipを受け取りました',
          },
        };
        break;

      case 'purchase':
        activity = {
          id: `mock-${i}`,
          type: 'purchase',
          timestamp,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          details: {
            amount: BigInt(Math.floor(Math.random() * 10000) + 500),
            tokenSymbol: 'JPYC',
            productId: `product-${i}`,
            productName: ['限定アイテム', 'デジタルコンテンツ', 'プレミアム特典'][Math.floor(Math.random() * 3)],
            description: '特典を受け取りました',
          },
        };
        break;

      case 'reward_claimed':
        activity = {
          id: `mock-${i}`,
          type: 'reward_claimed',
          timestamp,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          details: {
            amount: BigInt(100),
            tokenSymbol: 'JPYC',
            description: 'デイリーリワードを受け取りました',
          },
        };
        break;
    }

    activities.push(activity);
  }

  // ランクアップイベントを追加（ランダムに1-2個）
  const rankUpCount = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < rankUpCount && i < count; i++) {
    const insertIndex = Math.floor(Math.random() * activities.length);
    const ranks: RankName[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    activities.splice(insertIndex, 0, {
      id: `mock-rankup-${i}`,
      type: 'rank_up',
      timestamp: new Date(now - Math.random() * 30 * 86400000),
      details: {
        newRank: ranks[Math.floor(Math.random() * ranks.length)],
        description: 'ランクアップしました！',
      },
    });
  }

  // タイムスタンプでソート（新しい順）
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * モックSBTを生成
 */
function generateMockSBTs(count: number, rankName: RankName): SBT[] {
  const sbts: SBT[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    sbts.push({
      tokenId: BigInt(i + 1),
      mintedAt: new Date(now - (count - i) * 7 * 86400000), // 1週間ごと
      metadata: {
        name: `Gifterra SBT #${i + 1}`,
        description: `${rankName}ランクのSoulbound Token`,
        attributes: [
          { trait_type: 'Rank', value: rankName },
          { trait_type: 'Level', value: i + 1 },
          { trait_type: 'Rarity', value: ['Common', 'Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 4)] },
        ],
      },
    });
  }

  return sbts;
}

/**
 * モックユーザープロフィールを生成
 *
 * @param options - モックデータのオプション
 * @returns モックユーザープロフィール
 */
export function generateMockUserProfile(options: MockProfileOptions): UserProfile {
  const {
    address,
    rank: targetRank,
    contributionPoints,
    totalTipsSent = BigInt(0),
    totalTipsReceived = BigInt(0),
    purchaseCount = 0,
    rewardClaimedCount = 0,
    activityCount = 10,
    sbtCount = 1,
    ensName,
  } = options;

  // 貢献度ポイントを決定
  let points: bigint;
  if (contributionPoints !== undefined) {
    points = contributionPoints;
  } else if (targetRank) {
    // ランクから貢献度ポイントを逆算
    const rankConfig = DEFAULT_RANK_CONFIGS.find(r => r.name === targetRank);
    if (rankConfig) {
      const nextRankConfig = DEFAULT_RANK_CONFIGS.find(r => r.level === rankConfig.level + 1);
      if (nextRankConfig) {
        // 次のランクの閾値の中間値を設定
        points = rankConfig.threshold + (nextRankConfig.threshold - rankConfig.threshold) / BigInt(2);
      } else {
        // 最高ランクの場合
        points = rankConfig.threshold + BigInt(50000);
      }
    } else {
      points = BigInt(0);
    }
  } else {
    points = totalTipsSent; // デフォルトはTip送信額と同じ
  }

  // ランクを計算
  const rank = calculateRank(points, DEFAULT_RANK_CONFIGS);

  // アクティビティを生成
  const activities = generateMockActivities(activityCount, address);

  // SBTを生成
  const sbts = generateMockSBTs(sbtCount, rank.name);

  // 統計情報を計算
  const tipSentCount = activities.filter(a => a.type === 'tip_sent').length;
  const tipReceivedCount = activities.filter(a => a.type === 'tip_received').length;

  const profile: UserProfile = {
    address,
    ensName,
    rank,
    sbts,
    stats: {
      totalTipsSent,
      totalTipsReceived,
      tipSentCount,
      tipReceivedCount,
      purchaseCount,
      rewardClaimedCount,
      activeDays: Math.floor(activityCount / 2), // 仮定: 1日2アクティビティ
      firstActivityAt: activities.length > 0 ? activities[activities.length - 1].timestamp : undefined,
      lastActivityAt: activities.length > 0 ? activities[0].timestamp : undefined,
    },
    recentActivities: activities.slice(0, 10),
  };

  return profile;
}

/**
 * プリセットのモックプロフィールを生成
 */
export const MOCK_PROFILE_PRESETS = {
  /** 初心者ユーザー（Bronze） */
  beginner: (address: string): UserProfile => generateMockUserProfile({
    address,
    rank: 'Bronze',
    totalTipsSent: BigInt(500),
    totalTipsReceived: BigInt(200),
    purchaseCount: 1,
    rewardClaimedCount: 3,
    activityCount: 5,
    sbtCount: 1,
  }),

  /** 中級ユーザー（Silver） */
  intermediate: (address: string): UserProfile => generateMockUserProfile({
    address,
    rank: 'Silver',
    totalTipsSent: BigInt(3000),
    totalTipsReceived: BigInt(1500),
    purchaseCount: 5,
    rewardClaimedCount: 15,
    activityCount: 20,
    sbtCount: 2,
  }),

  /** 上級ユーザー（Gold） */
  advanced: (address: string): UserProfile => generateMockUserProfile({
    address,
    rank: 'Gold',
    totalTipsSent: BigInt(15000),
    totalTipsReceived: BigInt(8000),
    purchaseCount: 15,
    rewardClaimedCount: 40,
    activityCount: 50,
    sbtCount: 3,
  }),

  /** エキスパートユーザー（Platinum） */
  expert: (address: string): UserProfile => generateMockUserProfile({
    address,
    rank: 'Platinum',
    totalTipsSent: BigInt(50000),
    totalTipsReceived: BigInt(25000),
    purchaseCount: 30,
    rewardClaimedCount: 90,
    activityCount: 100,
    sbtCount: 4,
    ensName: 'gifterra-expert.eth',
  }),

  /** レジェンドユーザー（Diamond） */
  legend: (address: string): UserProfile => generateMockUserProfile({
    address,
    rank: 'Diamond',
    totalTipsSent: BigInt(200000),
    totalTipsReceived: BigInt(100000),
    purchaseCount: 100,
    rewardClaimedCount: 300,
    activityCount: 200,
    sbtCount: 5,
    ensName: 'gifterra-legend.eth',
  }),
};
