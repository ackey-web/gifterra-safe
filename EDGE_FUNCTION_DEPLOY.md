# Supabase Edge Function デプロイ手順

本番環境での画像アップロード「Failed to fetch」エラーを解決するため、CORS対応のEdge Functionを実装しました。

## 概要

- **問題**: Vercel本番環境からSupabase Storageへの直接アップロードがCORSエラーで失敗
- **解決策**: Supabase Edge Function経由でアップロード（サーバーサイドで処理するためCORS制限なし）

## 実装済みのEdge Functions

### 1. `upload-avatar` - プロフィール画像アップロード専用
- **パス**: `supabase/functions/upload-avatar/index.ts`
- **用途**: ユーザーのアバター画像をアップロード
- **バケット**: `gh-avatars`
- **パラメータ**:
  - `file`: 画像ファイル（File）
  - `walletAddress`: ウォレットアドレス（string）

### 2. `upload-file` - 汎用ファイルアップロード
- **パス**: `supabase/functions/upload-file/index.ts`
- **用途**: 任意のファイルを任意のバケットにアップロード
- **パラメータ**:
  - `file`: ファイル（File）
  - `bucketName`: バケット名（string）
  - `filePath`: ファイルパス（string、オプション）

## デプロイ手順

### 前提条件

1. Supabase CLIのインストール
```bash
npm install -g supabase
```

2. Supabaseプロジェクトへのログイン
```bash
supabase login
```

3. プロジェクトIDの確認
```bash
# SupabaseダッシュボードのProject Settings → Generalで確認
# プロジェクトID: druscvcjjhzxnerssanv
```

### デプロイコマンド

#### 1. プロジェクトにリンク（初回のみ）
```bash
cd /Users/masakiakita/Desktop/メタトロン関係/gifterra-safe
supabase link --project-ref druscvcjjhzxnerssanv
```

#### 2. Edge Functionsをデプロイ

**upload-avatar関数をデプロイ:**
```bash
supabase functions deploy upload-avatar
```

**upload-file関数をデプロイ:**
```bash
supabase functions deploy upload-file
```

**両方まとめてデプロイ:**
```bash
supabase functions deploy upload-avatar upload-file
```

#### 3. 環境変数の確認

デプロイ後、Supabaseダッシュボードで以下を確認：

1. **Edge Functions → Secrets**
2. 以下の環境変数が自動設定されていることを確認：
   - `SUPABASE_URL`: プロジェクトURL
   - `SUPABASE_ANON_KEY`: Anon Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key

**重要**: `SUPABASE_SERVICE_ROLE_KEY` は自動で設定されない場合があります。
その場合は以下のコマンドで設定：

```bash
# Service Role Keyを取得（Supabaseダッシュボード → Settings → API → service_role key）
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### デプロイの確認

#### 1. 関数がデプロイされたか確認
```bash
supabase functions list
```

出力例:
```
upload-avatar  deployed
upload-file    deployed
```

#### 2. ログを確認
```bash
# リアルタイムでログを確認
supabase functions logs upload-avatar --follow

# または特定時間のログを確認
supabase functions logs upload-avatar --limit 100
```

#### 3. テストリクエスト

**upload-avatarをテスト:**
```bash
curl -X POST \
  https://druscvcjjhzxnerssanv.supabase.co/functions/v1/upload-avatar \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "file=@/path/to/test-image.jpg" \
  -F "walletAddress=0x1234567890abcdef"
```

## フロントエンド側の変更

`src/lib/supabase.ts` の以下の関数を更新済み：

- ✅ `uploadAvatarImage()` - Edge Function経由に変更
- ✅ `uploadFile()` - Edge Function経由に変更

従来通りの関数名で呼び出せるため、既存コードの変更は不要です。

## トラブルシューティング

### エラー: "SUPABASE_SERVICE_ROLE_KEY is not set"

環境変数が設定されていません。以下で設定：

```bash
# Supabaseダッシュボード → Settings → API → service_role keyをコピー
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### エラー: "Failed to upload"

1. バケットが存在するか確認（Supabaseダッシュボード → Storage）
2. RLSポリシーが正しく設定されているか確認
3. Edge Functionのログを確認：`supabase functions logs upload-avatar`

### Edge Functionが見つからない

1. デプロイが完了しているか確認：`supabase functions list`
2. プロジェクトIDが正しいか確認：`supabase link --project-ref druscvcjjhzxnerssanv`
3. 再デプロイ：`supabase functions deploy upload-avatar --force`

## 本番環境での確認

1. Vercelで最新版をデプロイ
2. 本番環境 (`https://gifterra-safe.vercel.app`) でプロフィール画像アップロードをテスト
3. ブラウザのDevTools → Networkタブで以下を確認：
   - リクエストURL: `https://druscvcjjhzxnerssanv.supabase.co/functions/v1/upload-avatar`
   - ステータス: `200 OK`
   - レスポンス: `{"success":true,"url":"https://...","path":"..."}`

## 参考リンク

- [Supabase Edge Functions ドキュメント](https://supabase.com/docs/guides/functions)
- [Supabase CLI リファレンス](https://supabase.com/docs/reference/cli/introduction)
- [CORS対応ガイド](https://supabase.com/docs/guides/functions/cors)
