# Edge Function アップロードテスト手順

## 本番環境でのテスト

### 1. プロフィール画像アップロード

1. https://gifterra-safe.vercel.app にアクセス
2. Googleまたはウォレットでログイン
3. マイページに移動
4. 「プロフィール編集」ボタンをクリック
5. 画像を選択してアップロード
6. DevToolsのNetworkタブで以下を確認：

```
✅ 成功の場合:
Request URL: https://druscvcjjhzxnerssanv.supabase.co/functions/v1/upload-avatar
Status: 200 OK
Response: {
  "success": true,
  "url": "https://druscvcjjhzxnerssanv.supabase.co/storage/v1/object/public/gh-avatars/...",
  "path": "0x.../avatar.jpg"
}

❌ 失敗の場合（Edge Functionエラー）:
Status: 400 or 500
Response: {
  "error": "エラーメッセージ"
}

❌ 失敗の場合（CORSエラー - Edge Functionが未デプロイ）:
Console: "CORS policy: No 'Access-Control-Allow-Origin' header"
```

### 2. 期待される動作

- ✅ 画像が正常にアップロードされる
- ✅ プロフィール画像が表示される
- ✅ CORSエラーが出ない
- ✅ `gh-avatars` バケットにファイルが保存される

### 3. エラーハンドリングの確認

以下のケースでエラーメッセージが適切に表示されるか確認：

- ❌ 5MBを超えるファイル → "画像サイズは5MB以下にしてください"
- ❌ PDFなど非対応形式 → "JPG、PNG、GIF、WebP形式の画像のみアップロード可能です"

## 開発環境でのテスト

### 1. 開発サーバーを起動

```bash
pnpm dev
```

### 2. ブラウザでテスト

1. http://localhost:5173 にアクセス
2. ログイン → プロフィール編集 → 画像アップロード
3. DevToolsで確認（本番環境と同じURL）

**注意**: 開発環境でも本番のEdge Functionを使用します（ローカルでEdge Functionを動かすにはSupabase CLIが必要）

## Edge Function ログの確認

### リアルタイムでログを確認

```bash
supabase functions logs upload-avatar --follow
```

### 過去のログを確認

```bash
# 最新50件
supabase functions logs upload-avatar --limit 50

# 最新100件
supabase functions logs upload-file --limit 100
```

### ログの見方

```
✅ 成功ログ:
📤 Uploading avatar: 0x1234.../avatar.jpg (245678 bytes)
🗑️ Deleted 1 existing avatar(s)
✅ Upload successful: https://...

❌ エラーログ:
❌ Upload error: { message: "Bucket not found", statusCode: "404" }
❌ Server error: Error: SUPABASE_SERVICE_ROLE_KEY is not set
```

## トラブルシューティング

### エラー: "Failed to fetch" (CORSエラー)

**原因**: Edge Functionが正しくデプロイされていない

**解決策**:
```bash
supabase functions list
# → upload-avatar と upload-file が表示されるか確認

# 再デプロイ
supabase functions deploy upload-avatar upload-file
```

### エラー: "SUPABASE_SERVICE_ROLE_KEY is not set"

**原因**: Edge Functionの環境変数が設定されていない

**解決策**:
```bash
# Supabaseダッシュボード → Settings → API → service_role key をコピー
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### エラー: "Bucket not found"

**原因**: `gh-avatars` バケットが存在しない

**解決策**:
1. Supabaseダッシュボード → Storage
2. "New bucket" をクリック
3. Name: `gh-avatars`
4. Public: ✅ チェック

### エラー: "Row Level Security policy violation"

**原因**: RLSポリシーが正しく設定されていない

**解決策**:
`supabase/migrations/20250130_add_user_profiles_avatar.sql` のSQLを実行

## 成功の確認方法

### 1. Supabase Storage で確認

1. Supabaseダッシュボード → Storage → `gh-avatars`
2. ウォレットアドレスのフォルダが作成されている
3. `avatar.jpg` ファイルが存在する

### 2. 公開URLで確認

ブラウザで直接URLを開く：
```
https://druscvcjjhzxnerssanv.supabase.co/storage/v1/object/public/gh-avatars/0x.../avatar.jpg
```

画像が表示されればOK

### 3. プロフィール画面で確認

マイページでプロフィール画像が表示されていればOK

## 参考: curl でのテスト

コマンドラインでEdge Functionを直接テスト：

```bash
# アバターアップロード
curl -X POST \
  https://druscvcjjhzxnerssanv.supabase.co/functions/v1/upload-avatar \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "file=@/path/to/test-image.jpg" \
  -F "walletAddress=0x1234567890abcdef"

# 汎用ファイルアップロード
curl -X POST \
  https://druscvcjjhzxnerssanv.supabase.co/functions/v1/upload-file \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "file=@/path/to/test-file.png" \
  -F "bucketName=gh-public" \
  -F "filePath=test/my-file.png"
```

成功時のレスポンス:
```json
{
  "success": true,
  "url": "https://druscvcjjhzxnerssanv.supabase.co/storage/v1/object/public/gh-avatars/...",
  "path": "0x.../avatar.jpg"
}
```
