// src/lib/kodomi-integration.ts
// GIFT HUB と Tip UI の貢献熱量を統合するライブラリ

import type { ContributionHeat } from './ai_analysis';

/**
 * GIFT HUB専用：拡張された貢献熱量プロファイル
 */
export interface ExtendedKodomiProfile extends ContributionHeat {
  // Tip UIからの既存データ
  tipUI: {
    heatScore: number;
    heatLevel: string;
    tipCount: number;
    totalAmount: string;
    sentimentScore: number;
  };

  // GIFT HUB新規データ
  giftHub: {
    claimCount: number;        // 特典受け取り回数
    totalTipped: string;        // GIFT HUBでのチップ総額
    favoriteCategories: string[]; // よく受け取る特典カテゴリ
    lastClaimDate: string;      // 最終受け取り日時
  };

  // 統合スコア
  combined: {
    engagementLevel: 'PREMIUM' | 'ACTIVE' | 'CASUAL';
    loyaltyScore: number;       // 総合ロイヤリティ（0-1000）
    recommendedBenefits: string[]; // おすすめ特典ID（Phase 2で実装）
  };
}

/**
 * ユーザーの統合プロファイル取得
 */
export async function getExtendedKodomiProfile(
  walletAddress: string
): Promise<ExtendedKodomiProfile | null> {
  try {
    // 1. Tip UIの貢献熱量を取得（既存システム）
    const tipUIData = await fetchTipUIKodomiData(walletAddress);

    // 2. GIFT HUBの受け取り履歴を取得
    const giftHubData = await fetchGiftHubClaimHistory(walletAddress);

    // 3. 統合分析
    const combined = analyzeEngagement(tipUIData, giftHubData);

    return {
      ...tipUIData,
      tipUI: {
        heatScore: tipUIData.heatScore,
        heatLevel: tipUIData.heatLevel,
        tipCount: tipUIData.tipCount,
        totalAmount: tipUIData.totalAmount,
        sentimentScore: tipUIData.sentimentScore
      },
      giftHub: giftHubData,
      combined
    };
  } catch (error) {
    console.error('❌ Failed to get extended kodomi profile:', error);
    return null;
  }
}

/**
 * Tip UIの貢献熱量データ取得
 * 既存のanalyzeContributionHeatの結果をキャッシュから取得
 */
async function fetchTipUIKodomiData(
  walletAddress: string
): Promise<ContributionHeat> {
  // ローカルストレージから取得（Tip UIで計算済み）
  const savedData = localStorage.getItem('tip_kodomi_cache');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      const userHeat = parsed.users?.find(
        (h: ContributionHeat) => h.address.toLowerCase() === walletAddress.toLowerCase()
      );
      if (userHeat) {
        return userHeat;
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse tip kodomi cache:', e);
    }
  }

  // データがない場合のデフォルト
  return {
    address: walletAddress,
    name: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
    totalAmount: '0',
    amountRank: 0,
    tipCount: 0,
    messageCount: 0,
    sentimentScore: 50,
    sentimentLabel: 'neutral',
    keywords: [],
    heatScore: 0,
    heatLevel: '😊ライト',
    firstTipDate: '',
    lastTipDate: ''
  };
}

/**
 * GIFT HUBの受け取り履歴取得
 */
async function fetchGiftHubClaimHistory(walletAddress: string) {
  try {
    const response = await fetch('/api/user/claim-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });

    if (!response.ok) {
      console.warn('⚠️ GIFT HUB 履歴取得失敗:', response.status);
      return getDefaultGiftHubData();
    }

    const data = await response.json();

    // カテゴリ分析（受け取った特典の種類）
    const categories = new Map<string, number>();
    let totalTipped = 0n;

    data.claims?.forEach((claim: any) => {
      const category = claim.benefit?.category || 'その他';
      categories.set(category, (categories.get(category) || 0) + 1);
      totalTipped += BigInt(claim.tipAmount || '0');
    });

    const favoriteCategories = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    return {
      claimCount: data.claims?.length || 0,
      totalTipped: totalTipped.toString(),
      favoriteCategories,
      lastClaimDate: data.claims?.[0]?.claimDate || ''
    };
  } catch (error) {
    console.error('❌ GIFT HUB 履歴取得エラー:', error);
    return getDefaultGiftHubData();
  }
}

function getDefaultGiftHubData() {
  return {
    claimCount: 0,
    totalTipped: '0',
    favoriteCategories: [] as string[],
    lastClaimDate: ''
  };
}

/**
 * エンゲージメントレベル分析
 */
function analyzeEngagement(
  tipUI: ContributionHeat,
  giftHub: ReturnType<typeof getDefaultGiftHubData>
) {
  // 総合ロイヤリティスコア計算
  const tipScore = tipUI.heatScore; // 0-1000
  const claimScore = Math.min(500, giftHub.claimCount * 50); // 受け取り回数
  const loyaltyScore = Math.round((tipScore + claimScore) / 1.5);

  // エンゲージメントレベル判定
  let engagementLevel: 'PREMIUM' | 'ACTIVE' | 'CASUAL';
  if (loyaltyScore >= 800) engagementLevel = 'PREMIUM';
  else if (loyaltyScore >= 400) engagementLevel = 'ACTIVE';
  else engagementLevel = 'CASUAL';

  return {
    engagementLevel,
    loyaltyScore,
    recommendedBenefits: [] // Phase 2で実装
  };
}

/**
 * 簡易プロファイル取得（キャッシュのみ、API呼び出しなし）
 */
export function getCachedKodomiProfile(walletAddress: string): Partial<ExtendedKodomiProfile> | null {
  const savedData = localStorage.getItem('tip_kodomi_cache');
  if (!savedData) return null;

  try {
    const parsed = JSON.parse(savedData);
    const userHeat = parsed.users?.find(
      (h: ContributionHeat) => h.address.toLowerCase() === walletAddress.toLowerCase()
    );

    if (userHeat) {
      return {
        ...userHeat,
        tipUI: {
          heatScore: userHeat.heatScore,
          heatLevel: userHeat.heatLevel,
          tipCount: userHeat.tipCount,
          totalAmount: userHeat.totalAmount,
          sentimentScore: userHeat.sentimentScore
        }
      };
    }
  } catch (e) {
    console.warn('Failed to get cached profile:', e);
  }

  return null;
}
