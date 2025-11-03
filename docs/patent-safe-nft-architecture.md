# ギフテラ特許回避型 通常NFTアーキテクチャ設計

## 概要
ギフテラの既存特許（請求項1〜3）に抵触しない形で、SBT（非譲渡ランクNFT）とは別に「通常NFT（譲渡可能）」をミント・転送できる独立したシステム設計。

## 特許回避の基本方針

### 特許対象機能（回避必須）
1. **自動配布ロジック**: NFT/トークンの属性に基づく報酬の自動配布
2. **状態フラグ制御**: 送信元NFTに対する状態フラグの付与・変更
3. **ランダム抽選**: 複数種類からのランダム選定ロジック
4. **報酬コンテンツ**: NFT、GLB、トークンの自動配布

### 回避戦略
- **完全分離アーキテクチャ**: ギフテラ本体と通常NFTを独立コントラクトとして実装
- **手動操作原則**: 全てのNFT操作をユーザー操作・外部UI操作に依存
- **データ参照のみ**: ギフテラ本体との連携は読み取り専用
- **ロジック非共有**: 内部処理を完全分離

## システムアーキテクチャ

### 1. アーキテクチャ概要図

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Gifterra Factory│    │  Gifterra Core  │    │ Standard NFT    │
│                 │    │   (SBT + 報酬)   │    │  (ERC-721)      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • 両方を同時生成  │◄──►│ • SBTミント      │    │ • 譲渡可能NFT    │
│ • アドレス管理   │    │ • 報酬配布       │    │ • マーケット対応  │
│ • 権限設定      │    │ • ランダム抽選    │    │ • メタデータ管理  │
│                 │    │ • 状態フラグ管理  │    │ • ロイヤリティ    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                        【データ参照のみ】
                    （自動処理・内部連携なし）
```

### 2. コントラクト間依存関係

```
GifterraFactory
├── createGifterraSystem() → GifterraCore + StandardNFT を生成
├── getSystemInfo() → 両方のアドレスを返却
└── 権限管理（Owner権限の移譲等）

GifterraCore (既存機能維持)
├── SBTミント・管理
├── 報酬配布ロジック（特許対象）
├── ランダム抽選（特許対象）  
├── 状態フラグ管理（特許対象）
└── StandardNFTアドレス参照（読み取り専用）

StandardNFT (完全独立)
├── ERC-721実装
├── 手動ミント機能
├── メタデータ管理
├── ロイヤリティ設定
├── マーケット連携
└── GifterraCoreアドレス参照（読み取り専用）
```

## コントラクト設計

### 1. GifterraFactory.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./GifterraCore.sol";
import "./StandardNFT.sol";

/**
 * @title GifterraFactory
 * @notice ギフテラシステム（Core + StandardNFT）を同時生成するFactory
 * 
 * 【特許回避設計】
 * - 各コントラクトを独立して生成（内部ロジック非共有）
 * - 自動処理なし、手動デプロイメントのみ
 * - データ参照関係のみ設定
 */
contract GifterraFactory {
    struct GifterraSystem {
        address gifterraCore;    // SBT + 報酬配布システム
        address standardNFT;     // 通常NFT（譲渡可能）
        address owner;           // システムオーナー
        string systemName;       // システム名
        uint256 createdAt;       // 作成日時
    }
    
    mapping(uint256 => GifterraSystem) public systems;
    uint256 public nextSystemId;
    
    event SystemCreated(
        uint256 indexed systemId,
        address indexed owner,
        address gifterraCore,
        address standardNFT,
        string systemName
    );
    
    /**
     * @notice ギフテラシステムを作成（Core + StandardNFT）
     * @dev 【特許回避】自動連携なし、独立したコントラクト生成のみ
     */
    function createGifterraSystem(
        string memory _systemName,
        string memory _nftName,
        string memory _nftSymbol,
        string memory _baseURI
    ) external returns (uint256 systemId, address coreAddress, address nftAddress) {
        systemId = nextSystemId++;
        
        // 1. GifterraCore（SBT + 報酬配布）を生成
        GifterraCore core = new GifterraCore(_systemName, msg.sender);
        coreAddress = address(core);
        
        // 2. StandardNFT（通常NFT）を独立生成
        // 【特許回避】内部ロジック非共有、自動処理なし
        StandardNFT nft = new StandardNFT(
            _nftName,
            _nftSymbol,
            _baseURI,
            msg.sender,
            coreAddress  // 参照用アドレスのみ（処理連携なし）
        );
        nftAddress = address(nft);
        
        // 3. 相互アドレス設定（データ参照のみ）
        // 【特許回避】読み取り専用、自動処理トリガーなし
        core.setStandardNFTAddress(nftAddress);
        
        // 4. システム情報保存
        systems[systemId] = GifterraSystem({
            gifterraCore: coreAddress,
            standardNFT: nftAddress,
            owner: msg.sender,
            systemName: _systemName,
            createdAt: block.timestamp
        });
        
        emit SystemCreated(systemId, msg.sender, coreAddress, nftAddress, _systemName);
    }
    
    /**
     * @notice システム情報取得
     */
    function getSystem(uint256 _systemId) external view returns (GifterraSystem memory) {
        return systems[_systemId];
    }
}
```

### 2. GifterraCore.sol（既存＋最小修正）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GifterraCore
 * @notice ギフテラ本体システム（SBT + 報酬配布）
 * 
 * 【特許対象機能】このコントラクトには以下の特許対象機能が含まれます：
 * - 請求項1: NFT属性に基づく報酬の自動配布、状態フラグ制御
 * - 請求項2: ランダム抽選による報酬選定
 * - 請求項3: NFT/GLB/トークンの自動配布
 */
contract GifterraCore is ERC721, AccessControl {
    // 【特許対象】SBT（非譲渡NFT）実装
    mapping(uint256 => bool) public soulbound;  // SBT制御
    mapping(uint256 => uint8) public nftRank;   // ランク管理
    mapping(uint256 => bool) public statusFlag; // 状態フラグ（請求項1対象）
    
    // StandardNFTアドレス（参照専用）
    // 【特許回避】読み取り専用、自動処理連携なし
    address public standardNFTAddress;
    
    // 【特許対象】報酬配布関連
    mapping(address => uint256) public lastClaimTime;
    mapping(uint256 => string) public glbRewardURIs;  // GLB報酬URL
    
    event RewardDistributed(address indexed user, uint256 rewardType, string content);
    event StatusFlagUpdated(uint256 indexed tokenId, bool newStatus); // 請求項1対象
    
    constructor(string memory _name, address _owner) ERC721(_name, "GIFTERRA") {
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
    }
    
    /**
     * @notice StandardNFTアドレス設定（参照用のみ）
     * @dev 【特許回避】データ参照のみ、自動処理トリガーなし
     */
    function setStandardNFTAddress(address _nftAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        standardNFTAddress = _nftAddress;
    }
    
    /**
     * @notice SBTミント
     * @dev 【特許対象】非譲渡NFTの発行
     */
    function mintSBT(address to, uint8 rank) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 tokenId = totalSupply() + 1;
        _safeMint(to, tokenId);
        soulbound[tokenId] = true;  // SBT化
        nftRank[tokenId] = rank;
    }
    
    /**
     * @notice 報酬配布（自動配布）
     * @dev 【特許対象】請求項1〜3の中核機能
     */
    function distributeReward(address user, uint256 nftTokenId) external {
        require(ownerOf(nftTokenId) == user, "Not NFT owner");
        
        // 【特許対象】状態フラグ制御（請求項1）
        statusFlag[nftTokenId] = true;
        emit StatusFlagUpdated(nftTokenId, true);
        
        // 【特許対象】ランダム抽選（請求項2）
        uint256 rewardType = _randomRewardSelection(nftTokenId);
        
        // 【特許対象】自動配布（請求項3）
        if (rewardType == 1) {
            // NFT報酬
            _distributeNFTReward(user);
        } else if (rewardType == 2) {
            // GLB報酬
            _distributeGLBReward(user, nftTokenId);
        } else {
            // トークン報酬
            _distributeTokenReward(user);
        }
        
        emit RewardDistributed(user, rewardType, "Auto distributed");
    }
    
    /**
     * @dev 【特許対象】ランダム選定ロジック（請求項2）
     */
    function _randomRewardSelection(uint256 seed) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, seed))) % 3 + 1;
    }
    
    /**
     * @dev 【特許対象】各種報酬配布（請求項3）
     */
    function _distributeNFTReward(address user) internal {
        // NFT報酬配布ロジック
    }
    
    function _distributeGLBReward(address user, uint256 tokenId) internal {
        // GLB報酬配布ロジック
        glbRewardURIs[tokenId] = "https://rewards.gifterra.com/glb/...";
    }
    
    function _distributeTokenReward(address user) internal {
        // トークン報酬配布ロジック
    }
    
    /**
     * @notice SBT転送禁止
     * @dev 【特許対象】非譲渡制御
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        require(!soulbound[tokenId] || from == address(0) || to == address(0), 
                "SBT: Transfer not allowed");
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
```

### 3. StandardNFT.sol（通常NFT - 完全独立）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title StandardNFT
 * @notice 通常NFT（譲渡可能）- ギフテラとは完全独立
 * 
 * 【特許回避設計】
 * - 自動配布機能なし（手動ミントのみ）
 * - 状態フラグ制御なし
 * - ランダム抽選なし
 * - GifterraCoreとの処理連携なし（参照のみ）
 * - ユーザー操作・外部UI操作による制御のみ
 */
contract StandardNFT is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard, IERC2981 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // 基本設定
    string private _baseTokenURI;
    uint256 private _nextTokenId = 1;
    uint256 public maxSupply;
    uint256 public mintPrice;
    
    // ロイヤリティ設定
    address public royaltyRecipient;
    uint96 public royaltyBasisPoints; // 10000 = 100%
    
    // GifterraCoreアドレス（参照専用）
    // 【特許回避】読み取り専用、自動処理なし
    address public gifterraCoreAddress;
    
    // メタデータ管理
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) public isRevealed;
    
    event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event TokenRevealed(uint256 indexed tokenId, string newURI);
    event RoyaltyUpdated(address recipient, uint96 basisPoints);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address owner,
        address _gifterraCoreAddress  // 参照用のみ
    ) ERC721(name, symbol) {
        _baseTokenURI = baseURI;
        gifterraCoreAddress = _gifterraCoreAddress;
        
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        _setupRole(MINTER_ROLE, owner);
        
        // デフォルトロイヤリティ設定（2.5%）
        royaltyRecipient = owner;
        royaltyBasisPoints = 250;
    }
    
    /**
     * @notice 手動ミント（管理者のみ）
     * @dev 【特許回避】自動配布なし、手動操作のみ
     */
    function mint(
        address to, 
        string memory tokenURI
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(maxSupply == 0 || _nextTokenId <= maxSupply, "Max supply reached");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        if (bytes(tokenURI).length > 0) {
            _setTokenURI(tokenId, tokenURI);
        }
        
        emit TokenMinted(to, tokenId, tokenURI);
        return tokenId;
    }
    
    /**
     * @notice バッチミント
     * @dev 【特許回避】手動バッチ処理、自動配布なし
     */
    function mintBatch(
        address[] calldata recipients,
        string[] calldata tokenURIs
    ) external onlyRole(MINTER_ROLE) nonReentrant {
        require(recipients.length == tokenURIs.length, "Array length mismatch");
        require(recipients.length <= 50, "Batch size too large");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            mint(recipients[i], tokenURIs[i]);
        }
    }
    
    /**
     * @notice 有料ミント（パブリック）
     * @dev 【特許回避】ユーザー操作による手動ミント
     */
    function publicMint(string memory tokenURI) external payable nonReentrant {
        require(mintPrice > 0, "Public mint not enabled");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(maxSupply == 0 || _nextTokenId <= maxSupply, "Max supply reached");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        
        if (bytes(tokenURI).length > 0) {
            _setTokenURI(tokenId, tokenURI);
        }
        
        emit TokenMinted(msg.sender, tokenId, tokenURI);
    }
    
    /**
     * @notice トークンURI更新（リビール機能）
     * @dev 【特許回避】手動操作によるメタデータ更新
     */
    function reveal(uint256 tokenId, string memory newURI) 
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        
        _setTokenURI(tokenId, newURI);
        isRevealed[tokenId] = true;
        
        emit TokenRevealed(tokenId, newURI);
    }
    
    /**
     * @notice ロイヤリティ設定
     */
    function setRoyalty(address recipient, uint96 basisPoints) 
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(recipient != address(0), "Invalid recipient");
        require(basisPoints <= 1000, "Royalty too high"); // 最大10%
        
        royaltyRecipient = recipient;
        royaltyBasisPoints = basisPoints;
        
        emit RoyaltyUpdated(recipient, basisPoints);
    }
    
    /**
     * @notice GifterraCoreの情報参照
     * @dev 【特許回避】読み取り専用、処理連携なし
     */
    function getGifterraCoreInfo() external view returns (address) {
        return gifterraCoreAddress;
    }
    
    /**
     * @notice ベースURI設定
     */
    function setBaseURI(string memory newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
    }
    
    /**
     * @notice 価格設定
     */
    function setMintPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = newPrice;
    }
    
    /**
     * @notice 最大供給量設定
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxSupply >= _nextTokenId - 1, "Cannot set below current supply");
        maxSupply = newMaxSupply;
    }
    
    /**
     * @notice 売上引き出し
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // ERC2981 ロイヤリティ
    function royaltyInfo(uint256, uint256 salePrice) 
        external view override returns (address, uint256) {
        uint256 royaltyAmount = (salePrice * royaltyBasisPoints) / 10000;
        return (royaltyRecipient, royaltyAmount);
    }
    
    // URI関連
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    function tokenURI(uint256 tokenId) 
        public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    // Interface support
    function supportsInterface(bytes4 interfaceId) 
        public view virtual override(ERC721, AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
    
    // 現在の供給量
    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }
}
```

## フロントエンド統合

### 1. 統合Hook設計

```typescript
// hooks/useGifterraSystem.ts
/**
 * ギフテラシステム統合Hook
 * 【特許回避】各コントラクトの独立操作、自動連携なし
 */
export const useGifterraSystem = (systemId: number) => {
  const [systemInfo, setSystemInfo] = useState<GifterraSystem | null>(null);
  
  // Factory経由でシステム情報取得
  const loadSystemInfo = useCallback(async () => {
    const factory = getFactoryContract();
    const info = await factory.getSystem(systemId);
    setSystemInfo(info);
  }, [systemId]);
  
  // GifterraCore操作（SBT + 報酬）
  const gifterraCore = useMemo(() => {
    if (!systemInfo?.gifterraCore) return null;
    return getGifterraCoreContract(systemInfo.gifterraCore);
  }, [systemInfo]);
  
  // StandardNFT操作（通常NFT）
  // 【特許回避】独立操作、自動処理なし
  const standardNFT = useMemo(() => {
    if (!systemInfo?.standardNFT) return null;
    return getStandardNFTContract(systemInfo.standardNFT);
  }, [systemInfo]);
  
  return {
    systemInfo,
    gifterraCore,
    standardNFT,
    loadSystemInfo
  };
};
```

### 2. UI分離設計

```typescript
// components/StandardNFTMinter.tsx
/**
 * 通常NFTミント用UI（ギフテラから独立）
 * 【特許回避】手動操作のみ、自動処理なし
 */
export const StandardNFTMinter: React.FC = () => {
  const { standardNFT } = useGifterraSystem(systemId);
  
  // 【特許回避】手動ミント（ユーザー操作）
  const handleMint = async () => {
    if (!standardNFT) return;
    
    try {
      const tx = await standardNFT.publicMint(tokenURI, {
        value: mintPrice
      });
      await tx.wait();
      
      alert('NFTをミントしました！');
    } catch (error) {
      console.error('Mint failed:', error);
    }
  };
  
  return (
    <div className="standard-nft-minter">
      <h3>通常NFTミント</h3>
      <p>【注意】これはギフテラの報酬システムとは独立したNFTです</p>
      <button onClick={handleMint}>
        手動でNFTをミント
      </button>
    </div>
  );
};
```

## デプロイメント手順

### 1. Factory経由デプロイ

```bash
# 1. Factoryデプロイ
npx hardhat run scripts/deploy-factory.js --network polygon-amoy

# 2. システム作成
npx hardhat run scripts/create-system.js --network polygon-amoy
```

### 2. デプロイスクリプト例

```javascript
// scripts/create-system.js
async function main() {
  const factory = await ethers.getContractAt("GifterraFactory", FACTORY_ADDRESS);
  
  // 【特許回避】独立システム作成
  const tx = await factory.createGifterraSystem(
    "MyGifterra",           // システム名
    "Standard Collection",  // NFT名
    "STANDARD",            // NFTシンボル
    "https://api.example.com/metadata/" // ベースURI
  );
  
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === 'SystemCreated');
  
  console.log('System created:');
  console.log('- Gifterra Core:', event.args.gifterraCore);
  console.log('- Standard NFT:', event.args.standardNFT);
}
```

## まとめ

### 特許回避の確認項目

✅ **完全分離**: GifterraCoreとStandardNFTが独立コントラクト  
✅ **自動処理なし**: 全てのNFT操作が手動・ユーザー操作  
✅ **内部ロジック非共有**: 処理ロジックを完全分離  
✅ **データ参照のみ**: アドレス参照以外の連携なし  
✅ **状態フラグ分離**: StandardNFTは状態フラグ制御なし  
✅ **ランダム抽選なし**: StandardNFTにランダム要素なし  
✅ **報酬配布分離**: StandardNFTは報酬配布機能なし  

### 運用上の注意点

1. **機能説明**: ユーザーに「通常NFT」と「ギフテラ報酬NFT」の違いを明示
2. **UI分離**: 各機能のUIを明確に分離して表示
3. **処理分離**: 自動連携処理を一切実装しない
4. **ドキュメント**: 特許回避設計をコメントで明記

この設計により、ギフテラの特許権を侵害することなく、通常NFTの機能を提供できます。