// src/lib/rewardDistribution.ts
// Reward配布履歴の管理（RandomRewardEngine + DailyReward）

import type { TokenId } from '../config/tokens';
import { TOKEN_MASTER_DATA } from '../config/tokens';

/**
 * 配布トリガータイプ
 */
export type DistributionTrigger =
  | 'DAILY_REWARD'      // デイリーリワード（24時間毎）
  | 'TIP_MILESTONE'     // TIPマイルストーン報酬
  | 'MANUAL_GACHA'      // 手動ガチャ
  | 'MANUAL_AIRDROP';   // 手動配布（管理者による直接配布）

/**
 * レアリティ
 */
export type RewardRarity = 'COMMON' | 'RARE' | 'SR' | 'SSR' | 'NONE';

/**
 * 報酬タイプ
 */
export type RewardType = 'TOKEN' | 'NFT';

/**
 * 配布ステータス
 */
export type DistributionStatus =
  | 'completed'   // 配布完了
  | 'pending'     // 配布待ち
  | 'failed';     // 配布失敗

/**
 * Reward配布履歴アイテム
 */
export interface RewardDistributionItem {
  id: string;
  recipient: string;              // 受信者アドレス
  trigger: DistributionTrigger;   // 配布トリガー
  rewardType: RewardType;         // トークンかNFTか
  rarity: RewardRarity;           // レアリティ

  // トークン報酬の場合
  tokenAmount?: string;           // トークン量（wei）
  tokenAmountFormatted?: string;  // フォーマット済みトークン量
  tokenId?: TokenId;              // トークンID

  // NFT報酬の場合
  nftTokenId?: number;            // NFT Token ID
  nftSku?: string;                // NFT SKU
  nftName?: string;               // NFT名

  userRank?: number;              // ユーザーランク（抽選時）
  status: DistributionStatus;     // 配布ステータス
  transactionHash?: string;       // トランザクションハッシュ
  errorMessage?: string;          // エラーメッセージ（失敗時）
  timestamp: string;              // 配布日時（ISO 8601）
  blockNumber?: number;           // ブロック番号
}

/**
 * 配布履歴フィルタ
 */
export interface DistributionFilter {
  startDate?: string;              // 開始日（YYYY-MM-DD）
  endDate?: string;                // 終了日（YYYY-MM-DD）
  trigger?: DistributionTrigger;   // トリガーフィルタ
  rarity?: RewardRarity;           // レアリティフィルタ
  rewardType?: RewardType;         // 報酬タイプフィルタ
  status?: DistributionStatus;     // ステータスフィルタ
  recipient?: string;              // 受信者アドレス
}

/**
 * 配布統計
 */
export interface DistributionStats {
  totalDistributions: number;
  completedDistributions: number;
  pendingDistributions: number;
  failedDistributions: number;

  // トリガー別統計
  byTrigger: {
    trigger: DistributionTrigger;
    count: number;
  }[];

  // レアリティ別統計
  byRarity: {
    rarity: RewardRarity;
    count: number;
  }[];

  // 報酬タイプ別統計
  byType: {
    type: RewardType;
    count: number;
  }[];

  // トークン配布総額
  totalTokenDistributed: {
    tokenId: TokenId;
    amount: string;
    amountFormatted: string;
  }[];

  // NFT配布総数
  totalNFTDistributed: number;

  // ユニーク受信者数
  uniqueRecipients: number;
}

/**
 * モックデータ生成（将来的にSupabaseやイベントログから取得）
 */
function generateMockDistributionHistory(): RewardDistributionItem[] {
  const triggers: DistributionTrigger[] = ['DAILY_REWARD', 'TIP_MILESTONE', 'MANUAL_GACHA', 'MANUAL_AIRDROP'];
  const rarities: RewardRarity[] = ['COMMON', 'RARE', 'SR', 'SSR', 'NONE'];
  const statuses: DistributionStatus[] = ['completed', 'pending', 'failed'];
  const rewardTypes: RewardType[] = ['TOKEN', 'NFT'];

  const mockData: RewardDistributionItem[] = [];
  const now = new Date();

  for (let i = 0; i < 200; i++) {
    const trigger = triggers[Math.floor(Math.random() * triggers.length)];
    const rewardType = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
    const rarity = trigger === 'DAILY_REWARD' || trigger === 'MANUAL_AIRDROP'
      ? 'NONE'
      : rarities[Math.floor(Math.random() * rarities.length)];
    const status = statuses[Math.floor(Math.random() * 100) < 90 ? 0 : (Math.random() < 0.5 ? 1 : 2)];

    const timestamp = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    let tokenAmount: string | undefined;
    let tokenAmountFormatted: string | undefined;
    let tokenId: TokenId | undefined;
    let nftTokenId: number | undefined;
    let nftSku: string | undefined;
    let nftName: string | undefined;

    if (rewardType === 'TOKEN') {
      tokenId = 'NHT';
      const amountValue = trigger === 'DAILY_REWARD'
        ? 100
        : rarity === 'COMMON' ? 50 : rarity === 'RARE' ? 100 : rarity === 'SR' ? 300 : 1000;
      tokenAmount = (BigInt(amountValue) * (BigInt(10) ** BigInt(18))).toString();
      tokenAmountFormatted = `${amountValue} ${TOKEN_MASTER_DATA[tokenId].symbol}`;
    } else {
      nftTokenId = Math.floor(Math.random() * 1000) + 1;
      nftSku = `NFT_${rarity}_${Math.floor(Math.random() * 10)}`;
      nftName = `${rarity} Reward NFT #${nftTokenId}`;
    }

    mockData.push({
      id: `dist_${i.toString().padStart(6, '0')}`,
      recipient: `0x${Math.random().toString(16).substring(2, 42)}`,
      trigger,
      rewardType,
      rarity,
      tokenAmount,
      tokenAmountFormatted,
      tokenId,
      nftTokenId,
      nftSku,
      nftName,
      userRank: Math.floor(Math.random() * 5) + 1,
      status,
      transactionHash: status === 'completed' ? `0x${Math.random().toString(16).substring(2, 66)}` : undefined,
      errorMessage: status === 'failed' ? 'Insufficient gas' : undefined,
      timestamp: timestamp.toISOString(),
      blockNumber: status === 'completed' ? Math.floor(Math.random() * 1000000) + 40000000 : undefined,
    });
  }

  return mockData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

let cachedMockData: RewardDistributionItem[] | null = null;

/**
 * 配布履歴を取得
 *
 * TODO: 将来的にはRandomRewardEngineのRewardDrawnイベントログを読み取る
 * TODO: DailyRewardの配布履歴もSupabaseから取得
 *
 * @param filter フィルタ条件
 * @param limit 取得件数
 * @param offset オフセット
 * @returns 配布履歴アイテム配列
 */
export async function fetchDistributionHistory(
  filter?: DistributionFilter,
  limit: number = 50,
  offset: number = 0
): Promise<RewardDistributionItem[]> {
  // モックデータを使用（初回のみ生成、以降はキャッシュ）
  if (!cachedMockData) {
    cachedMockData = generateMockDistributionHistory();
  }

  let filtered = [...cachedMockData];

  // フィルタ適用
  if (filter) {
    if (filter.startDate) {
      filtered = filtered.filter(item => item.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => new Date(item.timestamp) <= endDate);
    }
    if (filter.trigger) {
      filtered = filtered.filter(item => item.trigger === filter.trigger);
    }
    if (filter.rarity) {
      filtered = filtered.filter(item => item.rarity === filter.rarity);
    }
    if (filter.rewardType) {
      filtered = filtered.filter(item => item.rewardType === filter.rewardType);
    }
    if (filter.status) {
      filtered = filtered.filter(item => item.status === filter.status);
    }
    if (filter.recipient) {
      const normalizedSearch = filter.recipient.toLowerCase();
      filtered = filtered.filter(item =>
        item.recipient.toLowerCase().includes(normalizedSearch)
      );
    }
  }

  // ページネーション
  return filtered.slice(offset, offset + limit);
}

/**
 * 配布統計を計算
 *
 * @param items 配布履歴アイテム配列
 * @returns 配布統計
 */
export function calculateDistributionStats(items: RewardDistributionItem[]): DistributionStats {
  const completedDistributions = items.filter(item => item.status === 'completed').length;
  const pendingDistributions = items.filter(item => item.status === 'pending').length;
  const failedDistributions = items.filter(item => item.status === 'failed').length;

  // トリガー別集計
  const triggerMap = new Map<DistributionTrigger, number>();
  items.forEach(item => {
    triggerMap.set(item.trigger, (triggerMap.get(item.trigger) || 0) + 1);
  });
  const byTrigger = Array.from(triggerMap.entries()).map(([trigger, count]) => ({
    trigger,
    count,
  }));

  // レアリティ別集計
  const rarityMap = new Map<RewardRarity, number>();
  items.forEach(item => {
    rarityMap.set(item.rarity, (rarityMap.get(item.rarity) || 0) + 1);
  });
  const byRarity = Array.from(rarityMap.entries()).map(([rarity, count]) => ({
    rarity,
    count,
  }));

  // 報酬タイプ別集計
  const typeMap = new Map<RewardType, number>();
  items.forEach(item => {
    typeMap.set(item.rewardType, (typeMap.get(item.rewardType) || 0) + 1);
  });
  const byType = Array.from(typeMap.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  // トークン配布総額計算
  const tokenMap = new Map<TokenId, bigint>();
  items.forEach(item => {
    if (item.rewardType === 'TOKEN' && item.tokenId && item.tokenAmount && item.status === 'completed') {
      const existing = tokenMap.get(item.tokenId) || 0n;
      tokenMap.set(item.tokenId, existing + BigInt(item.tokenAmount));
    }
  });
  const totalTokenDistributed = Array.from(tokenMap.entries()).map(([tokenId, amount]) => ({
    tokenId,
    amount: amount.toString(),
    amountFormatted: formatTokenAmount(amount.toString(), tokenId),
  }));

  // NFT配布総数
  const totalNFTDistributed = items.filter(item =>
    item.rewardType === 'NFT' && item.status === 'completed'
  ).length;

  // ユニーク受信者数
  const uniqueRecipients = new Set(items.map(item => item.recipient.toLowerCase())).size;

  return {
    totalDistributions: items.length,
    completedDistributions,
    pendingDistributions,
    failedDistributions,
    byTrigger,
    byRarity,
    byType,
    totalTokenDistributed,
    totalNFTDistributed,
    uniqueRecipients,
  };
}

/**
 * トークン量フォーマット
 */
function formatTokenAmount(amountWei: string, tokenId: TokenId): string {
  const config = TOKEN_MASTER_DATA[tokenId];
  if (!config) return amountWei;

  const amount = BigInt(amountWei);
  const divisor = BigInt(10) ** BigInt(config.decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return `${integerPart} ${config.symbol}`;
  }

  const fractionalStr = fractionalPart.toString().padStart(config.decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  return `${integerPart}.${trimmedFractional} ${config.symbol}`;
}

/**
 * CSV出力用のデータ変換
 *
 * @param items 配布履歴アイテム配列
 * @returns CSV文字列
 */
export function exportDistributionHistoryToCSV(items: RewardDistributionItem[]): string {
  const headers = [
    'ID',
    'Recipient',
    'Trigger',
    'Reward Type',
    'Rarity',
    'Token Amount',
    'NFT Token ID',
    'NFT Name',
    'User Rank',
    'Status',
    'Transaction Hash',
    'Timestamp',
    'Block Number',
  ];

  const rows = items.map(item => [
    item.id,
    item.recipient,
    item.trigger,
    item.rewardType,
    item.rarity,
    item.tokenAmountFormatted || '-',
    item.nftTokenId?.toString() || '-',
    item.nftName || '-',
    item.userRank?.toString() || '-',
    item.status,
    item.transactionHash || '-',
    new Date(item.timestamp).toLocaleString('ja-JP'),
    item.blockNumber?.toString() || '-',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * トリガー表示名取得
 */
export function getTriggerDisplayName(trigger: DistributionTrigger): string {
  const names: Record<DistributionTrigger, string> = {
    DAILY_REWARD: 'デイリーリワード',
    TIP_MILESTONE: 'TIPマイルストーン',
    MANUAL_GACHA: '手動ガチャ',
    MANUAL_AIRDROP: '手動配布',
  };
  return names[trigger];
}

/**
 * レアリティ表示名取得
 */
export function getRarityDisplayName(rarity: RewardRarity): string {
  const names: Record<RewardRarity, string> = {
    COMMON: 'コモン',
    RARE: 'レア',
    SR: 'SR',
    SSR: 'SSR',
    NONE: '-',
  };
  return names[rarity];
}

/**
 * ステータス表示名取得
 */
export function getStatusDisplayName(status: DistributionStatus): string {
  const names: Record<DistributionStatus, string> = {
    completed: '配布完了',
    pending: '配布待ち',
    failed: '失敗',
  };
  return names[status];
}
