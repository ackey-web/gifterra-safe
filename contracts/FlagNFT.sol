// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";

/**
 * @title FlagNFT v1.0.0
 * @notice カテゴリ付きフラグNFT（スタンプラリー + カテゴリ管理）
 *
 * 【重要】法務対応: 真のNFTとして実装
 * - オフチェーンDBではなくブロックチェーン上で管理
 * - "NFT"と呼ぶために必須: オンチェーン証明
 * - レアリティ機能なし（射幸心煽り防止）
 *
 * 【カテゴリ】
 * 0: BENEFIT        - 特典NFT (クーポン的)
 * 1: MEMBERSHIP     - 会員証NFT
 * 2: ACHIEVEMENT    - 実績バッジNFT
 * 3: CAMPAIGN       - キャンペーンNFT
 * 4: ACCESS_PASS    - アクセス権NFT
 * 5: COLLECTIBLE    - コレクティブルNFT
 *
 * 【設計方針】
 * - 各トークンは256ビットのフラグを保持（0〜255のビット）- スタンプラリー用
 * - カテゴリごとの使用制限・有効期限をオンチェーンで管理
 * - 譲渡可否をカテゴリごとに設定可能
 */
contract FlagNFT is ERC721, AccessControl, Pausable, ReentrancyGuard, IERC4906 {
    // ========================================
    // カテゴリ定義
    // ========================================

    enum Category {
        BENEFIT,      // 0: 特典NFT
        MEMBERSHIP,   // 1: 会員証NFT
        ACHIEVEMENT,  // 2: 実績バッジNFT
        CAMPAIGN,     // 3: キャンペーンNFT
        ACCESS_PASS,  // 4: アクセス権NFT
        COLLECTIBLE   // 5: コレクティブルNFT
    }

    // ========================================
    // ロール定義
    // ========================================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant FLAG_SETTER_ROLE = keccak256("FLAG_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ========================================
    // 構造体
    // ========================================

    /**
     * @notice NFT設定（カテゴリごと）
     */
    struct NFTConfig {
        Category category;
        uint8 usageLimit;           // 使用回数制限 (255=無制限, 0=表示のみ, N=N回まで)
        uint64 validFrom;           // 有効開始日時（UNIX timestamp）
        uint64 validUntil;          // 有効終了日時（0=無期限）
        bool isTransferable;        // 譲渡可能か
        string metadataURI;         // オフチェーン詳細情報へのURI（Supabase/IPFS）
    }

    /**
     * @notice NFT使用状況（トークンごと）
     */
    struct NFTUsage {
        uint8 usedCount;            // 使用回数
        uint64 lastUsedAt;          // 最終使用日時
    }

    // ========================================
    // ストレージ
    // ========================================

    /// @notice 各トークンのフラグ（256ビット） - スタンプラリー用
    mapping(uint256 => uint256) private _flags;

    /// @notice 最大供給量（0 = 無制限）
    uint256 public maxSupply;

    /// @notice 次に発行するトークンID
    uint256 private _nextTokenId = 1;

    /// @notice ベースURI
    string private _baseTokenURI;

    /// @notice 完了とみなすために必要なフラグマスク
    uint256 public requiredFlagsMask = type(uint256).max;

    /// @notice カテゴリごとの設定
    mapping(Category => NFTConfig) public categoryConfig;

    /// @notice トークンIDごとの使用状況
    mapping(uint256 => NFTUsage) public nftUsage;

    /// @notice トークンIDからカテゴリへのマッピング
    mapping(uint256 => Category) public tokenCategory;

    /// @notice カテゴリごとの総発行数
    mapping(Category => uint256) public categoryMintedCount;

    /// @notice カテゴリごとの発行上限（0=無制限）
    mapping(Category => uint256) public categoryMaxSupply;

    // ========================================
    // イベント
    // ========================================

    event FlagUpdated(
        uint256 indexed tokenId,
        uint8 indexed bit,
        bool value,
        address indexed operator,
        bytes32 traceId
    );

    event FlagsBatchUpdated(
        uint256 indexed tokenId,
        uint256 setMask,
        uint256 clearMask,
        address indexed operator,
        bytes32 traceId
    );

    event FlagNFTMinted(
        address indexed to,
        uint256 indexed tokenId,
        Category indexed category
    );

    event FlagNFTUsed(
        uint256 indexed tokenId,
        address indexed user,
        uint8 newUsedCount,
        uint64 usedAt
    );

    event CategoryConfigured(
        Category indexed category,
        uint8 usageLimit,
        uint64 validFrom,
        uint64 validUntil,
        bool isTransferable,
        string metadataURI
    );

    event CategoryMaxSupplySet(
        Category indexed category,
        uint256 maxSupply
    );

    event MaxSupplyUpdated(uint256 newMaxSupply);

    // ========================================
    // コンストラクタ
    // ========================================

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address owner,
        uint256 _maxSupply
    ) ERC721(name, symbol) {
        require(owner != address(0), "Owner cannot be zero address");

        _baseTokenURI = baseURI;
        maxSupply = _maxSupply;

        // ロール設定
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(MINTER_ROLE, owner);
        _grantRole(FLAG_SETTER_ROLE, owner);
        _grantRole(PAUSER_ROLE, owner);
    }

    // ========================================
    // カテゴリ設定（管理者のみ）
    // ========================================

    /**
     * @notice カテゴリ設定を登録/更新
     */
    function configureCategory(
        Category category,
        uint8 usageLimit,
        uint64 validFrom,
        uint64 validUntil,
        bool isTransferable,
        string memory metadataURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(validFrom > 0, "validFrom must be set");
        if (validUntil > 0) {
            require(validUntil > validFrom, "validUntil must be after validFrom");
        }

        categoryConfig[category] = NFTConfig({
            category: category,
            usageLimit: usageLimit,
            validFrom: validFrom,
            validUntil: validUntil,
            isTransferable: isTransferable,
            metadataURI: metadataURI
        });

        emit CategoryConfigured(
            category,
            usageLimit,
            validFrom,
            validUntil,
            isTransferable,
            metadataURI
        );
    }

    /**
     * @notice カテゴリごとの発行上限を設定
     */
    function setCategoryMaxSupply(Category category, uint256 _maxSupply)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _maxSupply == 0 || _maxSupply >= categoryMintedCount[category],
            "Cannot set below current supply"
        );
        categoryMaxSupply[category] = _maxSupply;
        emit CategoryMaxSupplySet(category, _maxSupply);
    }

    // ========================================
    // ミント機能（カテゴリ付き）
    // ========================================

    /**
     * @notice カテゴリ付きNFTを発行
     */
    function mintWithCategory(address to, Category category)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(to != address(0), "Cannot mint to zero address");
        require(_checkSupplyLimit(), "Max supply reached");
        require(categoryConfig[category].validFrom > 0, "Category not configured");

        uint256 maxCategorySupply = categoryMaxSupply[category];
        if (maxCategorySupply > 0) {
            require(categoryMintedCount[category] < maxCategorySupply, "Category max supply reached");
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        tokenCategory[tokenId] = category;
        categoryMintedCount[category]++;

        nftUsage[tokenId] = NFTUsage({
            usedCount: 0,
            lastUsedAt: 0
        });

        emit FlagNFTMinted(to, tokenId, category);
        return tokenId;
    }

    /**
     * @notice カテゴリ付きNFTを一括発行
     */
    function mintBatchWithCategory(address[] calldata recipients, Category category)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        require(recipients.length > 0, "Empty batch");
        require(recipients.length <= 50, "Batch size too large");
        require(categoryConfig[category].validFrom > 0, "Category not configured");

        uint256 maxCategorySupply = categoryMaxSupply[category];
        if (maxCategorySupply > 0) {
            require(
                categoryMintedCount[category] + recipients.length <= maxCategorySupply,
                "Batch exceeds category max supply"
            );
        }

        require(
            maxSupply == 0 || _nextTokenId + recipients.length - 1 <= maxSupply,
            "Batch exceeds max supply"
        );

        tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");

            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);

            tokenCategory[tokenId] = category;
            categoryMintedCount[category]++;

            nftUsage[tokenId] = NFTUsage({
                usedCount: 0,
                lastUsedAt: 0
            });

            tokenIds[i] = tokenId;
            emit FlagNFTMinted(recipients[i], tokenId, category);
        }

        return tokenIds;
    }

    // ========================================
    // 使用機能
    // ========================================

    /**
     * @notice NFTを使用（使用回数をインクリメント）
     */
    function useNFT(uint256 tokenId)
        external
        onlyRole(FLAG_SETTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        _requireOwned(tokenId);

        Category category = tokenCategory[tokenId];
        NFTConfig memory config = categoryConfig[category];
        NFTUsage storage usage = nftUsage[tokenId];

        require(block.timestamp >= config.validFrom, "NFT not yet valid");
        if (config.validUntil > 0) {
            require(block.timestamp <= config.validUntil, "NFT expired");
        }

        if (config.usageLimit < 255) {
            require(usage.usedCount < config.usageLimit, "Usage limit exceeded");
        }

        usage.usedCount++;
        usage.lastUsedAt = uint64(block.timestamp);

        emit FlagNFTUsed(tokenId, ownerOf(tokenId), usage.usedCount, uint64(block.timestamp));
    }

    // ========================================
    // フラグ更新機能（スタンプラリー用）
    // ========================================

    /**
     * @notice 単一ビットのフラグを更新
     */
    function setFlag(
        uint256 tokenId,
        uint8 bit,
        bool value,
        bytes32 traceId
    ) external onlyRole(FLAG_SETTER_ROLE) whenNotPaused nonReentrant {
        _requireOwned(tokenId);

        if (value) {
            _flags[tokenId] |= (1 << bit);
        } else {
            _flags[tokenId] &= ~(1 << bit);
        }

        emit FlagUpdated(tokenId, bit, value, msg.sender, traceId);
        emit MetadataUpdate(tokenId);
    }

    /**
     * @notice マスクを使用してフラグを一括更新
     */
    function setFlagsByMask(
        uint256 tokenId,
        uint256 setMask,
        uint256 clearMask,
        bytes32 traceId
    ) external onlyRole(FLAG_SETTER_ROLE) whenNotPaused nonReentrant {
        _requireOwned(tokenId);
        require((setMask & clearMask) == 0, "Set and clear masks overlap");

        _flags[tokenId] |= setMask;
        _flags[tokenId] &= ~clearMask;

        emit FlagsBatchUpdated(tokenId, setMask, clearMask, msg.sender, traceId);
        emit MetadataUpdate(tokenId);
    }

    // ========================================
    // View 関数
    // ========================================

    function getCategoryOf(uint256 tokenId) external view returns (Category) {
        _requireOwned(tokenId);
        return tokenCategory[tokenId];
    }

    function getUsageOf(uint256 tokenId)
        external
        view
        returns (uint8 usedCount, uint64 lastUsedAt)
    {
        _requireOwned(tokenId);
        NFTUsage memory usage = nftUsage[tokenId];
        return (usage.usedCount, usage.lastUsedAt);
    }

    function isValid(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);

        Category category = tokenCategory[tokenId];
        NFTConfig memory config = categoryConfig[category];

        if (block.timestamp < config.validFrom) return false;
        if (config.validUntil > 0 && block.timestamp > config.validUntil) return false;

        return true;
    }

    function canUse(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);

        Category category = tokenCategory[tokenId];
        NFTConfig memory config = categoryConfig[category];
        NFTUsage memory usage = nftUsage[tokenId];

        if (block.timestamp < config.validFrom) return false;
        if (config.validUntil > 0 && block.timestamp > config.validUntil) return false;

        if (config.usageLimit < 255 && usage.usedCount >= config.usageLimit) {
            return false;
        }

        return true;
    }

    function totalSupplyByCategory(Category category) external view returns (uint256) {
        return categoryMintedCount[category];
    }

    function flagsOf(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);
        return _flags[tokenId];
    }

    function hasFlag(uint256 tokenId, uint8 bit) external view returns (bool) {
        _requireOwned(tokenId);
        return (_flags[tokenId] & (1 << bit)) != 0;
    }

    function progressOf(uint256 tokenId)
        external
        view
        returns (uint256 setBits, uint256 totalBits)
    {
        _requireOwned(tokenId);
        totalBits = 256;
        setBits = _countSetBits(_flags[tokenId]);
    }

    function isCompleted(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return (_flags[tokenId] & requiredFlagsMask) == requiredFlagsMask;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        _requireOwned(tokenId);

        Category category = tokenCategory[tokenId];
        NFTConfig memory config = categoryConfig[category];

        if (bytes(config.metadataURI).length > 0) {
            return config.metadataURI;
        }

        return super.tokenURI(tokenId);
    }

    // ========================================
    // 管理機能
    // ========================================

    function setBaseURI(string memory newBaseURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _baseTokenURI = newBaseURI;
    }

    function setMaxSupply(uint256 newMaxSupply)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            newMaxSupply == 0 || newMaxSupply >= _nextTokenId - 1,
            "Cannot set below current supply"
        );
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    function setRequiredFlagsMask(uint256 mask)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        requiredFlagsMask = mask;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ========================================
    // 転送制御（オーバーライド）
    // ========================================

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);

        if (from == address(0) || to == address(0)) {
            return;
        }

        Category category = tokenCategory[firstTokenId];
        NFTConfig memory config = categoryConfig[category];
        require(config.isTransferable, "This NFT category is not transferable");
    }

    // ========================================
    // 内部関数
    // ========================================

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function _checkSupplyLimit() internal view returns (bool) {
        return maxSupply == 0 || _nextTokenId <= maxSupply;
    }

    function _countSetBits(uint256 flags) internal pure returns (uint256 count) {
        while (flags != 0) {
            count += flags & 1;
            flags >>= 1;
        }
    }

    // ========================================
    // オーバーライド
    // ========================================

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC4906).interfaceId ||
               super.supportsInterface(interfaceId);
    }

    function version() external pure returns (string memory) {
        return "FlagNFT v1.0.0 - Category-based Flagged NFT";
    }
}
