// src/utils/userProfile.ts
// ユーザープロフィール関連のユーティリティ関数

import type { RankName, RankConfig, Rank } from '../types/user';
import { DEFAULT_RANK_CONFIGS } from '../types/user';

/**
 * 貢献度ポイントから現在のランクを計算
 */
export function calculateRank(points: bigint, configs: RankConfig[] = DEFAULT_RANK_CONFIGS): Rank {
  // ポイントの降順でソート
  const sortedConfigs = [...configs].sort((a, b) =>
    Number(b.threshold - a.threshold)
  );

  // 現在のランクを見つける
  let currentConfig = sortedConfigs[sortedConfigs.length - 1]; // デフォルトは最低ランク

  for (const config of sortedConfigs) {
    if (points >= config.threshold) {
      currentConfig = config;
      break;
    }
  }

  // 次のランクを見つける
  const nextConfig = configs.find(c => c.level === currentConfig.level + 1);

  return {
    name: currentConfig.name,
    level: currentConfig.level,
    points,
    threshold: currentConfig.threshold,
    nextRank: nextConfig?.name,
    pointsToNext: nextConfig ? nextConfig.threshold - points : undefined,
  };
}

/**
 * ランク名から色を取得
 */
export function getRankColor(rankName: RankName, configs: RankConfig[] = DEFAULT_RANK_CONFIGS): string {
  return configs.find(c => c.name === rankName)?.color || '#CD7F32';
}

/**
 * ランク名からバッジ絵文字を取得
 */
export function getRankBadge(rankName: RankName, configs: RankConfig[] = DEFAULT_RANK_CONFIGS): string {
  return configs.find(c => c.name === rankName)?.badge || '🥉';
}

/**
 * ランク名からレベルを取得
 */
export function getRankLevel(rankName: RankName, configs: RankConfig[] = DEFAULT_RANK_CONFIGS): number {
  return configs.find(c => c.name === rankName)?.level || 0;
}

/**
 * アドレスを短縮表示
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * トークン量をフォーマット
 */
export function formatTokenAmount(amountWei: bigint | string, decimals: number = 18, maxDecimals: number = 2): string {
  const amount = typeof amountWei === 'string' ? BigInt(amountWei) : amountWei;
  const divisor = BigInt(10) ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === BigInt(0)) {
    return integerPart.toLocaleString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const truncated = fractionalStr.slice(0, maxDecimals);

  return `${integerPart.toLocaleString()}.${truncated}`;
}

/**
 * 日付を相対表示（例: "2時間前"）
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffYear > 0) return `${diffYear}年前`;
  if (diffMonth > 0) return `${diffMonth}ヶ月前`;
  if (diffDay > 0) return `${diffDay}日前`;
  if (diffHour > 0) return `${diffHour}時間前`;
  if (diffMin > 0) return `${diffMin}分前`;
  return '今';
}

/**
 * アクティビティタイプの表示名を取得
 */
export function getActivityTypeName(type: string): string {
  const names: Record<string, string> = {
    'tip_sent': 'Tip送信',
    'tip_received': 'Tip受取',
    'purchase': '特典受取',
    'reward_claimed': 'Reward受取',
    'rank_up': 'ランクアップ',
    'sbt_minted': 'SBT取得',
  };
  return names[type] || type;
}

/**
 * アクティビティタイプのアイコンを取得
 */
export function getActivityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'tip_sent': '💸',
    'tip_received': '💰',
    'purchase': '🎁',
    'reward_claimed': '🎉',
    'rank_up': '⬆️',
    'sbt_minted': '🖼️',
  };
  return icons[type] || '📝';
}

/**
 * プロフィールURLを生成
 */
export function getProfileUrl(address: string): string {
  return `/user/${address}`;
}

/**
 * Twitterシェア用のテキストを生成
 */
export function generateTwitterShareText(
  address: string,
  rankName: RankName,
  points: bigint,
  sbtCount: number
): string {
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/user/${address}`;

  return `🎉 Gifterra で ${rankName} ランク達成！

💎 貢献度: ${points.toLocaleString()} pt
🖼️ SBT: ${sbtCount}個

あなたも参加しよう！
${url}

#Gifterra #JPYC #Web3`;
}

/**
 * プロフィール画像URLを取得（ENS Avatar対応予定）
 */
export function getProfileImageUrl(address: string, ensName?: string): string | null {
  // TODO: ENS Avatarの取得を実装
  // 現在はJazzicon等を使用することを想定
  return null;
}
