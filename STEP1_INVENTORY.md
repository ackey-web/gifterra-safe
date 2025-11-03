# STEP1: 実体の棚卸し

## 📂 既存ファイル一覧（実体パス）

### 🏢 HUB管理ページ
- **メインダッシュボード**
  - `src/admin/vending/VendingDashboard.tsx` (1,216行)
    - localStorage連動のHUB一覧管理
    - 編集モーダル（デザイン設定・商品3枠・画像/ファイルアップロード）
    - グローバル「新規商品追加（Supabase）」ボタン統合済み（336-376行目）
    - プレビュー表示（442-550行目）

### 📦 商品管理コンポーネント
- **商品管理ページ（Supabase版）**
  - `src/admin/products/ProductManager.tsx` (505行)
    - Supabase products テーブルとの CRUD
    - ドラフト機能（localStorage: 'product-manager:draft'）
    - 編集モーダル（367-502行目）
    - useSupabaseProducts フック使用

- **再利用可能な商品フォーム**
  - `src/admin/products/ProductForm.tsx` (277行)
    - 新規作成/編集用フォームコンポーネント
    - 画像アップロード（gh-public）
    - ファイルアップロード（gh-public / TODO: gh-downloads移行）
    - バリデーション・エラーハンドリング

### 🔌 Supabase 連動
- **商品データ操作**
  - `src/lib/supabase/products.ts` (152行)
    - createProduct(), updateProduct(), deleteProduct()
    - RLSポリシー準拠（サービスロール不使用）
    - デフォルトtenantId: 'default'

- **商品データフック**
  - `src/hooks/useSupabaseProducts.ts` (73行)
    - Supabase products テーブルからの取得
    - tenantId, isActive でフィルタ
    - リアルタイム更新非対応（手動refetch）

- **Supabaseクライアント**
  - `src/lib/supabase.ts` (約200行)
    - uploadImage() 関数（バケット指定可能）
    - Supabase初期化・エクスポート

### 🖼️ 画像アップロードユーティリティ
- **アップロードAPI**
  - `src/lib/uploadApi.ts` (約100行)
    - 汎用的なファイルアップロード処理

### 🎨 プレビュー・自販機UI
- **自販機プレビューコンポーネント**
  - `src/vending-ui/App.tsx` (約400行)
    - localStorage連動の自販機表示
    - 3商品スロット表示
  
  - `src/vending-ui/AppSupabase.tsx` (約500行)
    - Supabase products 連動版の自販機
    - ワンクリック購入フロー統合

  - `src/vending-ui/components/VendingMachineShell.tsx`
    - 筐体デザインコンポーネント

### 🎯 型定義
- **VendingMachine型**
  - `src/types/vending.ts`
    - VendingMachine, Product, Settings インターフェース
    - design, operatingHours等の定義

### 📍 ルーティング
- **メインルーティング**
  - `src/main.tsx` または `src/App.tsx`
    - /admin → Dashboard.tsx
    - /vending/:slug → 自販機表示
    - （確認必要）

### 🔐 触らない保証対象（差分禁止）
- ❌ `api/purchase/init.ts` - 購入API
- ❌ `api/download/[token].ts` - ダウンロードAPI
- ❌ `src/lib/purchase.ts` - 購入ロジック
- ❌ `src/pages/DownloadPage.tsx` - DLページ
- ❌ `src/pages/MyPurchasesPage.tsx` - 購入履歴
- ❌ `supabase/migrations/**` - マイグレーション
- ❌ Storage バケット命名
  - gh-public（公開商品画像）
  - gh-downloads（非公開ダウンロードファイル）
  - gh-logos（HUBロゴ）
  - gh-avatars（アバター）
  - gh-temp（一時ファイル）
- ❌ localStorage キー
  - 'vending_machines_data'（HUB設定）
  - 'product-manager:draft'（商品ドラフト）
  - その他既存キーは **削除・上書き禁止**

## 🆕 新規作成方針

### STEP2以降で作成するファイル（*New サフィックス）
- `src/admin/vending/VendingDashboardNew.tsx` - 新2カラムレイアウト
- `src/admin/vending/components/HubListNew.tsx` - 左カラム：HUB一覧
- `src/admin/vending/components/HubDetailPanelNew.tsx` - 右カラム：詳細パネル
- `src/admin/vending/components/DesignTabNew.tsx` - Designタブ
- `src/admin/vending/components/ProductsTabNew.tsx` - Productsタブ
- `src/admin/vending/components/PreviewTabNew.tsx` - Previewタブ

### 既存ファイルの再利用戦略
- ✅ **ProductForm.tsx** → そのまま wrap して使用
- ✅ **ProductManager.tsx の一覧ロジック** → ProductsTabNew 内で再利用
- ✅ **VendingDashboard.tsx のデザイン設定UI** → DesignTabNew に移植
- ✅ **VendingDashboard.tsx のプレビュー** → PreviewTabNew に移植
- ✅ **uploadImage() / supabase** → そのまま import
- ✅ **useSupabaseProducts** → そのまま使用

### import パス調整
- 既存 import は維持
- 新規コンポーネントは相対パスで安全に参照
- 循環参照に注意

## ✅ STEP1 完了
棚卸し完了。次のSTEP2の承認をお願いします。
