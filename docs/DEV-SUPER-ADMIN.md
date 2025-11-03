# 開発環境スーパーアドミン機能

## 概要

開発・テスト段階では運営側（METATRON）が全テナントのadmin画面にフルアクセスできるよう、環境に応じた権限切り替え機能を実装しました。

## 権限設計

### 開発環境（Development Mode）
```
運営アドレス（0x66f1274ad5d042b7571c2efa943370dbcd3459ab）
  └─ デバッグ用スーパーアドミン権限
     ├─ 全コントラクトにフルアクセス可能 ✅
     ├─ コントラクトのowner()チェックをバイパス
     └─ 全ての管理機能を利用可能
```

### 本番環境（Production Mode）
```
各テナントのオーナーアドレスのみ
  └─ 通常のオーナー権限
     ├─ 自社のコントラクトのみアクセス可能
     ├─ コントラクトのowner()で厳密にチェック
     └─ 他テナントのデータは完全に独立
```

## 実装詳細

### 環境判定

**開発環境の判定条件:**
```typescript
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
```

- `pnpm dev` で起動 → `DEV_MODE = true`
- `pnpm build` でビルド → `DEV_MODE = false`
- Vercel本番デプロイ → `DEV_MODE = false`

### スーパーアドミンアドレス

**src/admin/contexts/TenantContext.tsx:**
```typescript
const DEV_SUPER_ADMIN_ADDRESSES = [
  '0x66f1274ad5d042b7571c2efa943370dbcd3459ab', // METATRON管理者
  // 開発チームのアドレスを追加可能
];
```

### 権限チェックフロー

```typescript
const checkOwnership = async () => {
  // 1. 開発環境のスーパーアドミンチェック
  if (isDevSuperAdmin) {
    console.log('🔧 DEV MODE: Super Admin Access Granted', address);
    // 全コントラクトへのアクセス許可
    setOwnerStatus({
      gifterra: true,
      rewardEngine: true,
      flagNFT: true,
      rewardToken: true,
      tipManager: true,
    });
    return;
  }

  // 2. 通常のオーナー権限チェック（本番環境）
  // 各コントラクトのowner()を個別にチェック
  ...
};
```

## UI表示

### 開発環境でスーパーアドミンの場合

**ヘッダー表示:**
```
🔧 DEV MODE: Super Admin Access  ← 点滅アニメーション
テナント: METATRON Default
権限: 🔧 デバッグ管理者
コントラクト権限: 🎁 ⚙️ 🚩 🪙 💝  ← 全権限

⚠️ 開発環境モード：全コントラクトへのフルアクセスが許可されています。
   本番環境では無効化されます。
```

**コンソールログ:**
```
🔧 DEV MODE: Super Admin Access Granted 0x66f127...
```

### 本番環境の場合

**通常のオーナーチェック:**
```
テナント: [テナント名]
権限: ✅ オーナー  OR  ❌ 非オーナー
コントラクト権限: 🎁 🪙  ← 実際に保有している権限のみ
```

## 使い方

### 開発者の操作手順

1. **開発サーバー起動**
   ```bash
   pnpm dev
   ```

2. **運営ウォレットで接続**
   - アドレス: `0x66f1274ad5d042b7571c2efa943370dbcd3459ab`
   - MetaMask等で接続

3. **Admin画面にアクセス**
   - `/admin` にアクセス
   - スーパーアドミン権限で自動的にフルアクセス

4. **全機能をテスト**
   - ダッシュボード
   - REWARD管理
   - TIP管理
   - GIFT HUB管理
   - 商品管理
   - 診断ツール

### 本番デプロイ時

1. **ビルドとデプロイ**
   ```bash
   pnpm build
   # Vercelに自動デプロイ
   ```

2. **自動的に本番モードに切り替わる**
   - `DEV_MODE = false`
   - スーパーアドミン機能は無効化
   - 各テナントのオーナーのみアクセス可能

## セキュリティ

### 開発環境

- ✅ ローカル開発のみで使用
- ✅ テストネット（Polygon Amoy）で動作
- ✅ 実際の資産は関与しない

### 本番環境

- ✅ スーパーアドミン機能は完全に無効化
- ✅ コントラクトのowner()で厳密にチェック
- ✅ 各テナントは完全に独立
- ✅ 運営側でも他テナントのデータにアクセス不可

## 拡張方法

### 開発チームメンバーの追加

**TenantContext.tsx を編集:**
```typescript
const DEV_SUPER_ADMIN_ADDRESSES = [
  '0x66f1274ad5d042b7571c2efa943370dbcd3459ab', // METATRON管理者
  '0xYourAddressHere',                           // 開発者Aのアドレス
  '0xAnotherAddressHere',                        // 開発者Bのアドレス
];
```

### 本番環境でのスーパーアドミン追加（将来）

もし本番環境でも運営側のアクセスが必要になった場合:

1. **スマートコントラクトレベルで実装**
   - 各コントラクトに `SUPER_ADMIN_ROLE` を追加
   - AccessControl を使用した権限管理
   - ブロックチェーン上で検証可能

2. **フロントエンドの修正**
   ```typescript
   // 本番環境用のスーパーアドミンチェックを追加
   const PROD_SUPER_ADMIN_ADDRESSES = [
     '0x...' // 本番環境のスーパーアドミン
   ];

   const isProdSuperAdmin = !DEV_MODE && address ?
     PROD_SUPER_ADMIN_ADDRESSES.some(...) : false;
   ```

## トラブルシューティング

### スーパーアドミンが動作しない

**確認事項:**
1. 開発サーバーで起動しているか？
   ```bash
   pnpm dev  # ← これが必要
   ```

2. 正しいアドレスで接続しているか？
   - コンソールで確認: `🔧 DEV MODE: Super Admin Access Granted`

3. 環境変数は正しいか？
   ```bash
   import.meta.env.DEV === true
   import.meta.env.MODE === 'development'
   ```

### 本番環境で誤って有効になっている

**対処法:**
1. ビルドログを確認
   ```
   BUILD MODE: production
   DEV_MODE: false
   ```

2. ブラウザコンソールで確認
   - スーパーアドミンのログが出ていないこと

3. 再ビルド＆再デプロイ
   ```bash
   pnpm build
   vercel --prod
   ```

## まとめ

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| モード | `DEV_MODE = true` | `DEV_MODE = false` |
| 運営アドレス権限 | ✅ スーパーアドミン（全アクセス） | ❌ 通常ユーザー |
| オーナーチェック | バイパス | 厳密にチェック |
| テナント独立性 | デバッグ用に無効化 | 完全に独立 |
| セキュリティリスク | なし（テストネット） | なし（完全独立） |

この設計により、開発効率とセキュリティの両立を実現しています。
