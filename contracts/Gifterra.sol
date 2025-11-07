// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RankPlanRegistry.sol";

/**
 * @title Gifterra
 * @notice Gifterra Supporter SBT（ソウルバウンドトークン）
 *
 * 【コア機能】
 * - 投げ銭（tip）によるランクアップシステム
 * - ランクに応じたSBT自動更新（Burn & Mint）
 * - デイリーリワード（24時間ごとのトークン報酬）
 * - SBT特性（譲渡不可）
 *
 * 【特許対応】
 * このコントラクトは特許出願人による実装であり、
 * 投げ銭に基づく自動ランクアップ機能を含みます。
 */
contract Gifterra is ERC721Enumerable, Ownable {

    // ========================================
    // 状態変数
    // ========================================

    IERC20 public rewardToken;
    address public tipWallet;
    uint256 public dailyRewardAmount = 30 * 1e18;
    uint256 public maxRankLevel = 4; // デフォルト4段階（変更可能）

    mapping(address => uint256) public lastClaimed;
    mapping(address => uint256) public totalTips;
    mapping(address => uint256) public userNFTLevel;
    mapping(address => uint256) public userTokenId;
    mapping(uint256 => string) public rankNFTUris;
    mapping(uint256 => uint256) public rankThresholds;
    mapping(uint256 => string) public rankNames; // レベル → ランク名（テナントオーナーがカスタマイズ可能）

    uint256 public nextTokenId = 1;

    // ========================================
    // イベント
    // ========================================

    event DailyRewardClaimed(address indexed user, uint256 amount);
    event Tipped(address indexed from, uint256 amount);
    event NFTMinted(address indexed user, uint256 tokenId, uint256 level);
    event NFTBurned(address indexed user, uint256 tokenId);
    event MaxRankLevelUpdated(uint256 oldLevel, uint256 newLevel);
    event RankThresholdUpdated(uint256 indexed level, uint256 amount);
    event TipWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event RankNameUpdated(uint256 indexed level, string name);

    // ========================================
    // コンストラクタ
    // ========================================

    constructor(
        address _tokenAddress,
        address _tipWallet
    ) ERC721("Gifterra Supporter SBT", "GFTS") Ownable(msg.sender) {
        rewardToken = IERC20(_tokenAddress);
        tipWallet = _tipWallet;
    }

    // ========================================
    // 基本設定
    // ========================================

    function setRewardToken(address _addr) external onlyOwner {
        rewardToken = IERC20(_addr);
    }

    function setDailyRewardAmount(uint256 _amount) external onlyOwner {
        dailyRewardAmount = _amount;
    }

    /**
     * @notice TIP受取ウォレットアドレス変更
     * @dev テナントオーナーがTIP受取先を変更可能にする
     * @param _newTipWallet 新しいTIP受取ウォレットアドレス
     */
    function setTipWallet(address _newTipWallet) external onlyOwner {
        require(_newTipWallet != address(0), "Invalid tip wallet address");
        address oldWallet = tipWallet;
        tipWallet = _newTipWallet;
        emit TipWalletUpdated(oldWallet, _newTipWallet);
    }

    /**
     * @notice ランク数の設定
     * @dev CUSTOMプラン（運営デフォルトテナント・フルカスタムオーダー）向けの手動設定
     * @param _maxLevel 最大ランクレベル（1以上）
     */
    function setMaxRankLevel(uint256 _maxLevel) external onlyOwner {
        require(_maxLevel > 0, "Max level must be positive");
        uint256 oldLevel = maxRankLevel;
        maxRankLevel = _maxLevel;
        emit MaxRankLevelUpdated(oldLevel, _maxLevel);
    }

    /**
     * @notice ランク閾値の設定
     * @dev CUSTOMプラン向けの手動設定
     * @param level ランクレベル
     * @param amount 必要な累積投げ銭額
     */
    function setRankThreshold(uint256 level, uint256 amount) external onlyOwner {
        require(level > 0 && level <= maxRankLevel, "Invalid level");
        rankThresholds[level] = amount;
        emit RankThresholdUpdated(level, amount);
    }

    /**
     * @notice ランクNFTのURI設定
     * @dev CUSTOMプラン向けの手動設定
     * @param level ランクレベル
     * @param uri NFTのメタデータURI
     */
    function setNFTRankUri(uint256 level, string calldata uri) external onlyOwner {
        require(level > 0 && level <= maxRankLevel, "Invalid level");
        rankNFTUris[level] = uri;
    }

    /**
     * @notice ランク名の設定
     * @dev テナントオーナーが自由にランク名をカスタマイズ可能
     * @param level ランクレベル
     * @param name ランク名（例: "ブロンズ", "シルバー", "Gold Member"など）
     */
    function setRankName(uint256 level, string calldata name) external onlyOwner {
        require(level > 0 && level <= maxRankLevel, "Invalid level");
        require(bytes(name).length > 0, "Empty name");
        rankNames[level] = name;
        emit RankNameUpdated(level, name);
    }

    /**
     * @notice ランクプランで初期化
     * @dev GifterraFactoryから呼び出される、固定プラン制に対応
     * @param rankPlanRegistry RankPlanRegistryコントラクトアドレス
     * @param planType プランタイプ（LITE/STANDARD/PRO）
     */
    function initializeWithPlan(
        address rankPlanRegistry,
        RankPlanRegistry.PlanType planType
    ) external onlyOwner {
        RankPlanRegistry registry = RankPlanRegistry(rankPlanRegistry);
        RankPlanRegistry.RankPlan memory plan = registry.getPlan(planType);

        // 段階数を設定
        maxRankLevel = plan.stages;

        // 各レベルの閾値、URI、ランク名を設定
        for (uint256 i = 0; i < plan.stages; i++) {
            uint256 level = i + 1; // レベルは1始まり
            rankThresholds[level] = plan.thresholds[i];
            rankNFTUris[level] = plan.uriTemplates[i];
            rankNames[level] = plan.rankNames[i]; // デフォルトランク名も保存
        }

        emit MaxRankLevelUpdated(0, plan.stages);
    }

    // ========================================
    // リワード機能
    // ========================================

    /**
     * @notice デイリーリワード受取
     * @dev 24時間ごとに1回、固定額のトークンを受け取れる
     */
    function claimDailyReward() external {
        address user = msg.sender;
        require(block.timestamp - lastClaimed[user] >= 1 days, "Already claimed today");

        lastClaimed[user] = block.timestamp;
        require(rewardToken.transfer(user, dailyRewardAmount), "Transfer failed");
        emit DailyRewardClaimed(user, dailyRewardAmount);
    }

    // ========================================
    // 投げ銭機能
    // ========================================

    /**
     * @notice 投げ銭実行
     * @dev トークンを投げ銭し、累積額に応じて自動的にランクアップ
     * @param amount 投げ銭額
     */
    function tip(uint256 amount) external {
        address user = msg.sender;
        require(amount > 0, "Invalid amount");
        require(rewardToken.transferFrom(user, tipWallet, amount), "Transfer failed");

        totalTips[user] += amount;
        emit Tipped(user, amount);

        _updateRank(user);
    }

    // ========================================
    // ランクアップ処理
    // ========================================

    /**
     * @notice ランクアップ処理（内部関数）
     * @dev 累積投げ銭額に基づいてランクを計算し、必要に応じてSBTを更新
     */
    function _updateRank(address user) internal {
        uint256 total = totalTips[user];
        uint256 currentLevel = userNFTLevel[user];
        uint256 newLevel = _calcLevel(total);

        if (newLevel > currentLevel) {
            uint256 oldTokenId = userTokenId[user];

            // 旧NFTが存在する場合は先にBurn
            if (oldTokenId > 0 && _exists(oldTokenId)) {
                _burn(oldTokenId);
                emit NFTBurned(user, oldTokenId);
            }

            // 新NFTをMint
            uint256 tokenId = nextTokenId++;
            _safeMint(user, tokenId);
            userNFTLevel[user] = newLevel;
            userTokenId[user] = tokenId;

            emit NFTMinted(user, tokenId, newLevel);
        }
    }

    /**
     * @notice ランク計算
     * @dev 累積投げ銭額に基づいてランクを計算（1〜maxRankLevel）
     */
    function _calcLevel(uint256 total) internal view returns (uint256) {
        uint256 level = 0;
        for (uint256 i = 1; i <= maxRankLevel; i++) {
            if (total >= rankThresholds[i]) {
                level = i;
            }
        }
        return level;
    }

    // ========================================
    // メタデータ
    // ========================================

    /**
     * @notice トークンURI取得
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Invalid tokenId");
        uint256 level = tokenLevel(tokenId);
        return rankNFTUris[level];
    }

    /**
     * @notice トークンのレベル取得
     */
    function tokenLevel(uint256 tokenId) public view returns (uint256) {
        address owner = ownerOf(tokenId);
        return userNFTLevel[owner];
    }

    /**
     * @notice ランク名取得
     * @param level ランクレベル
     * @return ランク名（テナントオーナーがカスタマイズした名前）
     */
    function getRankName(uint256 level) public view returns (string memory) {
        require(level > 0 && level <= maxRankLevel, "Invalid level");
        return rankNames[level];
    }

    /**
     * @notice 全ランク名を取得
     * @return 全レベルのランク名配列
     */
    function getAllRankNames() public view returns (string[] memory) {
        string[] memory names = new string[](maxRankLevel);
        for (uint256 i = 0; i < maxRankLevel; i++) {
            names[i] = rankNames[i + 1]; // レベルは1始まり
        }
        return names;
    }

    // ========================================
    // SBT特性（譲渡・承認無効）
    // ========================================

    function approve(address, uint256) public pure override {
        revert("SBT non-transferable");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("SBT non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override {
        revert("SBT non-transferable");
    }

    function safeTransferFrom(address, address, uint256) public pure override {
        revert("SBT non-transferable");
    }

    // ========================================
    // View関数（外部連携用）
    // ========================================

    /**
     * @notice ユーザー情報取得
     * @dev 外部コントラクト（RandomRewardEngine等）から参照される
     */
    function userInfo(address user) external view returns (
        uint256 lastClaimedTime,
        uint256 totalTipAmount
    ) {
        return (lastClaimed[user], totalTips[user]);
    }

    /**
     * @notice 全ランク情報取得（UI用）
     * @dev フロントエンドが全ランクの閾値を一度に取得できる
     */
    function getAllRankThresholds() external view returns (uint256[] memory) {
        uint256[] memory thresholds = new uint256[](maxRankLevel);
        for (uint256 i = 1; i <= maxRankLevel; i++) {
            thresholds[i - 1] = rankThresholds[i];
        }
        return thresholds;
    }

    /**
     * @notice バージョン情報
     */
    function version() external pure returns (string memory) {
        return "Gifterra v1.1.0 - Variable Rank System";
    }
}
