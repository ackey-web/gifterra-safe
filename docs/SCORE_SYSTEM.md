# 二軸スコアシステム 📊

## 概要

Gifterraの二軸スコアシステムは、ユーザーの貢献を2つの独立した軸で評価するゲーミフィケーションシステムです。

### デプロイモデル

**⚠️ グローバル単一インスタンス設計**

- ScoreRegistryは**プラットフォーム全体で1つのみ**デプロイ
- 全テナント共通のスコアパラメータとトークン軸を管理
- スーパーアドミンが一元管理

**設計理由:**
- **公平性**: 複数テナントを応援するユーザーが一貫した評価基準で貢献度を測定できる
- **法務リスク管理**: トークン追加をスーパーアドミンが一元管理し、資金決済法等のコンプライアンスを担保
- **ユーザー体験**: 「Gifterraでの総合貢献度」という統一されたストーリー

### 軸の定義

- **💸 Economic軸（経済貢献）**: JPYC等の法定価値系トークンでの金銭的貢献
- **🔥 Resonance軸（共鳴熱量）**: NHT等の応援系トークンやアクション回数での継続的熱量
- **📊 Composite軸（合成スコア）**: 上記2軸を加重合成した総合評価

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     Blockchain Layer                         │
│  ┌──────────────────┐         ┌───────────────────────┐    │
│  │ ScoreRegistry    │◄────────│ GifterraPaySplitterV2 │    │
│  │ (Parameter Mgmt) │         │ (Hook Integration)    │    │
│  └────────┬─────────┘         └───────────────────────┘    │
│           │ emit ScoreIncremented                           │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Indexer Layer                            │
│  ┌──────────────────┐    ┌──────────────────────┐          │
│  │ Event Listener   │───►│ Score Database       │          │
│  │ (ethers.js)      │    │ (Supabase)           │          │
│  └──────────────────┘    └──────────┬───────────┘          │
│                                      │                       │
│                                      ▼                       │
│                          ┌───────────────────────┐          │
│                          │ Score Calculator      │          │
│                          │ (Pure Functions)      │          │
│                          └───────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ REST API (Express)                                    │  │
│  │  - GET /api/profile/:userId                          │  │
│  │  - GET /api/rankings/:axis                           │  │
│  │  - POST /api/admin/params                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer (Next Steps)                    │
│  - Dual-axis tank visualization                             │
│  - Three-tab ranking panel                                  │
│  - AI assistant "Gifty"                                     │
└─────────────────────────────────────────────────────────────┘
```

## セットアップ

### 1. Supabase設定

Supabaseプロジェクトでマイグレーションを実行:

```bash
# Supabase CLIの場合
supabase migration up

# または、Supabase Studioで直接実行
# supabase/migrations/20250128_score_system.sql をコピペ
```

### 2. 環境変数設定

`.env`ファイルを作成:

```bash
# Blockchain
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
SCORE_REGISTRY_ADDRESS=0x... # グローバルScoreRegistry（プラットフォーム全体で共有）
START_BLOCK=12345678 # スコアシステム開始ブロック

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API
API_PORT=3001
ADMIN_API_KEY=your-secret-admin-key

# Indexer
ENABLE_BACKFILL=true # 初回起動時のみtrue
BACKFILL_CHUNK_SIZE=10000
ENABLE_DAILY_SNAPSHOT=true
SNAPSHOT_CRON=00:00 # UTC
```

### 3. コントラクトデプロイ

```bash
# ScoreRegistryをデプロイ
pnpm hardhat run scripts/deploy-score-registry.ts --network polygon

# GifterraPaySplitterV2にScoreRegistryを設定
pnpm hardhat run scripts/set-score-registry.ts --network polygon

# トークン軸を設定
pnpm hardhat run scripts/configure-token-axes.ts --network polygon
```

### 4. インデクサ起動

```bash
# 依存関係インストール
pnpm install

# TypeScriptビルド
pnpm build

# インデクサ起動
pnpm start:indexer

# または開発モード
pnpm dev:indexer
```

## コントラクト仕様

### ScoreRegistry.sol

#### 主要機能

```solidity
// トークン軸を設定
function setTokenAxis(address token, bool isEconomic) external onlyRole(ADMIN_ROLE)

// スコアを記録（他のコントラクトから呼び出し）
function recordScore(
  address user,
  address token,
  uint256 amountRaw,
  bytes32 traceId
) external

// パラメータを更新
function updateScoreParams(
  uint256 weightEconomic,
  uint256 weightResonance,
  Curve curve
) external onlyRole(ADMIN_ROLE)
```

#### イベント

```solidity
event ScoreIncremented(
  address indexed user,
  address indexed token,
  uint256 amountRaw,
  bytes32 axis,
  bytes32 indexed traceId
);

event ScoreParamsUpdated(
  uint256 weightEconomic,
  uint256 weightResonance,
  Curve curve,
  uint256 timestamp
);

event TokenAxisUpdated(
  address indexed token,
  bool isEconomic,
  uint256 timestamp
);
```

## API仕様

### ユーザープロフィール

```bash
GET /api/profile/:userId
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "userId": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "economic": {
      "score": 1500000,
      "level": 45,
      "displayLevel": 45,
      "tokens": {
        "0x6ae...": "1000000000000000000000"
      }
    },
    "resonance": {
      "score": 250,
      "level": 25,
      "displayLevel": 25,
      "count": 230,
      "streak": 14,
      "longestStreak": 30,
      "lastDate": "2025-01-28T12:00:00Z",
      "actions": {
        "tips": 230,
        "purchases": 0,
        "claims": 0,
        "logins": 0
      }
    },
    "composite": {
      "score": 2250,
      "economicWeight": 100,
      "resonanceWeight": 100,
      "curve": "Sqrt",
      "formula": "100 * economic + 100 * sqrt(resonance)"
    },
    "lastUpdated": "2025-01-28T12:00:00Z"
  }
}
```

### ランキング取得

```bash
GET /api/rankings/:axis?limit=100&offset=0
```

**パラメータ:**
- `axis`: `economic` | `resonance` | `composite`
- `limit`: 取得件数（デフォルト: 100）
- `offset`: オフセット（デフォルト: 0）

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "axis": "COMPOSITE",
    "rankings": [
      {
        "rank": 1,
        "userId": "...",
        "address": "0x...",
        "displayName": "Alice",
        "avatar": "https://...",
        "economicScore": 5000000,
        "resonanceScore": 1000,
        "compositeScore": 8000,
        "economicLevel": 70,
        "resonanceLevel": 50,
        "badge": "🏆",
        "title": "Legend"
      }
    ],
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 1250,
      "hasMore": true
    }
  }
}
```

### Admin操作

#### パラメータ更新

```bash
POST /api/admin/params
Headers: x-api-key: YOUR_ADMIN_API_KEY
Content-Type: application/json

{
  "weightEconomic": 150,
  "weightResonance": 80,
  "curve": "Sqrt"
}
```

#### トークン軸設定

```bash
POST /api/admin/token-axis
Headers: x-api-key: YOUR_ADMIN_API_KEY
Content-Type: application/json

{
  "token": "0x6ae...",
  "isEconomic": true
}
```

## スコア計算ロジック

### Economic軸

```typescript
// 1. トークン別に累積
economicScore.tokens[token] += amountRaw

// 2. JPYC換算に正規化
normalized = sum(token amounts in JPYC)

// 3. レベル計算（平方根ベース）
level = min(100, floor(sqrt(jpycAmount) * 0.0001 * 100))
```

### Resonance軸（貢献熱量度 - kodomi）

```typescript
// 【案A: 回数のみカウント】
// 全トークン種別を同じ重み（1.0）で評価

// 1. トークン種別ごとの回数を累積
utilityTokenTips += 1  // tNHT等でのTIP
economicTokenTips += 1 // JPYC等でのTIP

// 2. 連続日数ボーナス
if (今日 === 昨日 + 1日) {
  streak += 1
} else {
  streak = 1
}

// 3. ベーススコア = 全回数の合計 + 連続ボーナス
baseScore = utilityTokenTips + economicTokenTips
bonus = floor(streak / 7) * 0.1
normalized = baseScore * (1 + bonus)

// 4. レベル計算（線形）
level = min(100, floor(normalized * 1.0))
```

**⚠️ 法務リスク回避の設計（案A）**
- JPYCはEconomic軸で「金額」として評価
- Resonance軸（kodomi）では「回数」のみカウント（全トークン同じ重み）
- 金額と回数を分離することで、tNHTに資産価値があると見なされるリスクを回避
- シンプルな回数ベースで公平性を担保

### Composite軸

```typescript
// 1. Resonanceに曲線を適用
rAdjusted = applyCurve(resonance.normalized, params.curve)

// 2. 加重合成
composite =
  (economic.normalized * params.weightEconomic / 100) +
  (rAdjusted * params.weightResonance / 100)
```

曲線の種類:
- **Linear**: `f(x) = x` （線形）
- **Sqrt**: `f(x) = √x` （平方根、デフォルト）
- **Log**: `f(x) = log₁₀(x + 1)` （対数）

## デプロイガイド

### 1. テストネットデプロイ

```bash
# 1. ScoreRegistryをデプロイ
pnpm hardhat run scripts/deploy-score-registry.ts --network mumbai

# 2. デプロイされたアドレスを.envに設定
SCORE_REGISTRY_ADDRESS=0x...

# 3. GifterraPaySplitterV2に設定
pnpm hardhat run scripts/set-score-registry.ts --network mumbai

# 4. トークン軸を設定
pnpm hardhat run scripts/configure-token-axes.ts --network mumbai

# 5. テストデータ投入
pnpm hardhat run scripts/test-score-system.ts --network mumbai
```

### 2. インデクサデプロイ

```bash
# 1. Dockerイメージビルド
docker build -t gifterra-indexer -f Dockerfile.indexer .

# 2. コンテナ起動
docker run -d \
  --name gifterra-indexer \
  --env-file .env \
  -p 3001:3001 \
  gifterra-indexer

# 3. ログ確認
docker logs -f gifterra-indexer
```

### 3. メインネットデプロイ

```bash
# ⚠️ 本番環境は慎重に！

# 1. コントラクトをメインネットにデプロイ
pnpm hardhat run scripts/deploy-score-registry.ts --network polygon

# 2. 初期パラメータを設定
pnpm hardhat run scripts/initialize-mainnet.ts --network polygon

# 3. インデクサを本番モードで起動
NODE_ENV=production pnpm start:indexer
```

## トラブルシューティング

### インデクサが起動しない

```bash
# 1. 環境変数を確認
echo $SCORE_REGISTRY_ADDRESS
echo $SUPABASE_URL

# 2. RPCエンドポイントをテスト
curl $RPC_URL -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# 3. Supabase接続をテスト
psql $DATABASE_URL -c "SELECT * FROM user_scores LIMIT 1;"
```

### イベントが処理されない

```bash
# 1. ブロック範囲を確認
# Polygonscanでトランザクションを確認

# 2. バックフィルを再実行
ENABLE_BACKFILL=true START_BLOCK=12345678 pnpm start:indexer

# 3. ログを詳細モードで確認
LOG_LEVEL=debug pnpm start:indexer
```

### スコアが合わない

```bash
# 1. トークン軸設定を確認
curl http://localhost:3001/api/admin/params \
  -H "x-api-key: $ADMIN_API_KEY"

# 2. 手動でスコアを再計算
pnpm hardhat run scripts/recalculate-scores.ts

# 3. データベースを確認
SELECT * FROM score_transactions WHERE user_address = '0x...' ORDER BY timestamp DESC;
```

## パフォーマンス最適化

### インデクサ

- **バックフィルチャンクサイズ**: デフォルト10,000ブロック（RPCプロバイダーのレート制限に応じて調整）
- **並行処理**: イベントハンドラーは順次処理（データ整合性のため）
- **キャッシング**: Supabaseのクエリ結果をRedisでキャッシュ（TODO）

### API

- **ページネーション**: ランキングは最大1000件まで
- **レスポンス圧縮**: gzip有効化推奨
- **CDN**: 静的ランキングはCloudflare CDN経由で配信（TODO）

### データベース

- **インデックス**: 全主要カラムにインデックス作成済み
- **パーティショニング**: トランザクションログは月次パーティション（TODO）
- **アーカイブ**: 90日以上前のログは別テーブルに移動（TODO）

## 次のステップ

### Phase 3: UI実装

- [ ] 二軸タンクコンポーネント
- [ ] 三つ葉ランキングパネル
- [ ] テナントカード with スコア表示
- [ ] バッジ・実績システム

### Phase 4: AI統合

- [ ] OpenAI GPT-4統合
- [ ] バランス分析アルゴリズム
- [ ] パーソナライズド提案

### Phase 5: Admin UI

- [ ] パラメータ管理画面
- [ ] トークン軸設定画面
- [ ] システムモニタリング

## ライセンス

MIT License

## サポート

質問や問題がある場合は、GitHubのIssuesで報告してください。
