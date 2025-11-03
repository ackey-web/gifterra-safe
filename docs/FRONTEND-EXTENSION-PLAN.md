# フロントエンド拡張計画

**ファクトリー化・可変ランクシステム対応**

---

## 必要な拡張機能

### 1. スーパーアドミン管理画面

**対象ユーザー**: 運営（あなた）

#### 機能一覧

##### 1.1 Factory 管理
- [ ] Factory デプロイ
- [ ] デプロイ手数料変更
- [ ] 手数料受取人変更
- [ ] 累計手数料確認・引き出し

##### 1.2 テナント管理
- [ ] テナント作成フォーム
  - 店舗名入力
  - 管理者アドレス入力
  - 報酬トークンアドレス入力
  - 投げ銭受取ウォレット入力
  - 手数料支払い（VALUE設定）
- [ ] 全テナント一覧表示
- [ ] テナント詳細表示
  - 5つのコントラクトアドレス
  - 作成日時
  - ステータス（Active/Paused）
- [ ] テナント停止/再開
- [ ] テナント無効化
- [ ] テナント管理者変更

##### 1.3 統計ダッシュボード
- [ ] 総テナント数
- [ ] アクティブテナント数
- [ ] 累計手数料収入
- [ ] 現在のデプロイ手数料
- [ ] テナント作成履歴グラフ

**実装場所**: `src/admin/SuperAdmin.tsx`（新規作成）

---

### 2. テナントアドミン管理画面

**対象ユーザー**: 各店舗の管理者

#### 機能一覧

##### 2.1 ランク設定（可変式）
- [ ] ランク数変更（1〜20段階）
- [ ] 各ランクの閾値設定
  - ランク1: XXX トークン
  - ランク2: XXX トークン
  - ...
- [ ] 各ランクのNFT URI設定
  - アップロード機能
  - IPFS統合
- [ ] 現在のランク設定確認
  - getAllRankThresholds() 呼び出し
  - 表形式で表示

##### 2.2 SBT設定
- [ ] デイリーリワード額変更
- [ ] 報酬トークン変更
- [ ] 投げ銭受取ウォレット変更

##### 2.3 RewardNFT_v2 設定
- [ ] SKU登録フォーム
  - SKU名入力
  - メタデータURI入力
  - 最大供給量設定
- [ ] 登録済みSKU一覧
- [ ] SKU削除

##### 2.4 RandomRewardEngine 設定
- [ ] 確率テーブル設定
  - デイリーリワード各ランク別
  - マイルストーン各ランク別
  - 手動ガチャ各ランク別
- [ ] 報酬額設定（トークン・NFT）
- [ ] マイルストーン追加/削除
- [ ] オペレーターロール付与

##### 2.5 JourneyPass 設定
- [ ] フラグ管理
  - フラグ説明設定
  - フラグ状態確認

**実装場所**:
- `src/admin/TenantAdmin.tsx`（新規作成）
- `src/admin/components/RankSettings.tsx`（新規作成）

---

### 3. Factory統合（テナント作成）

#### 3.1 コントラクト接続管理

現在のアーキテクチャを確認：

```typescript
// 現在（単一コントラクト）
const gifterra = useContract("0xDeployed...");

// 変更後（Factory経由）
const factory = useContract("0xFactory...");
const tenantInfo = await factory.getTenantInfo(tenantId);

// 各コントラクトに接続
const gifterra = useContract(tenantInfo.contracts.gifterra);
const rewardNFT = useContract(tenantInfo.contracts.rewardNFT);
```

#### 3.2 必要な変更

##### コンテキスト作成
```typescript
// src/contexts/TenantContext.tsx（新規）
interface TenantContextType {
  tenantId: number;
  contracts: {
    gifterra: string;
    rewardNFT: string;
    payLitter: string;
    journeyPass: string;
    randomRewardEngine: string;
  };
  isLoading: boolean;
  error: Error | null;
}
```

##### 環境変数更新
```bash
# .env
VITE_FACTORY_ADDRESS=0x...
VITE_TENANT_ID=1  # または動的に取得
```

---

### 4. UI/UX改善

#### 4.1 ロール判定
```typescript
// src/hooks/useRole.ts（新規）
function useRole() {
  const { address } = useAccount();
  const factory = useContract(FACTORY_ADDRESS);

  const [role, setRole] = useState<'superAdmin' | 'tenantAdmin' | 'user'>();

  useEffect(() => {
    // SUPER_ADMIN_ROLE をチェック
    // adminToTenantId をチェック
  }, [address]);

  return { role, isSuperAdmin, isTenantAdmin };
}
```

#### 4.2 ダッシュボード切り替え
```typescript
// src/admin/Dashboard.tsx
function Dashboard() {
  const { role } = useRole();

  if (role === 'superAdmin') {
    return <SuperAdminDashboard />;
  } else if (role === 'tenantAdmin') {
    return <TenantAdminDashboard />;
  } else {
    return <Navigate to="/" />;
  }
}
```

---

## 実装優先順位

### Phase 1: コア機能（必須）
1. ✅ Factory デプロイ（Remix）
2. [ ] テナント作成UI（スーパーアドミン）
3. [ ] 可変ランク設定UI（テナントアドミン）
4. [ ] コントラクト接続管理（TenantContext）

### Phase 2: 管理機能
5. [ ] テナント一覧・詳細表示
6. [ ] ランク設定フォーム
7. [ ] SKU登録フォーム
8. [ ] RandomRewardEngine設定

### Phase 3: 拡張機能
9. [ ] 統計ダッシュボード
10. [ ] IPFS統合（NFT URI）
11. [ ] テナント検索・フィルター
12. [ ] 通知システム

---

## 技術スタック

### 既存
- React + TypeScript
- Vite
- Thirdweb SDK
- ethers.js v5
- viem v2
- Tailwind CSS

### 追加検討
- [ ] React Hook Form（フォーム管理）
- [ ] Zod（バリデーション）
- [ ] React Query（データフェッチング）
- [ ] Zustand（状態管理）

---

## ファイル構成（案）

```
src/
├── admin/
│   ├── Dashboard.tsx（既存 - 改修）
│   ├── SuperAdmin.tsx（新規）
│   │   ├── FactoryManagement.tsx
│   │   ├── TenantList.tsx
│   │   ├── TenantDetail.tsx
│   │   └── Statistics.tsx
│   │
│   ├── TenantAdmin.tsx（新規）
│   │   ├── RankSettings.tsx
│   │   ├── RewardNFTSettings.tsx
│   │   ├── RandomEngineSettings.tsx
│   │   └── JourneyPassSettings.tsx
│   │
│   └── components/
│       ├── RankTable.tsx
│       ├── ThresholdInput.tsx
│       ├── SKUForm.tsx
│       └── ProbabilityTable.tsx
│
├── contexts/
│   ├── TenantContext.tsx（新規）
│   └── RoleContext.tsx（新規）
│
├── hooks/
│   ├── useFactory.ts（新規）
│   ├── useTenant.ts（新規）
│   ├── useRole.ts（新規）
│   └── useGifterra.ts（既存 - 改修）
│
├── types/
│   ├── factory.ts（新規）
│   └── tenant.ts（新規）
│
└── utils/
    ├── contractAddresses.ts（改修）
    └── roleChecker.ts（新規）
```

---

## API設計（コントラクト呼び出し）

### Factory操作

```typescript
// テナント作成
const tx = await factory.createTenant(
  tenantName,
  admin,
  rewardTokenAddress,
  tipWalletAddress,
  { value: deploymentFee }
);

// テナント情報取得
const tenantInfo = await factory.getTenantInfo(tenantId);

// 全テナント一覧
const tenantList = await factory.getTenantList(0, 10); // offset, limit

// 統計情報
const stats = await factory.getGlobalStats();
```

### Gifterra操作（可変ランク）

```typescript
// ランク数変更
await gifterra.setMaxRankLevel(6);

// 閾値設定
await gifterra.setRankThreshold(1, ethers.parseEther("1000"));

// NFT URI設定
await gifterra.setNFTRankUri(1, "ipfs://Qm.../bronze.json");

// 全ランク閾値取得
const thresholds = await gifterra.getAllRankThresholds();
// 結果: [1000, 5000, 10000, 50000, 100000, 500000]
```

---

## テスト計画

### 1. 単体テスト（Remix VM）
- Factory デプロイ
- createTenant 実行
- setMaxRankLevel 実行
- setRankThreshold 実行

### 2. 統合テスト（Hardhat Local）
- Factory → Tenant作成 → UI接続
- ランク設定 → UI反映確認
- ロール判定動作確認

### 3. E2Eテスト（Polygon Amoy）
- 実際のテナント作成
- フロントエンドから全機能操作
- トランザクション確認

---

## 開発スケジュール（目安）

| Phase | 作業内容 | 所要時間 |
|-------|---------|---------|
| 1 | Hardhat セットアップ | 0.5日 |
| 2 | TenantContext 実装 | 1日 |
| 3 | 可変ランク設定UI | 2日 |
| 4 | テナント作成UI | 1.5日 |
| 5 | スーパーアドミンダッシュボード | 2日 |
| 6 | テナントアドミンダッシュボード | 2日 |
| 7 | 統合テスト | 1日 |
| **合計** | | **10日** |

---

## 次のステップ

1. ✅ Hardhat セットアップ完了
2. ⏭️ フロントエンド拡張開始
3. ⏭️ Hardhat ローカルノードでテスト
4. ⏭️ Polygon Amoy デプロイ

---

**最終更新**: 2025-01-26
