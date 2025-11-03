// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol"; // OZ実装に移行
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol"; // メタデータ更新イベント

/**
 * @title RewardNFT v2
 * @notice 通常NFT（譲渡可能）- 報酬器として機能（特許整合版・改善版）
 *
 * 【v1からの変更点】
 * ===================
 * 1. SKU型I/F追加（distributeMintBySku） - URI自動合成
 * 2. ERC-2981をOpenZeppelin実装に移行
 * 3. ベースURI合成機能（オプトイン）
 * 4. publicMint新版（amount指定）
 * 5. EIP-4906メタデータ更新イベント対応
 *
 * 【後方互換性】
 * ===================
 * - v1のすべてのI/Fを維持（deprecated付き）
 * - 既存の呼び出しは壊れない
 * - 段階的移行をサポート
 *
 * 【特許整合設計】
 * ===================
 * このコントラクトは特許出願人による実装であり、特許請求項に沿った
 * 「自動配布」機構を実装します。
 *
 * 【役割分離】
 * - このコントラクト：NFTの発行器（ミント実行とメタデータ提供に特化）
 * - GifterraDistributor：トリガ受領→ルール判定→配布実行の司令塔
 * - PaySplitter：支払い受け口（イベント発火）
 * - JourneyPass：フラグ付きNFT（状態保持）
 */
contract RewardNFT_v2 is
    ERC721,
    ERC721URIStorage,
    ERC2981, // OZ実装に移行
    AccessControl,
    ReentrancyGuard,
    Pausable,
    IERC4906 // メタデータ更新イベント
{
    // ロール定義
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant REVEALER_ROLE = keccak256("REVEALER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // 基本設定
    string private _baseTokenURI;
    uint256 private _nextTokenId = 1;
    uint256 public maxSupply;
    uint256 public mintPrice;
    bool public publicMintEnabled = false;

    // ベースURI合成モード（デフォルト: false = 従来の個別URI）
    bool public useBaseURIComposition = false;

    // SKU管理（ベースURI合成モード用）
    mapping(uint256 => bytes32) public tokenSku; // tokenId => SKU

    // GifterraDistributorアドレス（自動配布エンジン）
    address public distributorAddress;

    // メタデータ管理
    mapping(uint256 => bool) public isRevealed;
    string public preRevealURI;

    // ミント制限
    mapping(address => uint256) public mintedCount;
    uint256 public maxMintPerAddress;

    // 配布追跡（統計用）
    enum DistributionType {
        AUTOMATIC, // 0
        MANUAL,    // 1
        PUBLIC     // 2
    }

    struct DistributionRecord {
        address recipient;
        uint256 tokenId;
        uint256 timestamp;
        DistributionType distributionType; // enum化（ガス節約）
        bytes32 triggerId;
    }

    mapping(uint256 => DistributionRecord) public distributionRecords;
    uint256 public totalDistributions;

    // 統計情報
    uint256 public totalRevenue; // 注意：Splitter経由の運用ではここは使わない想定
    uint256 public automaticDistributionCount;
    uint256 public manualDistributionCount;

    // イベント
    event TokenMinted(
        address indexed to,
        uint256 indexed tokenId,
        string tokenURI,
        DistributionType distributionType
    );
    event AutomaticDistribution(
        address indexed distributor,
        address indexed recipient,
        uint256 indexed tokenId,
        bytes32 triggerId
    );
    event TokenRevealed(uint256 indexed tokenId, string newURI);
    event PublicMintStatusChanged(bool enabled);
    event MintPriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event RevenueWithdrawn(address recipient, uint256 amount);
    event DistributorUpdated(address indexed oldDistributor, address indexed newDistributor);
    event BaseURICompositionModeChanged(bool enabled);

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address owner,
        address _distributorAddress,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) ERC721(name, symbol) {
        require(owner != address(0), "Owner cannot be zero address");

        _baseTokenURI = baseURI;
        distributorAddress = _distributorAddress;
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        maxMintPerAddress = 10;

        // ロール設定
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(MINTER_ROLE, owner);
        _grantRole(REVEALER_ROLE, owner);
        _grantRole(PAUSER_ROLE, owner);

        // Distributorにミント権限を付与
        if (_distributorAddress != address(0)) {
            _grantRole(DISTRIBUTOR_ROLE, _distributorAddress);
        }

        // デフォルトロイヤリティ設定（2.5%）
        _setDefaultRoyalty(owner, 250);
    }

    // ========================================
    // 新I/F（v2推奨）
    // ========================================

    /**
     * @notice SKU型自動配布ミント（推奨）
     * @dev Distributorからの呼び出し専用・URI自動合成
     *
     * URIフォーマット: baseURI + "/" + skuHex + "/" + tokenId
     * 例: https://api.example.com/metadata/0x123abc/1
     *
     * @param to 受取人アドレス
     * @param sku 商品SKU（32バイト識別子）
     * @param triggerId トリガー識別子
     */
    function distributeMintBySku(
        address to,
        bytes32 sku,
        bytes32 triggerId
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(_checkSupplyLimit(), "Max supply reached");
        require(sku != bytes32(0), "Invalid SKU");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        // SKU記録
        tokenSku[tokenId] = sku;

        // ベースURI合成モードの場合はURIを設定しない（tokenURI関数で合成）
        // 個別URIモードの場合は空のまま（後でrevealで設定可能）
        if (!useBaseURIComposition) {
            // 個別URIモード：リビール待ち
            isRevealed[tokenId] = false;
        } else {
            // ベースURI合成モード：自動的にrevealedとみなす
            isRevealed[tokenId] = true;
        }

        // 配布記録
        distributionRecords[tokenId] = DistributionRecord({
            recipient: to,
            tokenId: tokenId,
            timestamp: block.timestamp,
            distributionType: DistributionType.AUTOMATIC,
            triggerId: triggerId
        });

        totalDistributions++;
        automaticDistributionCount++;

        emit AutomaticDistribution(msg.sender, to, tokenId, triggerId);
        emit TokenMinted(to, tokenId, _composeSKUBasedURI(sku, tokenId), DistributionType.AUTOMATIC);

        return tokenId;
    }

    /**
     * @notice SKU型バッチ自動配布ミント（推奨）
     */
    function distributeMintBatchBySku(
        address[] calldata recipients,
        bytes32 sku,
        bytes32 triggerId
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        require(recipients.length <= 50, "Batch size too large");
        require(recipients.length > 0, "Empty batch");
        require(sku != bytes32(0), "Invalid SKU");

        require(
            maxSupply == 0 || _nextTokenId + recipients.length - 1 <= maxSupply,
            "Batch exceeds max supply"
        );

        uint256[] memory tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");

            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);

            tokenSku[tokenId] = sku;

            if (!useBaseURIComposition) {
                isRevealed[tokenId] = false;
            } else {
                isRevealed[tokenId] = true;
            }

            distributionRecords[tokenId] = DistributionRecord({
                recipient: recipients[i],
                tokenId: tokenId,
                timestamp: block.timestamp,
                distributionType: DistributionType.AUTOMATIC,
                triggerId: triggerId
            });

            tokenIds[i] = tokenId;
            totalDistributions++;
            automaticDistributionCount++;

            emit AutomaticDistribution(msg.sender, recipients[i], tokenId, triggerId);
            emit TokenMinted(recipients[i], tokenId, _composeSKUBasedURI(sku, tokenId), DistributionType.AUTOMATIC);
        }

        return tokenIds;
    }

    /**
     * @notice 有料ミント新版（推奨）
     * @dev amount指定、URI自動合成
     */
    function publicMintV2(uint256 amount, bytes32 sku)
        external payable whenNotPaused nonReentrant {
        require(publicMintEnabled, "Public mint not enabled");
        require(mintPrice > 0, "Public mint not configured");
        require(amount > 0 && amount <= 10, "Invalid amount");
        require(msg.value >= mintPrice * amount, "Insufficient payment");
        require(
            maxSupply == 0 || _nextTokenId + amount - 1 <= maxSupply,
            "Exceeds max supply"
        );
        require(
            maxMintPerAddress == 0 || mintedCount[msg.sender] + amount <= maxMintPerAddress,
            "Mint limit exceeded"
        );
        require(sku != bytes32(0), "Invalid SKU");

        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);

            tokenSku[tokenId] = sku;

            if (useBaseURIComposition) {
                isRevealed[tokenId] = true;
            }

            distributionRecords[tokenId] = DistributionRecord({
                recipient: msg.sender,
                tokenId: tokenId,
                timestamp: block.timestamp,
                distributionType: DistributionType.PUBLIC,
                triggerId: bytes32(0)
            });

            totalDistributions++;

            emit TokenMinted(msg.sender, tokenId, _composeSKUBasedURI(sku, tokenId), DistributionType.PUBLIC);
        }

        mintedCount[msg.sender] += amount;
        totalRevenue += msg.value;
    }

    // ========================================
    // 旧I/F（v1互換・deprecated）
    // ========================================

    /**
     * @notice 自動配布ミント（v1互換）
     * @dev 非推奨：distributeMintBySkuを使用してください
     * @deprecated Use distributeMintBySku instead
     */
    function distributeMint(
        address to,
        string memory tokenURI,
        bytes32 triggerId
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(_checkSupplyLimit(), "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        if (bytes(tokenURI).length > 0) {
            _setTokenURI(tokenId, tokenURI);
            isRevealed[tokenId] = true;
        }

        distributionRecords[tokenId] = DistributionRecord({
            recipient: to,
            tokenId: tokenId,
            timestamp: block.timestamp,
            distributionType: DistributionType.AUTOMATIC,
            triggerId: triggerId
        });

        totalDistributions++;
        automaticDistributionCount++;

        emit AutomaticDistribution(msg.sender, to, tokenId, triggerId);
        emit TokenMinted(to, tokenId, tokenURI, DistributionType.AUTOMATIC);

        return tokenId;
    }

    /**
     * @notice バッチ自動配布ミント（v1互換）
     * @dev 非推奨：distributeMintBatchBySkuを使用してください
     * @deprecated Use distributeMintBatchBySku instead
     */
    function distributeMintBatch(
        address[] calldata recipients,
        string[] calldata tokenURIs,
        bytes32 triggerId
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        require(recipients.length == tokenURIs.length, "Array length mismatch");
        require(recipients.length <= 50, "Batch size too large");
        require(recipients.length > 0, "Empty batch");

        require(
            maxSupply == 0 || _nextTokenId + recipients.length - 1 <= maxSupply,
            "Batch exceeds max supply"
        );

        uint256[] memory tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");

            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);

            if (bytes(tokenURIs[i]).length > 0) {
                _setTokenURI(tokenId, tokenURIs[i]);
                isRevealed[tokenId] = true;
            }

            distributionRecords[tokenId] = DistributionRecord({
                recipient: recipients[i],
                tokenId: tokenId,
                timestamp: block.timestamp,
                distributionType: DistributionType.AUTOMATIC,
                triggerId: triggerId
            });

            tokenIds[i] = tokenId;
            totalDistributions++;
            automaticDistributionCount++;

            emit AutomaticDistribution(msg.sender, recipients[i], tokenId, triggerId);
            emit TokenMinted(recipients[i], tokenId, tokenURIs[i], DistributionType.AUTOMATIC);
        }

        return tokenIds;
    }

    /**
     * @notice 有料ミント（v1互換）
     * @dev 非推奨：publicMintV2を使用してください（フィッシング対策）
     * @deprecated Use publicMintV2 instead - user-provided URI is a phishing risk
     */
    function publicMint(string memory tokenURI)
        external payable whenNotPaused nonReentrant {
        require(publicMintEnabled, "Public mint not enabled");
        require(mintPrice > 0, "Public mint not configured");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_checkSupplyLimit(), "Max supply reached");
        require(
            maxMintPerAddress == 0 || mintedCount[msg.sender] < maxMintPerAddress,
            "Mint limit exceeded"
        );

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        mintedCount[msg.sender]++;
        totalRevenue += msg.value;

        if (bytes(tokenURI).length > 0) {
            _setTokenURI(tokenId, tokenURI);
            isRevealed[tokenId] = true;
        }

        distributionRecords[tokenId] = DistributionRecord({
            recipient: msg.sender,
            tokenId: tokenId,
            timestamp: block.timestamp,
            distributionType: DistributionType.PUBLIC,
            triggerId: bytes32(0)
        });

        totalDistributions++;

        emit TokenMinted(msg.sender, tokenId, tokenURI, DistributionType.PUBLIC);
    }

    // ========================================
    // 手動ミント（管理者用・変更なし）
    // ========================================

    function mint(
        address to,
        string memory tokenURI
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(_checkSupplyLimit(), "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        if (bytes(tokenURI).length > 0) {
            _setTokenURI(tokenId, tokenURI);
            isRevealed[tokenId] = true;
        }

        distributionRecords[tokenId] = DistributionRecord({
            recipient: to,
            tokenId: tokenId,
            timestamp: block.timestamp,
            distributionType: DistributionType.MANUAL,
            triggerId: bytes32(0)
        });

        totalDistributions++;
        manualDistributionCount++;

        emit TokenMinted(to, tokenId, tokenURI, DistributionType.MANUAL);
        return tokenId;
    }

    function mintBatch(
        address[] calldata recipients,
        string[] calldata tokenURIs
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(recipients.length == tokenURIs.length, "Array length mismatch");
        require(recipients.length <= 50, "Batch size too large");
        require(recipients.length > 0, "Empty batch");

        require(
            maxSupply == 0 || _nextTokenId + recipients.length - 1 <= maxSupply,
            "Batch exceeds max supply"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");

            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);

            if (bytes(tokenURIs[i]).length > 0) {
                _setTokenURI(tokenId, tokenURIs[i]);
                isRevealed[tokenId] = true;
            }

            distributionRecords[tokenId] = DistributionRecord({
                recipient: recipients[i],
                tokenId: tokenId,
                timestamp: block.timestamp,
                distributionType: DistributionType.MANUAL,
                triggerId: bytes32(0)
            });

            totalDistributions++;
            manualDistributionCount++;

            emit TokenMinted(recipients[i], tokenId, tokenURIs[i], DistributionType.MANUAL);
        }
    }

    // ========================================
    // リビール機能（EIP-4906対応）
    // ========================================

    function reveal(uint256 tokenId, string memory newURI)
        external onlyRole(REVEALER_ROLE) whenNotPaused {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!isRevealed[tokenId], "Token already revealed");

        _setTokenURI(tokenId, newURI);
        isRevealed[tokenId] = true;

        emit TokenRevealed(tokenId, newURI);
        emit MetadataUpdate(tokenId); // EIP-4906
    }

    function revealBatch(
        uint256[] calldata tokenIds,
        string[] calldata newURIs
    ) external onlyRole(REVEALER_ROLE) whenNotPaused {
        require(tokenIds.length == newURIs.length, "Array length mismatch");
        require(tokenIds.length <= 100, "Batch size too large");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_ownerOf(tokenIds[i]) != address(0), "Token does not exist");
            require(!isRevealed[tokenIds[i]], "Token already revealed");

            _setTokenURI(tokenIds[i], newURIs[i]);
            isRevealed[tokenIds[i]] = true;

            emit TokenRevealed(tokenIds[i], newURIs[i]);
            emit MetadataUpdate(tokenIds[i]); // EIP-4906
        }

        if (tokenIds.length > 1) {
            emit BatchMetadataUpdate(tokenIds[0], tokenIds[tokenIds.length - 1]); // EIP-4906
        }
    }

    // ========================================
    // 管理機能
    // ========================================

    function setDistributor(address newDistributor)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newDistributor != address(0), "Invalid distributor address");

        address oldDistributor = distributorAddress;

        if (oldDistributor != address(0)) {
            _revokeRole(DISTRIBUTOR_ROLE, oldDistributor);
        }

        distributorAddress = newDistributor;
        _grantRole(DISTRIBUTOR_ROLE, newDistributor);

        emit DistributorUpdated(oldDistributor, newDistributor);
    }

    function setDefaultRoyalty(address recipient, uint96 feeNumerator)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDefaultRoyalty(recipient, feeNumerator);
    }

    function setTokenRoyalty(uint256 tokenId, address recipient, uint96 feeNumerator)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenRoyalty(tokenId, recipient, feeNumerator);
    }

    function setBaseURICompositionMode(bool enabled)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        useBaseURIComposition = enabled;
        emit BaseURICompositionModeChanged(enabled);
    }

    function setBaseURI(string memory newBaseURI)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
    }

    function setPreRevealURI(string memory newPreRevealURI)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        preRevealURI = newPreRevealURI;
    }

    function setMintPrice(uint256 newPrice)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    function setMaxSupply(uint256 newMaxSupply)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newMaxSupply == 0 || newMaxSupply >= _nextTokenId - 1,
            "Cannot set below current supply"
        );
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    function setMaxMintPerAddress(uint256 newLimit)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxMintPerAddress = newLimit;
    }

    function setPublicMintEnabled(bool enabled)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        publicMintEnabled = enabled;
        emit PublicMintStatusChanged(enabled);
    }

    function withdraw(address recipient)
        external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(recipient).call{value: balance}("");
        require(success, "Withdrawal failed");

        emit RevenueWithdrawn(recipient, balance);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ========================================
    // View関数
    // ========================================

    function getDistributionRecord(uint256 tokenId)
        external view returns (DistributionRecord memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return distributionRecords[tokenId];
    }

    function getDistributionStats() external view returns (
        uint256 total,
        uint256 automatic,
        uint256 manual,
        uint256 currentSupply
    ) {
        return (
            totalDistributions,
            automaticDistributionCount,
            manualDistributionCount,
            _nextTokenId - 1
        );
    }

    function getStats() external view returns (
        uint256 totalSupply,
        uint256 currentMaxSupply,
        uint256 currentMintPrice,
        uint256 revenue,
        bool isPublicMintEnabled,
        bool isPaused,
        address currentDistributor
    ) {
        totalSupply = _nextTokenId - 1;
        currentMaxSupply = maxSupply;
        currentMintPrice = mintPrice;
        revenue = totalRevenue;
        isPublicMintEnabled = publicMintEnabled;
        isPaused = paused();
        currentDistributor = distributorAddress;
    }

    function _checkSupplyLimit() internal view returns (bool) {
        return maxSupply == 0 || _nextTokenId <= maxSupply;
    }

    // ========================================
    // URI合成ロジック
    // ========================================

    function _composeSKUBasedURI(bytes32 sku, uint256 tokenId) internal view returns (string memory) {
        if (!useBaseURIComposition) {
            return "";
        }

        // baseURI + "/" + skuHex + "/" + tokenId
        return string(abi.encodePacked(
            _baseTokenURI,
            "/",
            _toHexString(sku),
            "/",
            _toString(tokenId)
        ));
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId)
        public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "URI query for nonexistent token");

        // リビール前の場合はpreRevealURIを返す
        if (!isRevealed[tokenId] && bytes(preRevealURI).length > 0) {
            return preRevealURI;
        }

        // ベースURI合成モードの場合
        if (useBaseURIComposition && tokenSku[tokenId] != bytes32(0)) {
            return _composeSKUBasedURI(tokenSku[tokenId], tokenId);
        }

        // 従来の個別URI
        return super.tokenURI(tokenId);
    }

    // ========================================
    // ヘルパー関数
    // ========================================

    function _toHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = hexChars[uint8(data[i] >> 4)];
            str[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // ========================================
    // オーバーライド
    // ========================================

    function _burn(uint256 tokenId)
        internal virtual override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view virtual override(ERC721, ERC721URIStorage, ERC2981, AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IERC4906).interfaceId ||
               super.supportsInterface(interfaceId);
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    function version() external pure returns (string memory) {
        return "RewardNFT v2.0.0 - Patent Compliant Design (Backward Compatible)";
    }
}
