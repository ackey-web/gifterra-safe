# GIFTERRA 温存＋段階統合 実装ガイド

## 📋 概要

既存機能を廃止せず、MVP新規実装と段階的に統合する開発方針のガイドです。

---

## ✅ Phase 1: 基礎構築（完了）

### 実装済み

- [x] ディレクトリ構造作成（`app/`, `legacy/`, `shared/`）
- [x] `.vscode/settings.json` 最適化（巨大フォルダ除外）
- [x] ENV設定ファイル（`featureFlags.ts`, `routing.ts`）
- [x] Adapter層実装
  - [x] `walletClient.ts` (Privy/ThirdWeb統一IF)
  - [x] `tokenClient.ts` (ERC20操作統一IF)
  - [x] `scanLink.ts` (QR生成＋R2Pリンク統一IF)
  - [x] `dbClient.ts` (Supabase読み書き制御)
- [x] `.env.local.template` 作成

### ディレクトリ構造

```
src/
├── app/                    # 🆕 MVP新規実装
│   ├── pages/
│   ├── components/
│   └── layouts/
├── legacy/                 # 🔒 既存UI（参照専用）
│   └── (移動予定)
├── shared/                 # 🔄 新旧共通層
│   ├── adapters/          # ✅ 完了
│   │   ├── walletClient.ts
│   │   ├── tokenClient.ts
│   │   ├── scanLink.ts
│   │   ├── dbClient.ts
│   │   └── index.ts
│   ├── hooks/
│   ├── types/
│   └── utils/             # ✅ 完了
│       ├── featureFlags.ts
│       └── routing.ts
├── config/                # 既存維持
├── lib/                   # 既存維持
└── main.tsx               # 修正予定
```

---

## 🚀 Phase 2: 次のステップ

### 優先度順タスク

#### 1. 既存コードをlegacy/に移動

```bash
# 既存のページ/UIをlegacyディレクトリに移動
mv src/pages src/legacy/pages
mv src/reward-ui src/legacy/reward-ui
mv src/tip-ui src/legacy/tip-ui
mv src/vending-ui src/legacy/vending-ui
mv src/admin src/legacy/admin
```

#### 2. main.tsx修正（ルーティング統合）

```typescript
// src/main.tsx

import { ROUTES, isMVPRoute, isLegacyRoute } from './shared/utils/routing';
import { FEATURE_FLAGS } from './shared/utils/featureFlags';

const path = location.pathname;

root.render(
  <React.StrictMode>
    <PrivyProvider {...}>
      <ThirdwebProvider {...}>
        <AuthProvider>
          {/* R2P専用 */}
          {path === '/pay' ? (
            <PayPage />

          /* MVP UI */
          ) : isMVPRoute(path) && FEATURE_FLAGS.ENABLE_MVP_UI ? (
            <AppRouter />

          /* Legacy UI */
          ) : isLegacyRoute(path) && FEATURE_FLAGS.ENABLE_LEGACY_UI ? (
            <LegacyRouter />

          /* デフォルト */
          ) : (
            <Navigate to={ROUTES.APP_SEND} replace />
          )}
        </AuthProvider>
      </ThirdwebProvider>
    </PrivyProvider>
  </React.StrictMode>
);
```

#### 3. MVP送金ページ実装（/app/send）

**ファイル構成**:

```
src/app/pages/send/
├── index.tsx               # エントリーポイント
├── components/
│   ├── AddressInput.tsx    # アドレス入力
│   ├── QRScanner.tsx       # QRスキャン
│   ├── AmountInput.tsx     # 金額入力
│   ├── TokenSelector.tsx   # トークン選択
│   └── ConfirmDialog.tsx   # 確認画面
└── hooks/
    ├── useSendTransaction.ts  # 送金ロジック
    └── useGasEstimate.ts      # ガス代見積もり
```

**実装例（useSendTransaction.ts）**:

```typescript
import { useWalletClient, useTokenClient, useDBClient } from '@/shared/adapters';

export function useSendTransaction() {
  const wallet = useWalletClient();
  const token = useTokenClient();
  const db = useDBClient();

  const send = async (to: string, amount: string, tokenAddress: string) => {
    if (!wallet.isConnected) throw new Error('Wallet not connected');

    // トークン送金
    const txHash = await token.transfer(tokenAddress, to, amount);

    // DB記録（MVP側として記録）
    await db.insert('transactions', {
      tx_hash: txHash,
      from: wallet.address,
      to,
      amount,
      token_address: tokenAddress,
      created_at: new Date().toISOString(),
    }, 'mvp');  // ← 重要: ソースを明示

    return txHash;
  };

  return { send };
}
```

#### 4. MVP受取ページ実装（/app/receive）

**ファイル構成**:

```
src/app/pages/receive/
├── index.tsx               # エントリーポイント
├── components/
│   ├── AddressQRCode.tsx   # 自分のQR表示
│   ├── R2PForm.tsx         # R2P作成フォーム
│   └── R2PDisplay.tsx      # R2Pリンク表示
└── hooks/
    └── useR2P.ts           # R2Pロジック
```

**実装例（useR2P.ts）**:

```typescript
import { useScanLink } from '@/shared/adapters';

export function useR2P() {
  const scanLink = useScanLink();

  const createR2P = async (to: string, amount: string, token: string) => {
    const r2pLink = await scanLink.generateR2PLink({
      to,
      amount,
      token,
      expiresIn: 3600, // 1時間
    });

    return r2pLink; // { url, qrCode, id, expiresAt }
  };

  return { createR2P };
}
```

#### 5. R2P APIエンドポイント実装

**api/r2p/create.ts**:

```typescript
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, amount, token, expiresIn } = req.body;

  const id = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  // HMAC署名生成
  const secret = process.env.R2P_HMAC_SECRET;
  const message = `${id}:${to}:${amount}:${token}:${expiresAt}`;
  const sig = createHmac('sha256', secret).update(message).digest('hex');

  return res.status(200).json({ id, sig, expiresAt });
}
```

**api/r2p/verify.ts**:

```typescript
import { createHmac } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, sig, to, amount, token, expires } = req.body;

  // 有効期限チェック
  const now = Math.floor(Date.now() / 1000);
  if (parseInt(expires) < now) {
    return res.status(400).json({ valid: false, error: 'Link expired' });
  }

  // 署名検証
  const secret = process.env.R2P_HMAC_SECRET;
  const message = `${id}:${to}:${amount}:${token}:${expires}`;
  const expectedSig = createHmac('sha256', secret).update(message).digest('hex');

  if (sig !== expectedSig) {
    return res.status(400).json({ valid: false, error: 'Invalid signature' });
  }

  return res.status(200).json({ valid: true });
}
```

---

## 🧪 動作確認手順

### 1. 環境設定

```bash
# テンプレートをコピー
cp .env.local.template .env.local

# 必要な値を設定
# - VITE_PRIVY_APP_ID
# - VITE_ALCHEMY_RPC_URL
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - R2P_HMAC_SECRET（openssl rand -hex 32 で生成）
```

### 2. 開発サーバー起動

```bash
pnpm install
pnpm dev
```

### 3. 動作確認

- MVP送金: `http://localhost:5173/app/send`
- MVP受取: `http://localhost:5173/app/receive`
- Legacy Mypage: `http://localhost:5173/legacy/mypage`

### 4. Adapter動作確認

```typescript
// ブラウザコンソールで確認
import { useWalletClient } from '@/shared/adapters';

const wallet = useWalletClient();
console.log('Address:', wallet.address);
console.log('Connected:', wallet.isConnected);
```

---

## 📊 進捗管理

### Phase 1: 基礎構築 ✅ 完了

- Adapter層実装完了
- ENV設定完了
- VSCode設定最適化完了

### Phase 2: MVP送受信実装 🔄 進行中

- [ ] 既存コードlegacy移動
- [ ] main.tsx修正
- [ ] /app/send 実装
- [ ] /app/receive 実装
- [ ] R2P API実装

### Phase 3: Legacy統合開始 ⏳ 未着手

- [ ] Admin Dashboard移行
- [ ] Claim History移行
- [ ] User Profile移行

---

## 🛠️ トラブルシューティング

### Adapter層がimportできない

```bash
# tsconfig.jsonにpathsを追加
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/shared/*": ["./src/shared/*"]
    }
  }
}
```

### DB書き込みエラー（Legacy側）

```typescript
// VITE_ALLOW_LEGACY_DB_WRITE=true を設定
// または、MVP側で書き込む設計に変更
```

### git indexエラー

```bash
# index.lockを削除
rm -f .git/index.lock
git reset --hard HEAD
```

---

## 📞 次のアクション

1. **Phase 2開始**: 既存コードをlegacy/に移動
2. **main.tsx修正**: ルーティング統合
3. **MVP送金実装**: /app/send ページ作成
4. **動作確認**: Adapter層経由でウォレット接続・送金テスト

---

**作成日**: 2025-11-03
**最終更新**: 2025-11-03
**Phase**: 1 → 2移行中
