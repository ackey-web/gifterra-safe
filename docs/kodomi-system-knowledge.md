# KODOMI システム - ナレッジベース

## 概要

KODOMI（コドミ）システムは、Gifterraプラットフォームにおけるユーザーエンゲージメント測定とインセンティブ設計の中核をなす仕組みです。

---

## KODOMI TANK（コドミタンク）

### 定義

**KODOMI TANK**は、ユーザーの「こども心」「好奇心」「ワクワク感」を数値化して貯蔵する仮想的なタンク（貯蔵庫）です。

### 特徴

1. **エンゲージメント測定**
   - ユーザーのプラットフォーム内での活動量を可視化
   - インタラクション（TIP送信、コンテンツ視聴、コメントなど）に応じて蓄積

2. **非資産価値**
   - KODOMI TANKに貯まる値は資産価値を持たない
   - あくまでユーザーの活動度・貢献度を示す指標

3. **ユーティリティ**
   - 一定量貯まることで特典やボーナスコンテンツにアクセス可能
   - プラットフォーム内での特別な体験の解放条件

4. **リセット機能**
   - 特典と交換した際にタンクが減少または空になる
   - 継続的なエンゲージメントを促進する設計

### 貯まり方の例

```
アクション例:
- TIPを送る: +10 KODOMI
- コンテンツを視聴: +5 KODOMI
- コメントを投稿: +3 KODOMI
- デイリーログイン: +1 KODOMI
- 友達招待: +50 KODOMI
```

### 使い道の例

```
特典交換例:
- 限定コンテンツ閲覧権: 100 KODOMI
- 限定イベント参加権: 200 KODOMI
- クリエイター直接メッセージ権: 300 KODOMI
- 特別バッジ獲得: 500 KODOMI
```

---

## KODOMI ゲージ

### 定義

**KODOMI ゲージ**は、KODOMI TANKの現在の蓄積量を視覚的に表示するUI要素です。

### 表示形式

1. **ゲージバー**
   ```
   ▓▓▓▓▓▓▓▓▓░ 90/100 KODOMI
   ```
   - プログレスバー形式で現在の貯蔵量を表示
   - 次の目標値までの進捗を可視化

2. **数値表示**
   ```
   現在: 450 KODOMI
   次の特典まで: あと 50 KODOMI
   ```
   - 現在の保有量
   - 次の特典獲得までの必要量

3. **レベル表示（オプション）**
   ```
   レベル 5: エキスパート
   (500/1000 KODOMI)
   ```
   - ユーザーレベルとの連動
   - ランク表示でゲーミフィケーション強化

### 配置場所

- **ユーザーダッシュボード**: メイン表示
- **プロフィールページ**: アクティビティ指標として
- **GIFT HUB画面**: TIP送信時に増加アニメーション
- **ヘッダーナビゲーション**: 常時確認可能

### アニメーション

- TIP送信時: ゲージが上昇するアニメーション
- 特典交換時: ゲージが減少するアニメーション
- レベルアップ時: キラキラエフェクトと祝福メッセージ
- マイルストーン達成時: 特殊なビジュアルエフェクト

---

## KODOMIシステムの設計思想

### 1. ゲーミフィケーション

**目的**: ユーザーの継続的なエンゲージメントを促進

**手法**:
- 進捗の可視化
- 達成感の提供
- 明確な目標設定
- 報酬システム

### 2. 心理学的アプローチ

**こども心の再発見**:
- 「貯める楽しさ」「集める楽しさ」の提供
- 好奇心を刺激するコンテンツ解放
- ワクワク感を持続させる仕掛け

**内発的動機づけ**:
- 金銭的報酬ではなく体験価値の提供
- 自己成長感・達成感の醸成
- コミュニティ貢献の可視化

### 3. 非資産性の明確化

**重要**: KODOMI TANKの値は資産価値を持たない

理由:
- 暗号資産規制への対応
- プラットフォーム内ポイント制度として設計
- 譲渡・換金不可
- あくまでユーザー体験向上のための指標

---

## 技術実装

### データベーススキーマ（想定）

```sql
-- ユーザーのKODOMI情報
CREATE TABLE user_kodomi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  current_kodomi INTEGER DEFAULT 0, -- 現在の保有量
  total_earned INTEGER DEFAULT 0,   -- 累計獲得量
  total_spent INTEGER DEFAULT 0,    -- 累計消費量
  level INTEGER DEFAULT 1,           -- レベル
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- KODOMI獲得履歴
CREATE TABLE kodomi_earn_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'tip', 'view', 'comment', 'login', etc.
  source_id UUID,             -- TIP ID, コンテンツID など
  created_at TIMESTAMP DEFAULT NOW()
);

-- KODOMI消費履歴
CREATE TABLE kodomi_spend_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  reward_type TEXT NOT NULL, -- 'content', 'event', 'badge', etc.
  reward_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### フロントエンド実装（React）

```typescript
// src/components/KodomiGauge.tsx
interface KodomiGaugeProps {
  current: number;
  max: number;
  nextReward?: {
    name: string;
    requiredKodomi: number;
  };
}

export function KodomiGauge({ current, max, nextReward }: KodomiGaugeProps) {
  const percentage = (current / max) * 100;

  return (
    <div className="kodomi-gauge">
      <div className="gauge-bar">
        <div
          className="gauge-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="gauge-text">
        {current} / {max} KODOMI
      </p>
      {nextReward && (
        <p className="next-reward">
          次の特典「{nextReward.name}」まであと {nextReward.requiredKodomi - current} KODOMI
        </p>
      )}
    </div>
  );
}
```

### KODOMI付与ロジック

```typescript
// src/lib/kodomi.ts
export async function awardKodomi(
  userId: string,
  amount: number,
  actionType: string,
  sourceId?: string
) {
  // 1. KODOMI付与
  const { data, error } = await supabase.rpc('add_kodomi', {
    p_user_id: userId,
    p_amount: amount,
    p_action_type: actionType,
    p_source_id: sourceId
  });

  // 2. レベルアップチェック
  await checkLevelUp(userId);

  // 3. マイルストーン達成チェック
  await checkMilestones(userId);

  return { success: !error, data };
}
```

---

## ユーザー向け説明（FAQ形式）

### Q1: KODOMI TANKとは何ですか？

**A**: KODOMI TANKは、あなたのプラットフォーム内での活動を「こども心ポイント」として貯めるタンクです。TIPを送ったり、コンテンツを楽しんだりすることでKODOMIが貯まります。

### Q2: 貯まったKODOMIは何に使えますか？

**A**: 限定コンテンツの閲覧、特別イベントへの参加、クリエイターとの直接交流権など、様々な特典と交換できます。

### Q3: KODOMIは売買できますか？

**A**: いいえ、KODOMIは資産価値を持たないプラットフォーム内ポイントです。他のユーザーへの譲渡や換金はできません。

### Q4: KODOMIゲージはどこで確認できますか？

**A**: ダッシュボード、プロフィールページ、画面上部のヘッダーで常時確認できます。

### Q5: KODOMIが減ることはありますか？

**A**: はい、特典と交換した際にKODOMIが消費されます。また、一定期間活動がない場合も減少する可能性があります（設計次第）。

---

## 運用ガイドライン

### テナントオーナー向け

1. **KODOMI報酬の設定**
   - コンテンツ視聴: 5-10 KODOMI
   - TIP受け取り: TIP額の10%相当のKODOMI
   - 特別イベント参加: 50-100 KODOMI

2. **特典設定の推奨**
   - 低価格特典: 100 KODOMI（エントリーユーザー向け）
   - 中価格特典: 300-500 KODOMI（アクティブユーザー向け）
   - 高価格特典: 1000+ KODOMI（コアファン向け）

3. **バランス調整**
   - 特典が簡単すぎず、難しすぎない設定
   - 週1回は特典交換できる程度の獲得機会提供
   - シーズンごとに限定特典を追加

---

## 今後の拡張可能性

### 1. ソーシャル機能

- **KODOMIランキング**: 月間獲得量でユーザーをランキング表示
- **フレンド比較**: 友達との貯蔵量を比較
- **ギルドシステム**: グループでKODOMIを貯めて集団特典獲得

### 2. AI連携

- **パーソナライズ特典**: AIがユーザーの好みに応じた特典を提案
- **自動調整**: ユーザーのエンゲージメント状況に応じてKODOMI獲得量を自動調整

### 3. メタバース連携

- **3D KODOMI TANK**: メタバース空間で視覚的に表示
- **KODOMI収集ゲーム**: AR/VRでKODOMIを集めるミニゲーム

---

## 法的・規制上の注意点

### ⚠️ 重要事項

1. **非資産性の明示**
   - KODOMIは資産価値を持たないことを利用規約に明記
   - ポイント制度であり、暗号資産ではないことを明確化

2. **譲渡・換金の禁止**
   - ユーザー間でのKODOMI譲渡を技術的に防止
   - 第三者サイトでの売買を禁止する規約設定

3. **有効期限の設定（オプション）**
   - 長期間未使用のKODOMIに有効期限を設ける
   - ポイント制度としての妥当性を保つ

4. **特典の明確化**
   - 何KODOMIで何が獲得できるか明示
   - 特典内容の変更可能性を規約に記載

---

## まとめ

**KODOMI TANK**と**KODOMI ゲージ**は、Gifterraプラットフォームにおけるユーザーエンゲージメントを「楽しく、わかりやすく、継続的に」促進するための中核システムです。

- **KODOMI TANK**: ユーザーの活動を数値化して貯蔵
- **KODOMI ゲージ**: 視覚的に進捗を表示し、達成感を提供

このシステムにより、ユーザーは「こども心」を持ってプラットフォームを楽しみ、クリエイターは熱心なファンとの深い関係を築くことができます。

---

**最終更新日**: 2025年12月1日
**バージョン**: 1.0
