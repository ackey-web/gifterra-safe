# Admin スコア管理システム 📊

## 概要

二軸スコアシステムの**スーパーアドミン専用**管理ダッシュボード。パラメータ調整、トークン分類、システム監視を一元管理します。

### アクセス権限

**⚠️ スーパーアドミン専用機能**

- **配置先**: `src/pages/SuperAdmin.tsx` （スーパーアドミンページ内）
- **アクセス**: `config/superAdmin.ts`で定義されたウォレットアドレスのみ
- **権限**: プラットフォーム全体のスコアパラメータとトークン軸を管理

**設計理由:**
- **公平性**: 全テナント共通のパラメータを一元管理し、ユーザーが一貫した評価基準で貢献度を測定できる
- **法務リスク管理**: トークン追加をスーパーアドミンが承認することで、資金決済法等のコンプライアンスを担保

## 管理画面一覧

### 1. スコアパラメータ管理 ⚙️

**ファイル**: `src/admin/score/ScoreParametersPage.tsx`

**機能**:
- **Economic Weight**: 金銭的貢献の重み設定（0-300 basis points）
- **Resonance Weight**: 継続的熱量の重み設定（0-300 basis points）
- **Curve Type**: Resonanceスコアに適用する曲線選択
  - Linear: `f(x) = x`
  - Sqrt: `f(x) = √x` （デフォルト）
  - Log: `f(x) = log₁₀(x+1)`
- **変更履歴**: パラメータ変更の履歴表示

**重要な注意事項**:
⚠️ パラメータ変更時、全ユーザーの合成スコアが再計算されます。ランキングが大きく変動する可能性があるため、慎重に変更してください。

**使用例**:
```tsx
import { ScoreParametersPage } from '@/admin/score';

// Admin画面に統合
<Route path="/admin/score/parameters" element={<ScoreParametersPage />} />
```

---

### 2. トークン軸設定 🔧

**ファイル**: `src/admin/score/TokenAxisPage.tsx`

**機能**:
- **トークン一覧**: 登録済みトークンの表示
- **軸の切り替え**: Economic ↔ Resonance をワンクリックで変更
- **新規トークン追加**:
  - トークンアドレス
  - シンボル（例: JPYC, NHT）
  - トークン名
  - Decimals（デフォルト: 18）
  - 初期軸設定
- **統計表示**:
  - Total Tokens
  - Economic軸トークン数
  - Resonance軸トークン数

**トークン分類の例**:

| トークン | シンボル | 軸 | 説明 |
|---------|---------|-----|------|
| JPYC | JPYC | 💸 Economic | 法定価値系（金銭的貢献） |
| USDC | USDC | 💸 Economic | ステーブルコイン |
| NHT | NHT | 🔥 Resonance | 応援系（継続的熱量） |
| MATIC | MATIC | 💸 Economic | ネイティブトークン |

**使用例**:
```tsx
import { TokenAxisPage } from '@/admin/score';

<Route path="/admin/score/tokens" element={<TokenAxisPage />} />
```

---

### 3. システムモニタリング 📊

**ファイル**: `src/admin/score/SystemMonitoringPage.tsx`

**機能**:
- **ステータス監視**:
  - Indexer Status（running/stopped/error）
  - API Status（healthy/unhealthy）
  - Last Updated（最終更新時刻）

- **統計情報**:
  - Total Users（総ユーザー数）
  - Total Transactions（総トランザクション数）
  - Last Processed Block（最終処理ブロック）

- **スコア分布**:
  - Economic平均・中央値
  - Resonance平均・中央値
  - Composite平均・中央値
  - 視覚的な分布バー

- **最近のアクティビティ**:
  - スコア更新
  - パラメータ変更
  - トークン追加
  - タイムスタンプ付きログ

- **自動更新**: 10秒ごとにリアルタイム更新（ON/OFF可能）

**使用例**:
```tsx
import { SystemMonitoringPage } from '@/admin/score';

<Route path="/admin/score/monitoring" element={<SystemMonitoringPage />} />
```

---

## 統合方法

### 既存Admin画面への統合

既存のAdmin画面に3つのページを追加します。

**1. ルーティング設定**

```tsx
// src/admin/Dashboard.tsx または App.tsx

import {
  ScoreParametersPage,
  TokenAxisPage,
  SystemMonitoringPage,
} from './score';

// ルーティング
<Routes>
  {/* 既存のAdmin routes */}

  {/* スコア管理 routes */}
  <Route path="/admin/score/parameters" element={<ScoreParametersPage />} />
  <Route path="/admin/score/tokens" element={<TokenAxisPage />} />
  <Route path="/admin/score/monitoring" element={<SystemMonitoringPage />} />
</Routes>
```

**2. サイドバーメニュー追加**

```tsx
// src/admin/components/AdminSidebar.tsx

const menuItems = [
  // 既存のメニュー
  { path: '/admin/dashboard', label: 'ダッシュボード', icon: '📊' },

  // スコア管理メニュー追加
  {
    label: 'スコア管理',
    icon: '🎯',
    children: [
      { path: '/admin/score/monitoring', label: 'モニタリング', icon: '📊' },
      { path: '/admin/score/parameters', label: 'パラメータ', icon: '⚙️' },
      { path: '/admin/score/tokens', label: 'トークン軸', icon: '🔧' },
    ],
  },
];
```

---

## API連携

すべてのAdmin画面は、スコアシステムAPIと連携します。

### 認証

Admin操作にはAPIキーが必要です：

```typescript
fetch('/api/admin/params', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ADMIN_API_KEY, // 必須
  },
  body: JSON.stringify({ ... }),
});
```

### エンドポイント

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/params` | 現在のパラメータ取得 |
| POST | `/api/admin/params` | パラメータ更新 |
| POST | `/api/admin/token-axis` | トークン軸設定 |
| GET | `/api/health` | システムヘルスチェック |

---

## セキュリティ

### 1. 認証・認可

- **Admin API Key**: 環境変数で管理
- **ホワイトリスト**: 許可されたウォレットアドレスのみアクセス可能
- **Role-Based Access**: Smart ContractのAccessControl使用

### 2. 操作ログ

すべてのAdmin操作は記録されます：
- 操作者アドレス
- 操作内容
- 変更前後の値
- タイムスタンプ

### 3. 確認ダイアログ

重要な操作（パラメータ変更等）には確認ダイアログを表示：
```
⚠️ 重要な注意事項
パラメータを変更すると、全ユーザーの合成スコアが再計算されます。
ランキングが大きく変動する可能性があるため、慎重に変更してください。
```

---

## パフォーマンス

### 最適化手法

1. **リアルタイム更新**: WebSocketまたは10秒ポーリング
2. **データキャッシング**: 頻繁に変更されないデータはキャッシュ
3. **バッチ処理**: パラメータ変更時のスコア再計算はバックグラウンド
4. **Progressive Loading**: 大量データは段階的に読み込み

---

## トラブルシューティング

### Indexerが停止している

```bash
# 1. ステータス確認
curl http://localhost:3001/api/health

# 2. ログ確認
docker logs gifterra-indexer

# 3. 再起動
docker restart gifterra-indexer
```

### パラメータ変更が反映されない

```bash
# 1. API接続確認
curl -X POST http://localhost:3001/api/admin/params \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"weightEconomic":100,"weightResonance":100,"curve":"Sqrt"}'

# 2. データベース確認
SELECT * FROM score_params ORDER BY last_updated DESC LIMIT 1;

# 3. スコア再計算を手動実行
pnpm run recalculate-scores
```

### トークンが追加できない

```bash
# 1. トークンアドレスの妥当性確認
# 必ず小文字で登録

# 2. 重複チェック
SELECT * FROM token_axes WHERE token = '0x...';

# 3. Smart Contract確認
# ScoreRegistry.sol の isEconomicToken mapping
```

---

## ベストプラクティス

### パラメータ調整

1. **小さな変更から**: 一度に10-20%程度の変更に留める
2. **テストネットで検証**: 本番前に必ずテストネット環境で確認
3. **ユーザー通知**: 大きな変更前にユーザーに告知
4. **変更履歴記録**: すべての変更を記録して追跡可能に

### トークン管理

1. **デフォルトはEconomic**: 不明なトークンは一旦Economic軸に
2. **定期的なレビュー**: 3ヶ月ごとにトークン分類を見直し
3. **コミュニティ意見**: 主要トークンの軸変更はコミュニティに相談

### モニタリング

1. **異常検知**: 急激なスコア変動を監視
2. **アラート設定**: Indexer停止時は即座に通知
3. **定期レポート**: 週次でシステム稼働レポート作成

---

## 今後の拡張

### Phase 6+

- [ ] **ダークモード対応**
- [ ] **グラフ・チャート強化**（Chart.js / Recharts）
- [ ] **エクスポート機能**（CSV, JSON）
- [ ] **バックアップ・リストア**
- [ ] **A/Bテスト機能**（異なるパラメータで効果測定）
- [ ] **通知システム**（Slack/Discord連携）

---

## ライセンス

MIT License

## サポート

質問や問題がある場合は、GitHubのIssuesで報告してください。
