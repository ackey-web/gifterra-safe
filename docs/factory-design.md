# 🏭 Gifterra ファクトリーデプロイ機構設計書

## 概要
メインネット移行時に、導入ユーザーがワンタッチでGifterraリワードシステムをデプロイできる仕組み

## アーキテクチャ

### ファクトリーコントラクト
```solidity
contract GifterraFactory {
    address public metatronOwner;
    address public masterTemplate;
    mapping(address => address[]) public userContracts;
    
    event ContractDeployed(address indexed user, address indexed newContract);
    
    function deployGifterra(
        uint256 dailyRewardAmount,
        address tokenAddress,
        string memory projectName
    ) external returns (address) {
        // クローンファクトリーパターンでデプロイ
        address newContract = Clones.clone(masterTemplate);
        
        // 初期化（導入ユーザーをオーナーに設定）
        IGifterra(newContract).initialize(
            msg.sender,           // 導入ユーザーがオーナー
            dailyRewardAmount,
            tokenAddress,
            projectName
        );
        
        userContracts[msg.sender].push(newContract);
        emit ContractDeployed(msg.sender, newContract);
        
        return newContract;
    }
}
```

### フロントエンド管理構造の分離

#### 1. **METATRON管理画面** (管理者レベル)
- ファクトリーコントラクトの管理
- マスターテンプレートの更新
- 全体統計の監視

#### 2. **導入ユーザー管理画面** (プロジェクトレベル)
- 自分のコントラクトの管理
- リワード設定の変更
- プロジェクト固有の分析

## 実装フェーズ

### Phase 1: 現在のテストネット (進行中)
- 単一コントラクト + 管理画面の完成
- 機能テスト・UI/UX最適化

### Phase 2: ファクトリー準備
- コントラクトのproxy化・初期化機能追加
- 管理画面の権限分離設計
- ファクトリーコントラクト開発

### Phase 3: メインネット展開
- ファクトリーデプロイ
- 導入ユーザー向けデプロイ画面の作成
- プロジェクト別管理画面の提供

## 権限設計

### METATRONの権限
- ファクトリーコントラクトのオーナー
- マスターテンプレートの管理
- 全プロジェクトの統計閲覧

### 導入ユーザーの権限
- 自分のコントラクトのオーナー
- リワード金額・設定の変更
- 自プロジェクトの管理画面アクセス

### エンドユーザーの権限
- リワード請求
- 基本的な情報閲覧

## 技術的考慮事項

### コスト最適化
- EIP-1167 Minimal Proxy Contractを使用
- デプロイコストを最小化
- ガス効率的な初期化

### セキュリティ
- 各プロジェクトの完全な独立性
- オーナー権限の適切な分離
- アップグレード機構の検討

### スケーラビリティ
- 複数チェーンへの展開準備
- プロジェクト数に応じた管理画面の最適化
- インデックス・検索機能

## UI/UX設計

### 導入ユーザー向けデプロイ画面
1. プロジェクト情報入力
2. トークン設定
3. リワード設定
4. ワンクリックデプロイ
5. 管理画面へのリダイレクト

### プロジェクト管理画面
- 現在の管理画面をベースに、複数プロジェクト対応
- プロジェクト切り替え機能
- 統合ダッシュボード

## 収益モデル
- デプロイ手数料
- 月額管理費
- トランザクション手数料の一部
- プレミアム機能