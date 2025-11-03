# 🚀 Gifterra System Evolution Roadmap

## 現在の状況分析

### アドレス確認 (2024年10月時点)
- **コントラクトオーナー**: `0x66f1274ad5d042b7571c2efa943370dbcd3459ab`
- **アドミン初期管理者**: `0x66f1274ad5d042b7571c2efa943370dbcd3459ab`
- **結論**: 現在は同一アドレス（METATRON管理）

### 現在のアーキテクチャ
```
[Polygon Amoy Testnet]
├── Gifterra Contract (0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC)
│   └── Owner: 0x66f1274ad5d042b7571c2efa943370dbcd3459ab
├── tNHT Token (0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea)
└── Frontend Admin System
    └── ADMIN_WALLETS: [0x66f1274ad5d042b7571c2efa943370dbcd3459ab]
```

## メインネット移行計画

### Phase 1: ファクトリーコントラクト開発
```solidity
// 提案されるファクトリー構造
contract GifterraFactory {
    address constant METATRON_OWNER = 0x66f1274ad5d042b7571c2efa943370dbcd3459ab;
    address public masterTemplate;
    
    struct ProjectInfo {
        address owner;        // 導入ユーザー（プロジェクトオーナー)
        address contractAddr; // デプロイされたコントラクト
        string name;         // プロジェクト名
        uint256 deployedAt;  // デプロイ時刻
    }
    
    mapping(address => ProjectInfo[]) public userProjects;
    ProjectInfo[] public allProjects;
    
    function deployGifterra(
        string memory projectName,
        uint256 dailyRewardAmount,
        address tokenAddress
    ) external returns (address newContract) {
        // Clone & Initialize
        newContract = Clones.clone(masterTemplate);
        IGifterra(newContract).initialize(
            msg.sender,           // 導入ユーザーがオーナーになる
            dailyRewardAmount,
            tokenAddress,
            projectName
        );
        
        // Record keeping
        ProjectInfo memory info = ProjectInfo({
            owner: msg.sender,
            contractAddr: newContract,
            name: projectName,
            deployedAt: block.timestamp
        });
        
        userProjects[msg.sender].push(info);
        allProjects.push(info);
    }
}
```

### Phase 2: フロントエンド権限分離

#### 1. METATRON管理画面 (`/admin/metatron`)
- ファクトリーコントラクト管理
- 全プロジェクト統計
- マスターテンプレート更新
- システム全体監視

**アクセス権限**: `METATRON_OWNER` のみ

#### 2. プロジェクト管理画面 (`/admin/project/:contractAddress`)
- 個別プロジェクトの管理
- リワード設定変更
- プロジェクト統計
- 緊急停止制御

**アクセス権限**: 各プロジェクトの `contractOwner`

#### 3. 導入ユーザー向けデプロイ画面 (`/deploy`)
- プロジェクト作成ウィザード
- ワンクリックデプロイ
- 初期設定ガイド

**アクセス権限**: 誰でもアクセス可能

### Phase 3: 権限管理システム

```typescript
// 提案される権限管理
interface UserRole {
  type: 'metatron' | 'project-owner' | 'end-user';
  permissions: string[];
  projectAddresses?: string[]; // プロジェクトオーナーの場合
}

const checkPermission = (userAddress: string, action: string): boolean => {
  const role = getUserRole(userAddress);
  
  switch (role.type) {
    case 'metatron':
      return true; // 全権限
    case 'project-owner':
      return role.permissions.includes(action) && 
             isValidProjectAccess(userAddress, action);
    case 'end-user':
      return ['claim-reward', 'view-stats'].includes(action);
    default:
      return false;
  }
};
```

## 技術的実装詳細

### 1. コントラクト修正点
- `Initializable` パターンの実装
- オーナー権限の移譲機能強化
- プロキシコントラクト対応

### 2. フロントエンド修正点
- 動的コントラクトアドレス対応
- 権限ベースルーティング
- プロジェクト切り替えUI

### 3. デプロイメント戦略
- Mainnet: Ethereum / Polygon
- Testnet: 充分なテスト期間
- ガス最適化: EIP-1167 Minimal Proxy

## 収益モデル設計

### 1. デプロイ手数料 
- 初回デプロイ: 0.1 ETH
- プレミアム機能: 追加料金

### 2. 運用手数料
- 月額管理費: $50/月
- トランザクション手数料: 1%

### 3. エンタープライズプラン
- カスタマイズ対応
- 専用サポート
- オンプレミス展開

## マイグレーション計画

### 既存ユーザー対応
1. 現在のテストネットコントラクトは維持
2. メインネット移行時の移行ツール提供
3. データ移行サポート

### 段階的移行
1. **Week 1-2**: ファクトリーコントラクト開発・テスト
2. **Week 3-4**: フロントエンド権限分離実装
3. **Week 5-6**: 統合テスト・セキュリティ監査
4. **Week 7-8**: メインネットデプロイ・正式サービス開始

## リスク分析と対策

### 技術リスク
- **スマートコントラクトバグ**: 監査・テスト強化
- **ガス価格変動**: 最適化・代替チェーン検討
- **スケーラビリティ**: Layer 2 活用

### ビジネスリスク  
- **導入ユーザー獲得**: マーケティング戦略
- **競合出現**: 差別化機能開発
- **規制対応**: コンプライアンス体制

この設計により、METATRONは中央管理者として全体を統括しつつ、各導入ユーザーは独立したプロジェクト管理権限を持つことができます。