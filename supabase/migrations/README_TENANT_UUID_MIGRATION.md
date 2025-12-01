# テナントUUIDマイグレーション実行手順

## 🚨 重要: 実行順序

マイグレーションエラーが発生している場合は、以下の順序で実行してください。

### Step 1: クリーンアップ（必要な場合のみ）

エラー `ERROR: 42701: column "tenant_uuid" specified more than once` が出る場合:

```sql
-- Supabase SQL Editorで実行
-- ファイル: 20250301000000_cleanup_tenant_uuid.sql
```

このスクリプトは:
- ✅ 現在のデータベース状態を診断
- ✅ 部分的に追加されたカラムを削除
- ✅ 関連するインデックスと制約を削除
- ✅ クリーンな状態にリセット

### Step 2: メインマイグレーション実行

```sql
-- Supabase SQL Editorで実行
-- ファイル: 20250301000001_add_tenant_uuid_columns_safe.sql
```

このスクリプトは:
- ✅ 完全に冪等（何度実行しても安全）
- ✅ カラム、インデックス、制約の存在チェック
- ✅ 既存データの自動マイグレーション
- ✅ ヘルパー関数とビューの作成

### Step 3: 確認

```sql
-- マイグレーション状況を確認
SELECT * FROM v_migration_status;

-- 出力例:
-- table_name        | total_rows | migrated_rows | pending_rows | migration_percentage
-- -----------------|------------|---------------|--------------|--------------------
-- vending_machines |         10 |            10 |            0 |               100.00
-- products         |        100 |           100 |            0 |               100.00
```

## 📊 各ファイルの説明

| ファイル名 | 目的 | いつ使う？ |
|-----------|------|-----------|
| `20250301000000_cleanup_tenant_uuid.sql` | クリーンアップ | エラーが出る場合のみ |
| `20250301000001_add_tenant_uuid_columns_safe.sql` | メイン実装 | 常に実行 |

## 🔍 トラブルシューティング

### 問題1: "column specified more than once" エラー

**原因**: 部分的にマイグレーションが実行されている

**解決**:
1. `20250301000000_cleanup_tenant_uuid.sql` を実行
2. `20250301000001_add_tenant_uuid_columns_safe.sql` を再実行

### 問題2: "foreign key constraint does not exist" エラー

**原因**: 制約が既に存在する

**解決**:
- メインマイグレーション (`20250301000001`) は自動的にスキップするので問題なし
- クリーンアップは不要

### 問題3: データが消えた

**原因**: クリーンアップスクリプトを本番環境で実行した

**解決**:
- ⚠️ クリーンアップは**開発環境のみ**で実行してください
- 本番環境では、メインマイグレーションのみを実行してください

## ✅ チェックリスト

実行前:
- [ ] Supabaseダッシュボードにログイン
- [ ] SQL Editorを開く
- [ ] 実行環境を確認（開発 or 本番）

実行後:
- [ ] `SELECT * FROM v_migration_status;` で100%確認
- [ ] エラーがないことを確認
- [ ] ログメッセージで追加されたカラムを確認

## 🎯 よくある質問

### Q1: クリーンアップすると既存データは消えますか？

**A**: いいえ。クリーンアップは`tenant_uuid`と`hub_id`カラムのみを削除します。既存の`tenant_id`（TEXT）カラムとデータは保持されます。

### Q2: メインマイグレーションは何度実行しても安全ですか？

**A**: はい。完全に冪等なので、何度実行しても同じ結果になります。

### Q3: 本番環境での実行順序は？

**A**:
1. バックアップを取得
2. メインマイグレーション (`20250301000001`) のみ実行
3. クリーンアップは**実行しない**

### Q4: ロールバックが必要な場合は？

**A**: クリーンアップスクリプトを実行すれば、追加されたカラムとオブジェクトが削除されます。

## 📞 サポート

問題が解決しない場合は、以下を確認してください:

1. エラーメッセージの全文
2. `SELECT version();` の結果（PostgreSQLバージョン）
3. データベースの状態（診断スクリプトの出力）

```sql
-- 診断スクリプト
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('vending_machines', 'products')
  AND column_name IN ('tenant_id', 'tenant_uuid', 'hub_id')
ORDER BY table_name, column_name;
```
