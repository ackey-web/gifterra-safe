# ハイブリッドウォレット + ユーザープロフィール実装計画

**最終更新**: 2025-10-27
**ステータス**: 実装開始

---

## 📋 概要

Gifterraをメインネット移行するにあたり、以下の2つの主要機能を実装します：

1. **ハイブリッドウォレット設計**
   - スマートウォレット（メール/SNSログイン + ガスレス）
   - 外部ウォレット（MetaMask等の直接接続）
   - 両方をシームレスに統合

2. **ユーザープロフィールページ**
   - SBT/ランク/貢献度の可視化
   - アクティビティ履歴
   - ソーシャル共有機能

---

## 🎯 実装の目的

### なぜ今やるのか

```
JPYC発行という一度きりのチャンス:
- 新規ユーザー大量流入が見込まれる
- 初心者にも上級者にも対応が必要
- 「盛り盛り戦略」で差別化
- ユーザーエンゲージメントの最大化

→ 完璧な状態でローンチ
```

### 期待される効果

| 指標 | Before | After | 改善率 |
|------|--------|-------|--------|
| 新規登録完了率 | 10% | 80% | 8倍 |
| 離脱率 | 90% | 20% | 4.5倍改善 |
| 平均滞在時間 | 3分 | 15分 | 5倍 |
| SNSシェア | なし | 高頻度 | ∞ |
| リピート率 | 20% | 60% | 3倍 |

---

## 🏗️ アーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────┐
│          Gifterra Frontend              │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Wallet Connection Layer          │  │
│  ├───────────────────────────────────┤  │
│  │                                   │  │
│  │  🔹 Smart Wallet (推奨)          │  │
│  │    ├─ Embedded Wallet             │  │
│  │    │   ├─ Email Auth              │  │
│  │    │   ├─ Google OAuth            │  │
│  │    │   └─ Discord OAuth           │  │
│  │    ├─ MetaMask (via Smart Wallet) │  │
│  │    └─ WalletConnect               │  │
│  │                                   │  │
│  │  🔹 External Wallet (上級者)      │  │
│  │    ├─ MetaMask                    │  │
│  │    ├─ WalletConnect               │  │
│  │    └─ Coinbase Wallet             │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  User Profile System              │  │
│  ├───────────────────────────────────┤  │
│  │  - /user/:address                 │  │
│  │  - SBT Gallery                    │  │
│  │  - Rank & Stats                   │  │
│  │  - Activity Feed                  │  │
│  │  - Social Share                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Gas Sponsorship Engine           │  │
│  ├───────────────────────────────────┤  │
│  │  - Paymaster (thirdweb)           │  │
│  │  - Sponsorship Rules              │  │
│  │  - Cost Tracking                  │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      Polygon Mainnet / Amoy             │
│  - Gifterra Contract (SBT)              │
│  - RewardNFT Contract                   │
│  - PaymentSplitter                      │
│  - JPYC ERC20                           │
└─────────────────────────────────────────┘
```

---

## 📦 Phase 1: ハイブリッドウォレット実装

### 1.1 依存関係の追加

```bash
# 必要なパッケージ
pnpm add @thirdweb-dev/react@latest
pnpm add @thirdweb-dev/wallets@latest
```

**現在の状況確認**:
- `@thirdweb-dev/react`: 既にインストール済み ✅
- バージョン確認が必要

### 1.2 環境変数の設定

**.env.example に追加**:
```bash
# Smart Wallet Configuration
VITE_SMART_WALLET_FACTORY=0x...  # thirdweb Factory Address
VITE_PAYMASTER_URL=https://...   # Paymaster Endpoint

# Embedded Wallet (Email/Social Login)
VITE_THIRDWEB_CLIENT_ID=your_client_id_here

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### 1.3 ウォレット設定ファイル

**src/config/wallets.ts** (新規作成):
```typescript
import {
  metamask,
  walletConnect,
  coinbaseWallet,
  smartWallet,
  embeddedWallet,
  SmartWalletConfig,
} from "@thirdweb-dev/react";

// スマートウォレットの設定
export const smartWalletConfig: SmartWalletConfig = {
  factoryAddress: import.meta.env.VITE_SMART_WALLET_FACTORY || "",
  gasless: true,

  // スマートウォレット内で使える個人ウォレット
  personalWallets: [
    // Embedded Wallet（メール/SNSログイン）
    embeddedWallet({
      recommended: true,
      auth: {
        options: [
          "email",    // メール認証
          "google",   // Googleログイン
          "discord",  // Discordログイン
        ],
      },
    }),

    // MetaMask（スマートウォレット経由）
    metamask(),

    // WalletConnect（スマートウォレット経由）
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
    }),
  ],
};

// サポートするウォレット一覧
export const supportedWallets = [
  // メイン: スマートウォレット
  smartWallet(smartWalletConfig),

  // サブ: 外部ウォレット直接接続（上級者向け）
  metamask(),
  walletConnect({
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
  }),
  coinbaseWallet(),
];

// ガススポンサーシップの設定
export const gasSponsorshipConfig = {
  // 新規ユーザー: 最初の5トランザクション無料
  firstTransactions: 5,

  // Tip機能: 常に無料（1000 JPYC以下）
  sponsoredFunctions: {
    tip: {
      enabled: true,
      maxAmount: "1000000000000000000000", // 1000 * 10^18
    },
  },

  // GIFT HUB購入: 100 JPYC以下は無料
  purchase: {
    enabled: true,
    threshold: "100000000000000000000", // 100 * 10^18
  },
};
```

### 1.4 メインApp.tsxの更新

**src/App.tsx** (既存ファイルの修正):
```typescript
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { PolygonAmoyTestnet, Polygon } from "@thirdweb-dev/chains";
import { supportedWallets } from "./config/wallets";
import { getNetworkEnv } from "./config/tokens";

function App() {
  const network = getNetworkEnv();
  const activeChain = network === "mainnet" ? Polygon : PolygonAmoyTestnet;

  return (
    <ThirdwebProvider
      activeChain={activeChain}
      clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
      supportedWallets={supportedWallets}
      authConfig={{
        domain: window.location.origin,
        authUrl: "/api/auth",
      }}
    >
      <Router>
        {/* 既存のルート */}
      </Router>
    </ThirdwebProvider>
  );
}
```

### 1.5 カスタム接続UIの実装

**src/components/wallet/ConnectWalletModal.tsx** (新規作成):
```typescript
import { useState } from "react";
import { ConnectWallet, useAddress } from "@thirdweb-dev/react";

export function ConnectWalletModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const address = useAddress();

  // 接続済みの場合は閉じる
  if (address) {
    onClose();
    return null;
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="connect-wallet-modal">
        {/* ヘッダー */}
        <div className="modal-header">
          <h2>🎁 Gifterra へようこそ</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* メイン接続方法 */}
        <div className="primary-connection">
          <h3>簡単にログイン</h3>

          {/* メール/SNSログイン（スマートウォレット） */}
          <ConnectWallet
            theme="dark"
            modalTitle="ログイン方法を選択"
            modalSize="wide"
            className="connect-button primary"
          />

          <p className="benefit">
            ✨ ガス代無料
            ✨ メールで簡単
            ✨ 安全・非カストディアル
          </p>
        </div>

        {/* 区切り線 */}
        <div className="divider">または</div>

        {/* 上級者向け */}
        <button
          className="advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "▲" : "▼"} 外部ウォレットで接続（上級者向け）
        </button>

        {showAdvanced && (
          <div className="advanced-section">
            <p className="note">
              💡 外部ウォレットに直接接続します。
              ガス代は自己負担となります。
            </p>
            {/* ここに外部ウォレット一覧 */}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 📦 Phase 2: ユーザープロフィール実装

### 2.1 ルーティングの追加

**src/App.tsx** (ルート追加):
```typescript
import { UserProfile } from "./pages/UserProfile";
import { MyProfile } from "./pages/MyProfile";
import { Leaderboard } from "./pages/Leaderboard";

<Routes>
  {/* 既存のルート */}
  <Route path="/tip/:address" element={<TipUI />} />
  <Route path="/reward/:address" element={<RewardUI />} />
  <Route path="/vending/:hubId" element={<VendingUI />} />
  <Route path="/admin" element={<AdminDashboard />} />

  {/* 新規: ユーザープロフィール */}
  <Route path="/user/:address" element={<UserProfile />} />
  <Route path="/me" element={<MyProfile />} />
  <Route path="/leaderboard" element={<Leaderboard />} />
</Routes>
```

### 2.2 データ構造の設計

**src/types/user.ts** (新規作成):
```typescript
export interface UserProfile {
  address: string;
  ensName?: string;

  // ランク・貢献度
  rank: {
    current: string;        // 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'
    points: number;         // 貢献度ポイント
    nextRank?: string;      // 次のランク
    pointsToNext?: number;  // 次のランクまで
  };

  // SBT統計
  sbt: {
    totalCount: number;     // 総SBT数
    tokenIds: bigint[];     // 保有トークンID
  };

  // 活動統計
  stats: {
    totalTips: string;          // 総投げ銭額（wei）
    totalPurchases: number;     // 購入回数
    rewardsReceived: number;    // Reward獲得数
    firstActivity: Date;        // 初回活動日
    lastActivity: Date;         // 最終活動日
  };
}

export interface Activity {
  id: string;
  type: 'tip' | 'purchase' | 'reward' | 'rank_up';
  timestamp: Date;
  details: {
    amount?: string;      // 金額（wei）
    tokenId?: string;     // トークンID
    to?: string;          // 送信先アドレス
    from?: string;        // 送信元アドレス
    description: string;  // 説明文
  };
}
```

### 2.3 データ取得フック

**src/hooks/useUserProfile.ts** (新規作成):
```typescript
import { useContract, useContractRead, useAddress } from "@thirdweb-dev/react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { useQuery } from "@tanstack/react-query";
import type { UserProfile } from "../types/user";

export function useUserProfile(targetAddress?: string) {
  const connectedAddress = useAddress();
  const address = targetAddress || connectedAddress;

  const { contract } = useContract(CONTRACT_ADDRESS, CONTRACT_ABI);

  // ランク取得
  const { data: rankData } = useContractRead(
    contract,
    "getUserRank",
    [address]
  );

  // 貢献度取得
  const { data: contribution } = useContractRead(
    contract,
    "getTotalContribution",
    [address]
  );

  // SBT一覧取得
  const { data: sbtTokens } = useContractRead(
    contract,
    "tokensOfOwner",
    [address]
  );

  // Supabaseから購入履歴等を取得
  const { data: activities } = useQuery(
    ["activities", address],
    () => fetchUserActivities(address),
    { enabled: !!address }
  );

  // プロフィールデータの統合
  const profile: UserProfile = {
    address: address || "",
    rank: {
      current: rankData?.name || "Bronze",
      points: Number(contribution || 0),
    },
    sbt: {
      totalCount: sbtTokens?.length || 0,
      tokenIds: sbtTokens || [],
    },
    stats: {
      totalTips: "0", // activitiesから計算
      totalPurchases: 0, // activitiesから計算
      rewardsReceived: 0, // activitiesから計算
      firstActivity: new Date(),
      lastActivity: new Date(),
    },
  };

  return {
    profile,
    activities,
    isLoading: !rankData && !contribution,
  };
}
```

### 2.4 ユーザープロフィールページ

**src/pages/UserProfile.tsx** (新規作成):
```typescript
import { useParams } from "react-router-dom";
import { useUserProfile } from "../hooks/useUserProfile";
import { UserHeader } from "../components/profile/UserHeader";
import { StatsCards } from "../components/profile/StatsCards";
import { SBTGallery } from "../components/profile/SBTGallery";
import { ActivityFeed } from "../components/profile/ActivityFeed";
import { ShareProfile } from "../components/profile/ShareProfile";

export function UserProfile() {
  const { address } = useParams<{ address: string }>();
  const { profile, activities, isLoading } = useUserProfile(address);

  if (isLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  return (
    <div className="user-profile-page">
      {/* ヘッダー: アドレス、ランク、貢献度 */}
      <UserHeader profile={profile} />

      {/* 統計カード */}
      <StatsCards stats={profile.stats} />

      {/* SBTギャラリー */}
      <SBTGallery tokens={profile.sbt.tokenIds} />

      {/* アクティビティフィード */}
      <ActivityFeed activities={activities} />

      {/* シェアボタン */}
      <ShareProfile profile={profile} />
    </div>
  );
}
```

### 2.5 コンポーネント実装

#### UserHeader コンポーネント

**src/components/profile/UserHeader.tsx**:
```typescript
import { UserProfile } from "../../types/user";
import { getRankBadge, getRankColor } from "../../utils/ranks";

export function UserHeader({ profile }: { profile: UserProfile }) {
  return (
    <div className="user-header">
      {/* プロフィール画像（ENS Avatar or Jazzicon） */}
      <div className="avatar">
        {/* TODO: ENS Avatar連携 */}
      </div>

      {/* アドレス表示 */}
      <div className="address-section">
        <h1>{profile.ensName || `${profile.address.slice(0, 6)}...${profile.address.slice(-4)}`}</h1>
        <p className="address-full">{profile.address}</p>
      </div>

      {/* ランクバッジ */}
      <div
        className="rank-badge"
        style={{
          background: getRankColor(profile.rank.current),
        }}
      >
        {getRankBadge(profile.rank.current)} {profile.rank.current}
      </div>

      {/* 貢献度 */}
      <div className="contribution">
        <p className="label">貢献度</p>
        <p className="value">{profile.rank.points.toLocaleString()} pt</p>

        {profile.rank.nextRank && (
          <p className="next-rank">
            次のランク（{profile.rank.nextRank}）まで: {profile.rank.pointsToNext} pt
          </p>
        )}
      </div>
    </div>
  );
}
```

#### StatsCards コンポーネント

**src/components/profile/StatsCards.tsx**:
```typescript
import { formatTokenAmount } from "../../config/tokens";

export function StatsCards({ stats }: { stats: UserProfile['stats'] }) {
  return (
    <div className="stats-cards">
      <div className="stat-card">
        <div className="icon">💸</div>
        <div className="value">{formatTokenAmount(stats.totalTips, 'JPYC')}</div>
        <div className="label">総投げ銭額</div>
      </div>

      <div className="stat-card">
        <div className="icon">🛒</div>
        <div className="value">{stats.totalPurchases}</div>
        <div className="label">購入回数</div>
      </div>

      <div className="stat-card">
        <div className="icon">🎁</div>
        <div className="value">{stats.rewardsReceived}</div>
        <div className="label">Reward獲得</div>
      </div>

      <div className="stat-card">
        <div className="icon">📅</div>
        <div className="value">
          {Math.floor((Date.now() - stats.firstActivity.getTime()) / (1000 * 60 * 60 * 24))}日
        </div>
        <div className="label">アクティブ日数</div>
      </div>
    </div>
  );
}
```

### 2.6 SNSシェア機能

**src/components/profile/ShareProfile.tsx**:
```typescript
import { UserProfile } from "../../types/user";

export function ShareProfile({ profile }: { profile: UserProfile }) {
  const shareToTwitter = () => {
    const url = `${window.location.origin}/user/${profile.address}`;
    const text = `🎉 Gifterra で ${profile.rank.current} ランク達成！

💸 総投げ銭: ${formatTokenAmount(profile.stats.totalTips, 'JPYC')}
🏆 貢献度: ${profile.rank.points.toLocaleString()} pt
📊 SBT: ${profile.sbt.totalCount}個

あなたも参加しよう！
${url}

#Gifterra #JPYC #Web3`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  };

  return (
    <div className="share-section">
      <h3>プロフィールをシェア</h3>
      <button onClick={shareToTwitter} className="share-button twitter">
        🐦 Twitterでシェア
      </button>
    </div>
  );
}
```

---

## 📦 Phase 3: 統合とテスト

### 3.1 既存コンポーネントへの統合

**各UIコンポーネントにプロフィールリンクを追加**:

```typescript
// src/tip-ui/App.tsx
import { Link } from "react-router-dom";

// トランザクション成功後
<div className="success-message">
  <p>投げ銭が完了しました！</p>
  <Link to={`/user/${address}`}>
    あなたのプロフィールを見る →
  </Link>
</div>
```

### 3.2 ナビゲーションの更新

**src/components/Navigation.tsx** (新規または既存):
```typescript
export function Navigation() {
  const address = useAddress();

  return (
    <nav>
      <Link to="/">ホーム</Link>
      <Link to="/vending">GIFT HUB</Link>
      {address && (
        <>
          <Link to="/me">マイページ</Link>
          <Link to="/leaderboard">ランキング</Link>
        </>
      )}
      <ConnectWallet />
    </nav>
  );
}
```

---

## 🧪 テスト計画

### フェーズ1: ローカルテスト

```bash
# 開発サーバー起動
pnpm dev

# テスト項目
✅ メールログインでスマートウォレット作成
✅ MetaMaskでスマートウォレット経由接続
✅ 外部ウォレット直接接続
✅ ガススポンサーシップ動作確認
✅ ユーザープロフィール表示
✅ アクティビティ履歴表示
✅ SNSシェア機能
```

### フェーズ2: テストネットデプロイ

```bash
# ビルド
pnpm build

# Vercelにデプロイ
vercel --prod

# テスト項目
✅ Polygon Amoyでの動作確認
✅ 複数ウォレットでの接続テスト
✅ ガス代計測
✅ プロフィールページのパフォーマンス
✅ モバイル対応確認
```

### フェーズ3: β版テスト

```
対象: 5-10人の協力者
期間: 1週間

テスト内容:
- 新規ユーザー体験
- 既存ウォレットからの移行
- プロフィール共有
- フィードバック収集
```

---

## 📊 実装スケジュール

### Week 1: ハイブリッドウォレット

| Day | タスク | 担当 | ステータス |
|-----|-------|------|-----------|
| 1-2 | 依存関係確認・環境変数設定 | Dev | ⬜ |
| 3-4 | ウォレット設定ファイル作成 | Dev | ⬜ |
| 5-6 | カスタムUI実装 | Dev | ⬜ |
| 7 | ローカルテスト | Dev | ⬜ |

### Week 2: ユーザープロフィール

| Day | タスク | 担当 | ステータス |
|-----|-------|------|-----------|
| 1-2 | データ構造設計・フック実装 | Dev | ⬜ |
| 3-4 | プロフィールページUI | Dev | ⬜ |
| 5-6 | コンポーネント実装 | Dev | ⬜ |
| 7 | 統合・テスト | Dev | ⬜ |

### Week 3: 統合テスト・デプロイ

| Day | タスク | 担当 | ステータス |
|-----|-------|------|-----------|
| 1-2 | テストネットデプロイ | Dev | ⬜ |
| 3-4 | β版テスト | All | ⬜ |
| 5-6 | フィードバック反映 | Dev | ⬜ |
| 7 | 最終確認 | All | ⬜ |

---

## 💰 コスト試算

### 開発コスト

- 実装時間: 2-3週間
- 人件費: （プロジェクトによる）

### 運用コスト（月間1000 MAU想定）

| 項目 | コスト |
|------|--------|
| thirdweb Embedded Wallet | $0-99/月（無料枠内） |
| ガススポンサーシップ | $30-60/月 |
| Supabase（プロフィールデータ） | $0-25/月 |
| **合計** | **$30-184/月** |

### ROI（投資対効果）

```
コスト: ~$100/月
効果:
- ユーザー獲得率: 8倍
- エンゲージメント: 5倍
- SNSバイラル: 無限大

→ 圧倒的にプラス
```

---

## 🚨 リスクと対策

### リスク1: thirdweb依存

**リスク**: thirdwebにサービスが依存
**対策**:
- 外部ウォレット接続は常に維持
- データは自前のSupabaseにも保存
- 秘密鍵エクスポート機能を提供

### リスク2: ガスコスト

**リスク**: スポンサーシップのコストが予想以上
**対策**:
- 上限設定
- スポンサーシップルールの動的調整
- 使用状況のモニタリング

### リスク3: UX複雑化

**リスク**: 選択肢が多すぎて混乱
**対策**:
- デフォルトを明確に
- 初心者向けを前面に
- 上級者向けは折りたたみ

---

## 📚 参考資料

### thirdweb公式ドキュメント

- Smart Wallet: https://portal.thirdweb.com/wallets/smart-wallet
- Embedded Wallet: https://portal.thirdweb.com/wallets/embedded-wallet
- Gasless Transactions: https://portal.thirdweb.com/glossary/gasless-transactions

### Gifterra内部ドキュメント

- [JPYC Integration Guide](./JPYC-INTEGRATION-GUIDE.md)
- [Token Configuration](../src/config/tokens.ts)
- [Contract ABI](../src/contract.ts)

---

## 🎯 成功指標

### 技術指標

- [ ] メールログイン成功率: 95%以上
- [ ] ガススポンサーシップ成功率: 99%以上
- [ ] ページロード時間: 2秒以内
- [ ] モバイル対応: 完全対応

### ビジネス指標

- [ ] 新規登録完了率: 70%以上
- [ ] プロフィールページ訪問率: 50%以上
- [ ] SNSシェア率: 20%以上
- [ ] 7日間リテンション率: 40%以上

---

## 🚀 次のステップ

1. **即座に開始**: 依存関係の確認とインストール
2. **並行作業**: ウォレット実装とプロフィール実装を分離
3. **早期テスト**: 1週間ごとにテストネットデプロイ
4. **βテスト**: 実際のユーザーからフィードバック
5. **本番リリース**: JPYC発行日に合わせて

---

**🎉 準備完了！実装を開始しましょう！**
