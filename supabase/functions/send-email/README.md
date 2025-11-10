# Send Email Edge Function

Resend APIを使用してメール通知を送信するSupabase Edge Function。

## 機能

- Resend APIを通じてHTMLメールを送信
- 通知タイプに応じたメール送信
- CORS対応

## 必要な環境変数

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

## デプロイ方法

```bash
# Edge Functionをデプロイ
supabase functions deploy send-email

# 環境変数を設定
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

## Resend APIキーの取得方法

1. [Resend](https://resend.com/)にアクセス
2. アカウント作成またはログイン
3. API Keys > Create API Key
4. キーをコピーして環境変数に設定

## 送信元メールアドレスの設定

Resendで送信元ドメインを検証する必要があります:

1. Resend Dashboard > Domains
2. Add Domain で `gifterra.io` を追加
3. DNSレコードを設定（SPF, DKIM）
4. 検証完了後、`notifications@gifterra.io` から送信可能

**注意**: ドメイン検証が完了していない場合は、Resendの開発用アドレス（`onboarding@resend.dev`）から送信されます。

## 使用方法

### 直接呼び出し

```bash
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/send-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "to": "user@example.com",
    "subject": "テスト通知",
    "html": "<h1>こんにちは</h1><p>これはテストメールです。</p>",
    "notificationType": "test"
  }'
```

### 他のEdge Functionから呼び出し

```typescript
const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({
    to: 'user@example.com',
    subject: 'メール件名',
    html: emailHtmlContent,
    notificationType: 'jpyc_received',
  }),
});
```

## レスポンス

### 成功時

```json
{
  "success": true,
  "messageId": "resend-message-id"
}
```

### エラー時

```json
{
  "success": false,
  "error": "Error message"
}
```

## エラーハンドリング

- Resend APIエラーは詳細をログに記録
- 送信失敗時は500エラーを返す
- RESEND_API_KEYが未設定の場合はエラー

## セキュリティ

- CORS: すべてのオリジンを許可（`Access-Control-Allow-Origin: *`）
- 認証: Supabase Authorizationヘッダーで保護
- APIキー: 環境変数で管理、コードには含めない
