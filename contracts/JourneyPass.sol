// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";

/**
 * @title JourneyPass v1.0.0 (FlaggedNFT)
 * @notice フラグ（スタンプ/状態）を保持するNFT
 *
 * 【用途】
 * - スタンプラリー用途を主とする
 * - 将来：契約/承認/KYC等にも拡張予定（v2以降）
 *
 * 【設計方針】
 * - 各トークンは256ビットのフラグを保持（0〜255のビット）
 * - フラグ更新は FLAG_SETTER_ROLE のみ可能（バックエンド/NFC検証用）
 * - 自動配布機能なし：イベント emit のみ（Distributor 連携は将来実装）
 * - 既存コントラクト（RewardNFT/PaySplitter）への依存なし
 *
 * 【役割分離】
 * - このコントラクト：フラグ保持・更新・照会・イベント発火
 * - GifterraDistributor（将来）：イベント購読・ルール判定・報酬配布
 * - RewardNFT/SBT（将来）：報酬NFTの発行先
 *
 * 【セキュリティ】
 * - Pausable：更新系は pause 中に revert
 * - ReentrancyGuard：更新系に適用
 * - 厳密な存在チェック：_requireOwned() 使用
 * - ロールベースアクセス制御
 *
 * 【将来の拡張（v2以降で検討）】
 * - 名前空間付きフラグ（namespace: bytes32 + bit）
 * - 有効期限/失効（expiry/revocation）
 * - 証拠ハッシュ/evidenceURI
 * - 転送ロック機能（完了まで転送不可）
 *
 * 【バージョン履歴】
 * v1.0.0 (初回リリース):
 * - 基本機能実装（mint, フラグ更新, view関数）
 * - 256ビットフラグのみ（単一名前空間）
 * - 転送制御なし（通常のERC721転送）
 */
contract JourneyPass is ERC721, AccessControl, Pausable, ReentrancyGuard, IERC4906 {
    // ========================================
    // ロール定義
    // ========================================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant FLAG_SETTER_ROLE = keccak256("FLAG_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ========================================
    // ストレージ
    // ========================================

    /// @notice 各トークンのフラグ（256ビット）
    mapping(uint256 => uint256) private _flags;

    /// @notice 最大供給量（0 = 無制限）
    uint256 public maxSupply;

    /// @notice 次に発行するトークンID
    uint256 private _nextTokenId = 1;

    /// @notice ベースURI
    string private _baseTokenURI;

    // ========================================
    // オプション機能：転送ロック（v1ではデフォルトOFF）
    // ========================================

    /// @notice 転送ロック機能の有効化フラグ（デフォルト: false）
    /// @dev v1では実装しないが、将来の拡張用にフィールドを予約
    bool public transferLockEnabled = false;

    /// @notice 完了とみなすために必要なフラグマスク（デフォルト: 全ビット）
    /// @dev transferLockEnabled が true の場合のみ使用
    uint256 public requiredFlagsMask = type(uint256).max;

    // ========================================
    // イベント
    // ========================================

    /**
     * @notice フラグ更新イベント（単一ビット）
     * @param tokenId トークンID
     * @param bit ビット位置（0〜255）
     * @param value 設定値（true: セット, false: クリア）
     * @param operator 操作者アドレス
     * @param traceId トレース識別子（NFC/注文ID等）
     */
    event FlagUpdated(
        uint256 indexed tokenId,
        uint8 indexed bit,
        bool value,
        address indexed operator,
        bytes32 traceId
    );

    /**
     * @notice フラグ一括更新イベント（マスク操作）
     * @param tokenId トークンID
     * @param setMask セットするビットマスク
     * @param clearMask クリアするビットマスク
     * @param operator 操作者アドレス
     * @param traceId トレース識別子
     */
    event FlagsBatchUpdated(
        uint256 indexed tokenId,
        uint256 setMask,
        uint256 clearMask,
        address indexed operator,
        bytes32 traceId
    );

    /**
     * @notice トークン発行イベント
     * @param to 受取人アドレス
     * @param tokenId トークンID
     */
    event JourneyPassMinted(address indexed to, uint256 indexed tokenId);

    /**
     * @notice 最大供給量更新イベント
     * @param newMaxSupply 新しい最大供給量
     */
    event MaxSupplyUpdated(uint256 newMaxSupply);

    // ========================================
    // コンストラクタ
    // ========================================

    /**
     * @notice コンストラクタ
     * @param name トークン名
     * @param symbol トークンシンボル
     * @param baseURI ベースURI
     * @param owner オーナーアドレス
     * @param _maxSupply 最大供給量（0 = 無制限）
     */
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
    // ミント機能
    // ========================================

    /**
     * @notice トークンを発行
     * @dev MINTER_ROLE のみ実行可能
     * @param to 受取人アドレス
     * @return tokenId 発行されたトークンID
     */
    function mint(address to)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(to != address(0), "Cannot mint to zero address");
        require(_checkSupplyLimit(), "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        emit JourneyPassMinted(to, tokenId);
        return tokenId;
    }

    /**
     * @notice トークンを一括発行
     * @dev MINTER_ROLE のみ実行可能
     * @param recipients 受取人アドレスの配列
     * @return tokenIds 発行されたトークンIDの配列
     */
    function mintBatch(address[] calldata recipients)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        require(recipients.length > 0, "Empty batch");
        require(recipients.length <= 50, "Batch size too large");
        require(
            maxSupply == 0 || _nextTokenId + recipients.length - 1 <= maxSupply,
            "Batch exceeds max supply"
        );

        tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");

            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);

            tokenIds[i] = tokenId;
            emit JourneyPassMinted(recipients[i], tokenId);
        }

        return tokenIds;
    }

    // ========================================
    // フラグ更新機能
    // ========================================

    /**
     * @notice 単一ビットのフラグを更新
     * @dev FLAG_SETTER_ROLE のみ実行可能
     * @param tokenId トークンID
     * @param bit ビット位置（0〜255）
     * @param value 設定値（true: セット, false: クリア）
     * @param traceId トレース識別子（NFC/注文ID等）
     */
    function setFlag(
        uint256 tokenId,
        uint8 bit,
        bool value,
        bytes32 traceId
    ) external onlyRole(FLAG_SETTER_ROLE) whenNotPaused nonReentrant {
        _requireOwned(tokenId); // 存在チェック

        if (value) {
            _flags[tokenId] |= (1 << bit); // ビットをセット
        } else {
            _flags[tokenId] &= ~(1 << bit); // ビットをクリア
        }

        emit FlagUpdated(tokenId, bit, value, msg.sender, traceId);
        emit MetadataUpdate(tokenId); // EIP-4906
    }

    /**
     * @notice マスクを使用してフラグを一括更新
     * @dev FLAG_SETTER_ROLE のみ実行可能
     * @param tokenId トークンID
     * @param setMask セットするビットマスク
     * @param clearMask クリアするビットマスク
     * @param traceId トレース識別子
     */
    function setFlagsByMask(
        uint256 tokenId,
        uint256 setMask,
        uint256 clearMask,
        bytes32 traceId
    ) external onlyRole(FLAG_SETTER_ROLE) whenNotPaused nonReentrant {
        _requireOwned(tokenId); // 存在チェック

        // setMask と clearMask が重複していないことを確認
        require((setMask & clearMask) == 0, "Set and clear masks overlap");

        _flags[tokenId] |= setMask;    // setMask のビットをセット
        _flags[tokenId] &= ~clearMask; // clearMask のビットをクリア

        emit FlagsBatchUpdated(tokenId, setMask, clearMask, msg.sender, traceId);
        emit MetadataUpdate(tokenId); // EIP-4906
    }

    // ========================================
    // View 関数
    // ========================================

    /**
     * @notice トークンのフラグを取得
     * @param tokenId トークンID
     * @return flags フラグ（256ビット）
     */
    function flagsOf(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);
        return _flags[tokenId];
    }

    /**
     * @notice 特定ビットのフラグが立っているか確認
     * @param tokenId トークンID
     * @param bit ビット位置（0〜255）
     * @return hasFlag フラグの状態
     */
    function hasFlag(uint256 tokenId, uint8 bit) external view returns (bool) {
        _requireOwned(tokenId);
        return (_flags[tokenId] & (1 << bit)) != 0;
    }

    /**
     * @notice フラグの進捗を取得
     * @param tokenId トークンID
     * @return setBits セットされているビット数
     * @return totalBits 総ビット数（常に256）
     */
    function progressOf(uint256 tokenId)
        external
        view
        returns (uint256 setBits, uint256 totalBits)
    {
        _requireOwned(tokenId);
        totalBits = 256;
        setBits = _countSetBits(_flags[tokenId]);
    }

    /**
     * @notice トークンが完了状態か確認
     * @dev requiredFlagsMask と比較して判定
     * @param tokenId トークンID
     * @return completed 完了状態
     */
    function isCompleted(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return (_flags[tokenId] & requiredFlagsMask) == requiredFlagsMask;
    }

    /**
     * @notice 現在の総供給量を取得
     * @return totalSupply 総供給量
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ========================================
    // 管理機能
    // ========================================

    /**
     * @notice ベースURIを設定
     * @param newBaseURI 新しいベースURI
     */
    function setBaseURI(string memory newBaseURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _baseTokenURI = newBaseURI;
    }

    /**
     * @notice 最大供給量を設定
     * @param newMaxSupply 新しい最大供給量（0 = 無制限）
     */
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

    /**
     * @notice 転送ロック機能を有効化/無効化（将来の拡張用）
     * @dev v1では実装なし。v2で転送制御を追加予定
     * @param enabled 有効化フラグ
     */
    function setTransferLockEnabled(bool enabled)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        transferLockEnabled = enabled;
        // v1では転送制御は実装しない（_beforeTokenTransfer をオーバーライドしない）
        // v2で実装する場合は、ここで emit イベント + _beforeTokenTransfer 追加
    }

    /**
     * @notice 完了とみなすフラグマスクを設定
     * @param mask フラグマスク
     */
    function setRequiredFlagsMask(uint256 mask)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        requiredFlagsMask = mask;
    }

    /**
     * @notice コントラクトを一時停止
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice コントラクトの一時停止を解除
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ========================================
    // 内部関数
    // ========================================

    /**
     * @notice ベースURIを取得
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice 供給制限をチェック
     */
    function _checkSupplyLimit() internal view returns (bool) {
        return maxSupply == 0 || _nextTokenId <= maxSupply;
    }

    /**
     * @notice セットされているビット数をカウント
     * @param flags フラグ
     * @return count セットされているビット数
     */
    function _countSetBits(uint256 flags) internal pure returns (uint256 count) {
        while (flags != 0) {
            count += flags & 1;
            flags >>= 1;
        }
    }

    // ========================================
    // オーバーライド
    // ========================================

    /**
     * @notice supportsInterface のオーバーライド
     */
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

    /**
     * @notice バージョン情報
     */
    function version() external pure returns (string memory) {
        return "JourneyPass v1.0.0 - Flagged NFT for Journey Tracking";
    }

    // ========================================
    // 将来の拡張予告（v2以降）
    // ========================================

    /**
     * @dev 【v2以降で検討】名前空間付きフラグ
     *
     * 現在のv1では単一の256ビット名前空間のみサポート。
     * v2では複数の名前空間を持つことで、異なるスタンプラリーや
     * 証明書タイプを同一トークンで管理できるようにする。
     *
     * 例：
     * - namespace: keccak256("StampRally2024")
     * - namespace: keccak256("KYCVerification")
     *
     * 提案インターフェース（実装しない）：
     * - setFlagNS(uint256 tokenId, bytes32 namespace, uint8 bit, bool value)
     * - flagsOfNS(uint256 tokenId, bytes32 namespace) returns (uint256)
     */

    /**
     * @dev 【v2以降で検討】有効期限/失効
     *
     * フラグに有効期限や失効機能を追加することで、
     * 期間限定のスタンプや証明書の有効期限管理が可能になる。
     *
     * 提案インターフェース（実装しない）：
     * - setFlagExpiry(uint256 tokenId, uint8 bit, uint256 expiryTimestamp)
     * - revokeFla(uint256 tokenId, uint8 bit, string reason)
     * - isFlagValid(uint256 tokenId, uint8 bit) returns (bool)
     */

    /**
     * @dev 【v2以降で検討】証拠ハッシュ/evidenceURI
     *
     * フラグ設定時に証拠（写真、文書ハッシュ等）を記録することで、
     * 監査可能性と信頼性を向上させる。
     *
     * 提案インターフェース（実装しない）：
     * - setFlagWithEvidence(uint256 tokenId, uint8 bit, bool value, bytes32 evidenceHash, string evidenceURI)
     * - getFlagEvidence(uint256 tokenId, uint8 bit) returns (bytes32 hash, string uri)
     */

    /**
     * @dev 【v2以降で検討】転送ロック機能
     *
     * 特定の条件（フラグ完了等）まで転送を制限することで、
     * スタンプラリー完了前の転売を防ぐ。
     *
     * v1では transferLockEnabled フラグを予約しているが、
     * _beforeTokenTransfer のオーバーライドは実装していない。
     *
     * v2での実装例：
     * function _beforeTokenTransfer(...) internal virtual override {
     *     if (transferLockEnabled && from != address(0) && to != address(0)) {
     *         require(isCompleted(tokenId), "Transfer locked until journey completed");
     *     }
     *     super._beforeTokenTransfer(...);
     * }
     */
}
