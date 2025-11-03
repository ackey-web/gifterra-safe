# Supabase Storage セットアップガイド

## 📦 概要

GIFT HUB の画像・ファイルアップロード機能を有効にするために、Supabase Storage バケットを作成します。

---

## 🎯 必要なバケット

以下の2つのバケットを作成する必要があります：

| バケット名 | 用途 | 公開設定 |
|---|---|---|
| `product-images` | 商品サムネイル画像 | Public（誰でも閲覧可能） |
| `product-files` | 配布ファイル（GLB, MP3など） | Public（ダウンロード用） |

---

## 📝 バケット作成手順

### ステップ1: Supabase Dashboard にアクセス

1. ブラウザで [Supabase Dashboard](https://app.supabase.com/) を開く
2. プロジェクトを選択
3. 左サイドバーから **「Storage」** をクリック

---

### ステップ2: `product-images` バケット作成

#### 2-1. 新規バケット作成

1. 画面右上の **「New bucket」** ボタンをクリック

#### 2-2. バケット設定

以下の情報を入力：

- **Name:** `product-images`
- **Public bucket:** ✅ **チェックを入れる**
- **File size limit:** `50 MB`（デフォルト）
- **Allowed MIME types:** 空欄（すべて許可）

#### 2-3. 作成

**「Create bucket」** ボタンをクリック

---

### ステップ3: `product-files` バケット作成

#### 3-1. 新規バケット作成

再び **「New bucket」** ボタンをクリック

#### 3-2. バケット設定

以下の情報を入力：

- **Name:** `product-files`
- **Public bucket:** ✅ **チェックを入れる**
- **File size limit:** `100 MB`（推奨）
- **Allowed MIME types:** 空欄（すべて許可）

#### 3-3. 作成

**「Create bucket」** ボタンをクリック

---

## ✅ 作成確認

Storage ページで以下のバケットが表示されることを確認：

```
📦 Buckets
├── product-images (public)
└── product-files (public)
```

---

## 🧪 動作確認

### ステップ1: 商品管理画面にアクセス

```
http://localhost:5174/admin
```

### ステップ2: 新規商品追加

1. ウォレット接続
2. **「📦 商品管理（Supabase）」** をクリック
3. **「＋ 新規商品追加」** をクリック

### ステップ3: 画像アップロードテスト

1. **「サムネイル画像」** の **「ファイルを選択」** をクリック
2. 画像ファイル（PNG, JPG など）を選択
3. 以下のメッセージが表示されることを確認：
   ```
   ✅ 画像をアップロードしました
   ```
4. プレビュー画像が表示される

### ステップ4: ファイルアップロードテスト

1. **「配布ファイル」** の **「ファイルを選択」** をクリック
2. 任意のファイル（GLB, MP3, PDF など）を選択
3. 以下のメッセージが表示されることを確認：
   ```
   ✅ ファイルをアップロードしました
   ```
4. パスが表示される：
   ```
   ✅ パス: product-files/xxxxx.glb
   ```

---

## 🐛 トラブルシューティング

### Q1: 「bucket "product-images" not found」エラー

**原因:** バケットが作成されていない

**解決策:**
- ステップ2 に戻って `product-images` バケットを作成

---

### Q2: 「bucket "product-files" not found」エラー

**原因:** バケットが作成されていない

**解決策:**
- ステップ3 に戻って `product-files` バケットを作成

---

### Q3: アップロード後に「null」が返される

**原因:** バケットの公開設定が間違っている

**解決策:**
1. Supabase Dashboard → Storage → バケットを選択
2. 右上の **「⚙️ Settings」** をクリック
3. **「Public bucket」** が **チェック済み** か確認
4. チェックされていなければチェックを入れて保存

---

### Q4: アップロード後に403エラー

**原因:** Supabase の RLS（Row Level Security）ポリシーの問題

**解決策:**

Supabase Dashboard → Storage → バケットを選択 → Policies で以下を確認：

**必要なポリシー:**
- ✅ `Anyone can upload to bucket` （アップロード許可）
- ✅ `Anyone can read from bucket` （読み取り許可）

ポリシーがない場合、以下のSQL を実行：

```sql
-- product-images バケットのポリシー
CREATE POLICY "Anyone can upload product-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anyone can read product-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- product-files バケットのポリシー
CREATE POLICY "Anyone can upload product-files"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'product-files');

CREATE POLICY "Anyone can read product-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-files');
```

---

## 📊 バケット管理

### ファイル一覧確認

Supabase Dashboard → Storage → バケットを選択 → アップロードされたファイルを確認

### ファイル削除

1. バケット内のファイルを選択
2. **「Delete」** ボタンをクリック

---

## 🔒 セキュリティ注意事項

### ⚠️ Public バケットの注意点

- **Public bucket** = 誰でも URL を知っていればアクセス可能
- **用途:** サムネイル画像、無料配布ファイルなど

### 🔐 Private バケットへの移行（将来）

有料コンテンツの配布には **Private bucket** を使用し、署名付きURL（Signed URL）でアクセス制御することを推奨：

```typescript
// 署名付きURL生成（TTL=600秒）
const { data } = await supabase.storage
  .from('private-bucket')
  .createSignedUrl('file-path', 600);
```

---

## ✅ セットアップ完了チェックリスト

- [ ] `product-images` バケット作成完了
- [ ] `product-files` バケット作成完了
- [ ] 両バケットとも Public に設定
- [ ] 画像アップロードが成功する
- [ ] ファイルアップロードが成功する
- [ ] 商品管理画面で画像プレビューが表示される

---

**セットアップが完了したら、商品管理画面で商品を追加してみましょう！** 🚀
