# ガスレス決済統合ガイド

## ✅ 完了した作業

1. **PaymentGatewayWithPermitコントラクトのデプロイ**
   - アドレス: `0x9e9a065637323CDfC7c7C8185425fCE248854c9E`
   - Polygon Mainnet
   - Polygonscan: https://polygonscan.com/address/0x9e9a065637323CDfC7c7C8185425fCE248854c9E

2. **.env設定**
   - `VITE_ENABLE_GASLESS_PAYMENT=true`
   - `VITE_PAYMENT_GATEWAY_ADDRESS=0x9e9a065637323CDfC7c7C8185425fCE248854c9E`

3. **ユーティリティ作成**
   - [src/utils/permitSignature.ts](/src/utils/permitSignature.ts) - Permit署名生成ユーティリティ

4. **PaymentTerminal統合**
   - 既存のガスレス対応機能を確認済み
   - `gasless: true`フラグ付きQRコード生成機能あり

5. **X402PaymentSection統合完了**
   - `handleGaslessPayment`関数を実装
   - `handlePayment`関数に分岐処理を追加
   - TypeScriptコンパイルチェック: ✅ 成功

## 📋 X402PaymentSectionへの統合方法

### 1. インポート追加

[src/components/X402PaymentSection.tsx](/src/components/X402PaymentSection.tsx) の先頭に追加：

```typescript
import {
  preparePermitPaymentParams,
  PAYMENT_GATEWAY_ABI
} from '../utils/permitSignature';
import { isGaslessPaymentEnabled } from '../config/featureFlags';
```

### 2. 環境変数の取得

コンポーネント内で取得：

```typescript
const PAYMENT_GATEWAY_ADDRESS = import.meta.env.VITE_PAYMENT_GATEWAY_ADDRESS || '';
```

### 3. handlePayment関数の分岐処理

`handlePayment`関数の最初（line 282付近）に以下を追加：

```typescript
const handlePayment = async () => {
  if (!paymentData || !walletAddress) {
    console.error('❌ paymentDataまたはwalletAddressが未設定');
    setMessage({ type: 'error', text: 'ウォレットを接続してください' });
    return;
  }

  // ========== ガスレス決済の処理 ==========
  if (paymentData.gasless && isGaslessPaymentEnabled(walletAddress)) {
    return await handleGaslessPayment();
  }

  // ========== 通常決済の処理（既存コード）==========
  setIsProcessing(true);
  setMessage(null);
  // ... 既存のコードが続く ...
};
```

### 4. ガスレス決済ハンドラの追加

`handlePayment`関数の前に以下を追加：

```typescript
// ガスレス決済実行
const handleGaslessPayment = async () => {
  if (!paymentData || !walletAddress) {
    setMessage({ type: 'error', text: 'ウォレットを接続してください' });
    return;
  }

  if (!PAYMENT_GATEWAY_ADDRESS) {
    setMessage({
      type: 'error',
      text: 'PaymentGatewayがデプロイされていません'
    });
    return;
  }

  setIsProcessing(true);
  setMessage({ type: 'info', text: 'Permit署名を準備中...' });

  try {
    console.log('📦 ガスレス決済開始:', {
      paymentGateway: PAYMENT_GATEWAY_ADDRESS,
      jpyc: jpycConfig.currentAddress,
      merchant: paymentData.to,
      amount: paymentData.amount,
      requestId: paymentData.requestId,
    });

    // 1. Permitシグネチャを生成
    setMessage({ type: 'info', text: 'ウォレットで署名してください...' });

    const permitParams = await preparePermitPaymentParams(
      signer,
      PAYMENT_GATEWAY_ADDRESS,
      jpycConfig.currentAddress,
      paymentData.to,
      paymentData.amount,
      paymentData.requestId || `gasless_${Date.now()}`,
      30 // 30分の有効期限
    );

    console.log('✅ Permit署名完了:', permitParams);

    // 2. PaymentGatewayコントラクトを呼び出し
    setMessage({ type: 'info', text: 'トランザクションを送信中...' });

    const gatewayContract = new ethers.Contract(
      PAYMENT_GATEWAY_ADDRESS,
      PAYMENT_GATEWAY_ABI,
      signer
    );

    const tx = await gatewayContract.executePaymentWithPermit(
      permitParams.requestId,
      permitParams.merchant,
      permitParams.amount,
      permitParams.deadline,
      permitParams.v,
      permitParams.r,
      permitParams.s
    );

    console.log('⏳ トランザクション送信完了:', tx.hash);
    setMessage({ type: 'info', text: 'トランザクション確認中...' });

    // 3. トランザクション確認
    const receipt = await tx.wait();
    console.log('✅ トランザクション確認完了:', receipt);

    // 4. Supabaseに記録
    if (paymentData.requestId) {
      const { error: updateError } = await supabase
        .from('payment_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: walletAddress.toLowerCase(),
          tx_hash: tx.hash,
        })
        .eq('request_id', paymentData.requestId);

      if (updateError) {
        console.warn('⚠️ Supabase更新エラー:', updateError.message);
      }
    }

    setMessage({ type: 'success', text: '✅ 決済が完了しました！' });
    setPaymentData(null);
    setShowConfirmation(false);

    setTimeout(() => {
      setMessage(null);
      setIsProcessing(false);
    }, 3000);

  } catch (error: any) {
    console.error('❌ ガスレス決済エラー:', error);

    let errorMessage = 'ガスレス決済に失敗しました';
    if (error.message.includes('user rejected')) {
      errorMessage = '署名がキャンセルされました';
    } else if (error.message.includes('insufficient')) {
      errorMessage = '残高不足です';
    } else if (error.message.includes('already processed')) {
      errorMessage = 'この支払いは既に完了しています';
    }

    setMessage({ type: 'error', text: errorMessage });
    setIsProcessing(false);
  }
};
```

## 🎯 動作フロー

### 店舗側（PaymentTerminal）

1. 金額を入力
2. 「QR生成」ボタンをクリック
3. ガスレスQRコード（`gasless: true`フラグ付き）が生成される
4. お客様にQRコードを見せる

### お客様側（X402PaymentSection）

1. 「スキャン開始」ボタンをクリック
2. カメラでQRコードをスキャン
3. 決済内容を確認
4. 「支払う」ボタンをクリック
5. ウォレットでPermit署名（ガス代不要）
6. PaymentGatewayが決済を実行（ガス代は店舗が負担）
7. 決済完了

## 🔍 デバッグ方法

### コンソールログ確認

ブラウザの開発者ツールで以下のログを確認：

```
📦 ガスレス決済開始: { ... }
✅ Permit署名完了: { ... }
⏳ トランザクション送信完了: 0x...
✅ トランザクション確認完了: { ... }
```

### Polygonscan確認

トランザクションハッシュをPolygonscanで確認：
```
https://polygonscan.com/tx/{tx_hash}
```

PaymentGatewayコントラクト：
```
https://polygonscan.com/address/0x9e9a065637323CDfC7c7C8185425fCE248854c9E
```

## 🧪 テスト手順

1. **開発サーバー起動**
   ```bash
   pnpm dev
   ```

2. **テストページでテスト**
   - QR生成: http://localhost:5173/gasless-qr-test
   - スキャナー: http://localhost:5173/gasless-scanner-test

3. **本番統合後のテスト**
   - PaymentTerminal（店舗レジ）
   - Mypage（お客様スキャナー）

## ⚠️ 注意事項

1. **JPYCのPermit対応**
   - JPYCトークンはERC-2612 Permit標準に対応している必要があります
   - Polygon MainnetのJPYC: `0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c`

2. **ガス代負担**
   - ガス代は`executePaymentWithPermit`を呼び出す側（お客様）が負担します
   - ただし、Permit署名自体はガス代不要です

3. **セキュリティ**
   - requestIDでリプレイアタック防止
   - deadlineで有効期限管理
   - Supabaseで決済状態管理

4. **エラーハンドリング**
   - 残高不足
   - 署名キャンセル
   - 重複決済
   - 有効期限切れ

## 📚 参考資料

- [ERC-2612 Permit標準](https://eips.ethereum.org/EIPS/eip-2612)
- [EIP-712 署名標準](https://eips.ethereum.org/EIPS/eip-712)
- [GASLESS_PAYMENT_SUMMARY.md](/GASLESS_PAYMENT_SUMMARY.md)
- [GASLESS_PAYMENT_TEST.md](/GASLESS_PAYMENT_TEST.md)
