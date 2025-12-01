# 商品トークン制約機能 - 導入ガイド

## 概要

NHT HUBとJPYC HUBで同一商品が登録されることを防ぐための制約機能です。

### 目的
- **法的リスク軽減**: NHTの資産価値誤認を防ぐ
- **規制対応**: 電子決済手段（JPYC）とユーティリティトークン（NHT）の明確な分離
- **運用ルール徹底**: テナントオーナーに各HUB専用商品設定を強制

---

## 実装内容

### 1. データベース制約（バックエンド）

**ファイル**: `20250301000002_add_product_token_constraints.sql`

#### 追加される機能:
- ✅ `products.accepted_token` カラム追加（NHT or JPYC）
- ✅ HUBのトークンと商品のトークンが一致するかチェックするトリガー
- ✅ 商品登録時に自動的にHUBのトークンを設定
- ✅ 異なるトークン種別のHUBに同一商品を登録しようとするとエラー
- ✅ 重複商品検出用ビュー（`v_product_token_conflicts`）

### 2. フロントエンド制約

**ファイル**:
- `src/hooks/useProductTokenCheck.ts` - 重複チェックフック
- `src/admin/vending/components/HubDetailPanelNew.tsx` - 商品登録画面統合

#### 機能:
- ✅ 商品登録・編集時にリアルタイムで重複チェック
- ✅ 異なるトークン種別のHUBで同一商品が見つかった場合は警告表示
- ✅ 登録をブロック

---

## マイグレーション実行手順

### Step 1: Supabase SQL Editorでマイグレーション実行

1. Supabase Dashboard → SQL Editor を開く
2. 以下のファイルの内容をコピー&ペースト:
   ```
   supabase/migrations/20250301000002_add_product_token_constraints.sql
   ```
3. 「Run」をクリック

### Step 2: 実行結果の確認

成功すると以下のメッセージが表示されます:
```
✅ Product token constraints migration completed
Check for conflicts: SELECT * FROM v_product_token_conflicts;
```

### Step 3: 既存データの重複チェック

既存の商品に重複がないか確認します:

```sql
SELECT * FROM v_product_token_conflicts;
```

**期待される結果**: 空の結果セット（重複なし）

もし重複が見つかった場合は、手動で対応が必要です。

---

## 動作確認

### テストケース 1: 正常な商品登録

1. NHT HUBで商品A（名前: "テスト商品", 画像: "test.png"）を登録
2. **期待結果**: ✅ 正常に登録される

### テストケース 2: 同一トークンHUBへの登録

1. NHT HUB1で商品A（名前: "テスト商品", 画像: "test.png"）を登録
2. NHT HUB2で商品A（名前: "テスト商品", 画像: "test.png"）を登録
3. **期待結果**: ✅ 正常に登録される（同一トークンなのでOK）

### テストケース 3: 異なるトークンHUBへの登録（エラーケース）

1. NHT HUBで商品A（名前: "テスト商品", 画像: "test.png"）を登録
2. JPYC HUBで商品A（名前: "テスト商品", 画像: "test.png"）を登録
3. **期待結果**: ❌ 以下のエラーメッセージが表示され、登録がブロックされる

```
❌ 商品登録エラー

この商品は既にNHT HUB（○○○）で使用されています。JPYC HUBでは登録できません。

【重要】異なるトークン種別のGIFT HUBで同一商品を設定することは禁止されています。
各GIFT HUBは受け入れトークン専用の商品のみを設定してください。
```

---

## トラブルシューティング

### Q1: マイグレーション実行時にエラーが出る

**原因**: カラムやトリガーが既に存在する

**解決策**:
```sql
-- 既存のトリガーを削除
DROP TRIGGER IF EXISTS trigger_check_product_token_match ON products;
DROP FUNCTION IF EXISTS check_product_token_match();

-- カラムを削除（注意：データが失われます）
ALTER TABLE products DROP COLUMN IF EXISTS accepted_token;

-- 再度マイグレーションを実行
```

### Q2: 既存の商品で重複が見つかった

**確認方法**:
```sql
SELECT * FROM v_product_token_conflicts;
```

**対処法**:
1. 重複している商品のどちらかを削除
2. または、商品名・画像を変更して差別化

### Q3: フロントエンドで重複チェックが動作しない

**確認ポイント**:
1. `useProductTokenCheck` フックが正しくインポートされているか
2. `machine.id` と `machine.settings.acceptedToken` が正しく取得できているか
3. Supabaseクエリの権限設定（RLS）が正しいか

---

## データベーススキーマ変更

### products テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `accepted_token` | TEXT | このcommercialが受け入れるトークン種別（NHT or JPYC） |

### 新規ビュー

#### `v_product_token_conflicts`

異なるトークン種別のHUBで同一商品が登録されているかチェックするビュー

```sql
SELECT * FROM v_product_token_conflicts;
```

---

## 今後の拡張

### 1. 管理画面での重複商品一覧表示

```typescript
// 管理画面に追加可能な機能
const { data: conflicts } = await supabase
  .from('v_product_token_conflicts')
  .select('*');

// 重複商品をリスト表示
```

### 2. バッチ検証スクリプト

定期的に重複をチェックして管理者に通知:

```sql
-- Supabase Edge Functionで定期実行
CREATE OR REPLACE FUNCTION check_product_conflicts_cron()
RETURNS void AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM v_product_token_conflicts;

  IF v_conflict_count > 0 THEN
    -- 管理者にメール通知など
    RAISE NOTICE 'Found % product conflicts', v_conflict_count;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## まとめ

この機能により、以下が実現されました:

✅ **システムレベルでの商品分離**: データベース制約により物理的に重複を防止
✅ **ユーザー体験の向上**: フロントエンドでリアルタイム警告
✅ **法的リスク軽減**: NHTとJPYCの明確な分離により資産価値誤認を防止
✅ **運用ルールの徹底**: テナントオーナーに自動的にルールを強制

今後は利用規約への記載と、定期的なデータ整合性チェックを推奨します。
