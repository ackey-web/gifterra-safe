# テナントアクセス制御実装ドキュメント

**実装日**: 2025-01-21
**バージョン**: v1.0.0

---

## 📋 概要

テナント申請・承認フローに基づくアクセス制御を実装しました。

### アクセスポリシー

```
┌─────────────────────────────────────────────────────────────┐
│                    ユーザー分類                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ METATRON Owner (0x66F1274aD5d042b7571C2EfA943370dbcd3459aB) │
│     ✅ デフォルトテナントへのアクセス可能                        │
│     ✅ スーパーアドミン権限                                     │
│     ✅ 全テナントの管理                                        │
│                                                             │
│  2️⃣ 承認済みテナントオーナー                                   │
│     ✅ 自分のテナントへのアクセス可能                           │
│     ❌ デフォルトテナントへのアクセス不可                       │
│     ✅ 自分のコントラクトのみ管理                              │
│                                                             │
│  3️⃣ 一般ユーザー (テナント申請なし or 未承認)                  │
│     ❌ いかなるテナントへのアクセスも不可                       │
│     ✅ マイページでの報酬受取のみ可能                          │
│     ✅ テナント申請の送信可能                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 実装内容

### 1. TenantContext の改修

**ファイル**: `src/admin/contexts/TenantContext.tsx`

#### 追加された機能

1. **テナント申請情報の取得**
```typescript
const { application, loading: loadingApplication } = useMyTenantApplication();
```

2. **アクセス制御ロジック**
```typescript
// METATRON Ownerチェック
const isMETATRONOwner = finalAddress?.toLowerCase() === METATRON_OWNER.toLowerCase();

// 承認済みテナントチェック
const isApprovedTenant = application?.status === 'approved' && !!application?.gifterra_address;

// アクセス権判定
const hasAccess = isMETATRONOwner || isApprovedTenant;
```

3. **動的テナント設定**
```typescript
useEffect(() => {
  if (isMETATRONOwner) {
    // METATRON Owner → デフォルトテナント
    setTenant(DEFAULT_TENANT);
  } else if (isApprovedTenant && application) {
    // 承認済みテナント → 申請データからテナント作成
    setTenant({
      id: application.tenant_id,
      name: application.tenant_name,
      contracts: {
        gifterra: application.gifterra_address!,
        rewardEngine: application.random_reward_engine_address,
        flagNFT: application.flag_nft_address,
        rewardToken: application.custom_token_address || getDefaultToken().currentAddress,
        paymentSplitter: application.pay_splitter_address,
      },
    });
  } else {
    // アクセス権なし
    setTenant(null);
  }
}, [isMETATRONOwner, isApprovedTenant, application, loadingApplication]);
```

4. **型定義の拡張**
```typescript
export interface TenantContextType {
  tenant: TenantConfig | null;  // nullを許容
  hasAccess: boolean;  // アクセス権フラグ
  isMETATRONOwner: boolean;  // METATRON Ownerフラグ
  isApprovedTenant: boolean;  // 承認済みテナントフラグ
  // ... 既存のフィールド
}
```

---

### 2. RequireOwner コンポーネントの改修

**ファイル**: `src/admin/contexts/TenantContext.tsx`

#### 追加されたロジック

1. **申請情報の取得**
```typescript
const { application, loading: loadingApplication } = useMyTenantApplication();
```

2. **ローディング状態の統合**
```typescript
if (isCheckingOwner || loadingApplication) {
  return <LoadingScreen />;
}
```

3. **アクセス権に基づく画面分岐**
```typescript
if (!hasAccess) {
  // 申請中
  if (application?.status === 'pending') {
    return <PendingApprovalScreen application={application} />;
  }

  // 拒否済み
  if (application?.status === 'rejected') {
    return <RejectedApplicationScreen application={application} />;
  }

  // 未申請
  return <ApplicationPromptScreen />;
}
```

---

### 3. フォールバック画面コンポーネント

#### A. PendingApprovalScreen

**ファイル**: `src/admin/components/PendingApprovalScreen.tsx`

**表示内容**:
- 申請受付中のメッセージ
- 申請内容の詳細（テナント名、プラン、申請日時）
- プランの機能説明
- マイページへの誘導ボタン

**デザイン**: 青系のグラデーション、⏳アイコン

---

#### B. RejectedApplicationScreen

**ファイル**: `src/admin/components/RejectedApplicationScreen.tsx`

**表示内容**:
- 申請拒否のメッセージ
- 拒否理由の表示
- 申請内容の詳細
- サポートへの問い合わせボタン
- マイページへの誘導ボタン

**デザイン**: 赤系のグラデーション、❌アイコン

---

#### C. ApplicationPromptScreen

**ファイル**: `src/admin/components/ApplicationPromptScreen.tsx`

**表示内容**:
- テナント申請の案内
- 全プランの比較表（STUDIO / STUDIO_PRO / STUDIO_PRO_MAX）
- 申請フローの説明
- 申請開始ボタン（→ マイページへ誘導）

**デザイン**: 紫系のグラデーション、🏢アイコン

---

## 🔄 ユーザーフロー

### フローチャート

```
ユーザーが /admin にアクセス
          ↓
    ウォレット接続済み?
          ↓ No → ウォレット接続画面
          ↓ Yes
          ↓
  申請情報をチェック中...
          ↓
    アドレスチェック
          ↓
    ┌─────┴─────┐
    │             │
0x66F1...?    それ以外
    │             │
    Yes           ↓
    │        承認済みテナント?
    │             │
    │        ┌────┴────┐
    │        │         │
    │      Yes        No
    │        │         │
    │        │    ┌────┴────┐
    │        │    │         │
    │        │  pending  rejected or 未申請
    │        │    │         │
    ↓        ↓    ↓         ↓
 DEFAULT   自分の  申請中    申請促進
 TENANT   TENANT  画面      画面
    │        │    │         │
    └────┬───┘    │         │
         ↓        ↓         ↓
      管理画面  待機画面   申請フォーム
                           へ誘導
```

---

## 📂 変更ファイル一覧

### 既存ファイルの変更

1. **src/admin/contexts/TenantContext.tsx**
   - `useMyTenantApplication` フックのインポート追加
   - `METATRON_OWNER` 定数の定義
   - テナント決定ロジックの実装
   - `hasAccess`, `isMETATRONOwner`, `isApprovedTenant` フラグの追加
   - `RequireOwner` コンポーネントの改修

### 新規ファイル

2. **src/admin/components/PendingApprovalScreen.tsx**
   - 申請承認待ち画面コンポーネント

3. **src/admin/components/RejectedApplicationScreen.tsx**
   - 申請拒否画面コンポーネント

4. **src/admin/components/ApplicationPromptScreen.tsx**
   - 未申請ユーザー向け申請促進画面コンポーネント

---

## ✅ 動作確認項目

### テストケース

#### 1. METATRON Owner (0x66F1274aD5d042b7571C2EfA943370dbcd3459aB)

- [ ] `/admin` にアクセスできる
- [ ] デフォルトテナントが自動設定される
- [ ] 既存のコントラクト (0x0174477A...) が使用される
- [ ] 全ての管理機能にアクセス可能

#### 2. 承認済みテナントオーナー

- [ ] `/admin` にアクセスできる
- [ ] 自分のテナントコントラクトが自動設定される
- [ ] 申請時のコントラクトアドレスが正しく読み込まれる
- [ ] 自分のテナントのみ管理可能

#### 3. 申請中ユーザー (status: pending)

- [ ] `/admin` にアクセスすると `PendingApprovalScreen` が表示される
- [ ] 申請内容（テナント名、プラン、申請日時）が表示される
- [ ] "マイページに戻る" ボタンが機能する

#### 4. 拒否されたユーザー (status: rejected)

- [ ] `/admin` にアクセスすると `RejectedApplicationScreen` が表示される
- [ ] 拒否理由が表示される
- [ ] 申請内容が表示される
- [ ] "マイページに戻る" ボタンが機能する
- [ ] "サポートに問い合わせ" ボタンが機能する

#### 5. 未申請ユーザー

- [ ] `/admin` にアクセスすると `ApplicationPromptScreen` が表示される
- [ ] 全プラン（STUDIO / STUDIO_PRO / STUDIO_PRO_MAX）が表示される
- [ ] "テナント申請を開始" ボタンでマイページに遷移する
- [ ] "マイページに戻る" ボタンが機能する

#### 6. ウォレット未接続

- [ ] `/admin` にアクセスするとウォレット接続画面が表示される
- [ ] MetaMask接続ボタンが機能する
- [ ] Privy（メール/SNS）ログインボタンが機能する

---

## 🔒 セキュリティ対策

### 実装済み対策

1. **アドレス検証**
   - すべてのアドレス比較で `.toLowerCase()` を使用
   - `METATRON_OWNER` は定数として厳密管理

2. **状態管理**
   - `tenant` が `null` の場合は適切にハンドリング
   - オプショナルチェーン (`?.`) でnullエラーを防止

3. **ローディング状態**
   - 申請情報のローディング中は権限チェックをスキップ
   - ローディング完了まで適切なローディング画面を表示

4. **フォールバック**
   - アクセス権がない場合は必ず適切な画面を表示
   - 予期しない状態では管理画面にアクセスさせない

---

## 🚀 今後の拡張

### 考えられる追加機能

1. **テナント切り替え機能**
   - 1ユーザーが複数テナントを管理できる場合
   - テナントセレクターUIの実装

2. **申請状況の通知**
   - 承認/拒否時のメール通知
   - プッシュ通知の実装

3. **再申請機能**
   - 拒否されたユーザーが直接再申請できる機能
   - 拒否理由を踏まえた修正フォーム

4. **テナント情報の編集**
   - 承認後のテナント名変更
   - プランアップグレード機能

---

## 📞 サポート

実装に関する質問や問題が発生した場合:

1. このドキュメントを確認
2. デバッグログを確認（Consoleに詳細ログを出力）
3. テストケースで動作を確認

---

**最終更新**: 2025-01-21
**実装者**: Claude Code
