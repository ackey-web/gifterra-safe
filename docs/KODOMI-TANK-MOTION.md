# kodomi TANK 加速度センサー連動機能

## 概要

kodomi TANKコンポーネントに、デバイスの加速度センサーと連動して液体が揺れる機能を追加しました。

スマートフォンを傾けると、タンク内の液体がリアルタイムで揺れ動きます。

## 機能

### 1. **リアルタイム液体揺れアニメーション**
- デバイスの傾きに応じて液体が左右に揺れる
- 前後の傾きにも対応
- 滑らかなアニメーションで自然な動き

### 2. **クロスプラットフォーム対応**
- **ネイティブアプリ**: Capacitor Motion APIを使用
- **Webブラウザ**: DeviceOrientationEvent APIを使用（フォールバック）

### 3. **オプトイン設計**
- デフォルトでは無効
- `enableMotion={true}`で有効化
- パフォーマンスへの影響を最小限に

## 使い方

### 基本的な使い方

```tsx
import { LegalCompliantDualAxisTank } from './components/score/LegalCompliantDualAxisTank';

function MyComponent() {
  return (
    <LegalCompliantDualAxisTank
      // ... 既存のprops
      enableMotion={true}  // 🆕 加速度センサー連動を有効化
    />
  );
}
```

### Mypageでの実装例

```tsx
<OverallKodomiTank
  isMobile={isMobile}
  walletAddress={connectedAddress}
  enableMotion={true}  // スマホで傾けると液体が揺れる
/>
```

## 技術仕様

### useDeviceMotion Hook

加速度センサーのデータを取得するカスタムフック

```typescript
const motion = useDeviceMotion(enabled, interval);

// 返り値
motion = {
  tiltX: number,              // -180 ~ 180 (左右の傾き)
  tiltY: number,              // -90 ~ 90 (前後の傾き)
  accelerationX: number,      // 加速度 (m/s²)
  accelerationY: number,
  accelerationZ: number,
  normalizedTiltX: number,    // -1 ~ 1 (正規化)
  normalizedTiltY: number,
  isSupported: boolean,       // センサー対応状況
  error: string | null
}
```

### 液体の揺れ計算

```typescript
const liquidSway = {
  x: motion.normalizedTiltX * 15,  // 最大±15px
  y: motion.normalizedTiltY * 8,   // 最大±8px
  rotation: motion.normalizedTiltX * 3  // 最大±3度
};
```

## パフォーマンス

- **更新頻度**: 100ms間隔（10fps）
- **トランジション**: 0.3s ease-out（滑らかな動き）
- **CPU使用率**: 最小限（センサーイベントのみ）

## ブラウザ互換性

### ✅ ネイティブアプリ (Capacitor)
- **iOS 13+**: Capacitor Motion API経由で完全サポート
- **Android 5.0+**: Capacitor Motion API経由で完全サポート
- 最高のパフォーマンスと精度

### ✅ PWA (Progressive Web App)
- **iOS Safari 13+**: DeviceOrientationEvent API使用（要ユーザー許可）
- **Android Chrome**: DeviceOrientationEvent API使用（自動で有効）
- **ホーム画面に追加後**: ネイティブアプリ同様に動作

### ⚠️ 通常のWebブラウザ
- **iOS Safari**: 初回アクセス時に許可ダイアログ表示
- **Android Chrome**: 自動で有効（許可不要）
- **デスクトップ**: サポートなし（エラーなし、静的表示）

### PWAでの動作確認

1. **スマートフォンでサイトにアクセス**
2. **ホーム画面に追加**
   - iOS: 共有ボタン → ホーム画面に追加
   - Android: メニュー → ホーム画面に追加
3. **追加したアイコンから起動**
4. kodomi TANKページで`enableMotion={true}`が有効になっていれば動作

### iOS Safari PWAでの注意点

- **初回のみ許可が必要**: DeviceOrientationEventの使用許可
- **許可ダイアログが出ない場合**:
  1. Safari設定を開く
  2. モーションとオリエンテーション → 許可
  3. PWAを再起動

## セキュリティ・プライバシー

### iOS Safari
iOS 13以降では、DeviceOrientationEventの使用に明示的な許可が必要です：

```typescript
DeviceOrientationEvent.requestPermission()
  .then(response => {
    if (response === 'granted') {
      // 許可された
    }
  });
```

### データの取り扱い
- 加速度データは**ローカルのみで処理**
- **サーバーに送信されない**
- **個人情報は含まれない**

## トラブルシューティング

### 液体が揺れない

**原因1: enableMotionがfalse**
```tsx
// ✅ 正しい
<LegalCompliantDualAxisTank enableMotion={true} />

// ❌ 間違い
<LegalCompliantDualAxisTank />  // デフォルトはfalse
```

**原因2: ブラウザで許可していない（iOS Safari）**
- 設定 → Safari → モーションとオリエンテーションへのアクセス → 許可

**原因3: デスクトップブラウザで開いている**
- スマートフォン/タブレットで開く必要があります

### デバッグ

コンソールログでセンサー状態を確認：

```typescript
const motion = useDeviceMotion(true);
console.log('isSupported:', motion.isSupported);
console.log('error:', motion.error);
console.log('tiltX:', motion.tiltX);
```

## 今後の拡張案

- [ ] **振動フィードバック**: 液体が揺れたときにHaptics
- [ ] **重力シミュレーション**: より物理的に正確な液体の動き
- [ ] **複数の液体層**: 密度の異なる液体の表現
- [ ] **設定UI**: ユーザーが感度を調整可能に
- [ ] **デスクトップ対応**: マウスジェスチャーでの液体制御

## 関連ファイル

- `/src/hooks/useDeviceMotion.ts` - 加速度センサーhook
- `/src/components/score/LegalCompliantDualAxisTank.tsx` - TANKコンポーネント
- `/src/pages/Mypage.tsx` - 実装例
