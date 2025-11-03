# UI Background Images

## デフォルト背景画像の設定

REWARD UIとTIP UIのデフォルト背景画像として使用するファイルを以下の場所に配置してください:

```
/public/ui-wallpaper.png
```

## 要件

- ファイル名: `ui-wallpaper.png`
- 推奨サイズ: 1920x1080 以上
- フォーマット: PNG, JPG, WebP など
- 容量: できるだけ軽量（500KB以下推奨）

## 使用方法

### REWARD UI
1. 背景画像ファイルを `/public/ui-wallpaper.png` として保存
2. 管理画面の「REWARD管理」→「Reward UI 背景画像設定」で確認可能
3. カスタム背景画像を設定しない場合、このデフォルト画像が使用されます

### TIP UI
1. 同じ `/public/ui-wallpaper.png` がデフォルトとして使用されます
2. 管理画面の「TIP管理」→「TIP UI 背景画像設定」で確認可能
3. REWARD UIとは別に、独自の背景画像を設定することも可能です

## カスタマイズ

管理画面からSupabaseに画像をアップロードして、各UIごとにカスタム背景画像を設定することもできます。

- REWARD UI: localStorage key `reward-bg-image`
- TIP UI: localStorage key `tip-bg-image`

## 現在のファイル状態

現在、`ui-wallpaper.png` は暫定的に `gifterra-logo.png` のコピーとして配置されています。
お好みの背景画像に置き換えてご使用ください。

### 例: 背景画像の置き換え

```bash
# お好みの背景画像を ui-wallpaper.png として配置
cp your-background-image.jpg /public/ui-wallpaper.png
```
