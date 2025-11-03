// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title RandomRewardEngine v1
 * @notice ランダム報酬配布エンジン（コミットメント方式オフチェーン抽選）
 *
 * 【設計思想】
 * ===================
 * - 完全独立コントラクト（既存システムへの影響ゼロ）
 * - コミットメント方式で透明性確保
 * - 3つのトリガー対応（デイリー/マイルストーン/手動ガチャ）
 * - ランク別確率テーブル
 * - 将来的なVRF拡張を見据えた設計
 *
 * 【連携先】
 * - Gifterra (SBT): ユーザーランク参照（読み取りのみ）
 * - RewardNFT_v2: NFT配布実行（DISTRIBUTOR_ROLE必要）
 * - ERC20: トークン配布実行
 *
 * 【コミットメント方式】
 * 1. 運営が事前にシードのハッシュをコミット
 * 2. ユーザーが抽選実行時にシードを提供
 * 3. ハッシュ検証 + ユーザーアドレス混入で公平性確保
 */

interface IGifterra {
    function userNFTLevel(address user) external view returns (uint256);
    function totalTips(address user) external view returns (uint256);
}

interface IRewardNFT {
    function distributeMintBySku(
        address to,
        bytes32 sku,
        bytes32 triggerId
    ) external returns (uint256);
}

contract RandomRewardEngine is AccessControl, ReentrancyGuard, Pausable {
    // ロール定義
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");

    // トリガータイプ
    enum TriggerType {
        DAILY_REWARD,      // デイリーリワード連動
        TIP_MILESTONE,     // 投げ銭マイルストーン
        MANUAL_GACHA       // 手動ガチャ
    }

    // レアリティ
    enum Rarity {
        COMMON,    // 0
        RARE,      // 1
        SR,        // 2
        SSR        // 3
    }

    // 報酬タイプ
    enum RewardType {
        TOKEN,     // トークン報酬
        NFT        // NFT報酬
    }

    // 報酬プール（確率設定）
    struct RewardPool {
        uint256 commonWeight;
        uint256 rareWeight;
        uint256 srWeight;
        uint256 ssrWeight;
        bool isActive;
    }

    // トリガー設定
    struct TriggerConfig {
        bool enabled;
        uint256 cooldown;      // クールダウン時間（秒）
        uint256 costAmount;    // 実行コスト（トークン量）
        bool isActive;
    }

    // 報酬額設定（レアリティ別・ランク別）
    struct RewardAmount {
        uint256 tokenAmount;   // トークン報酬額
        bytes32 nftSku;        // NFT SKU
    }

    // 抽選履歴
    struct DrawHistory {
        address user;
        TriggerType triggerType;
        Rarity rarity;
        RewardType rewardType;
        uint256 rewardAmount;
        uint256 nftTokenId;
        bytes32 seed;
        uint256 timestamp;
        uint256 userRank;
    }

    // マイルストーン設定
    struct Milestone {
        uint256 tipThreshold;  // 必要な累積投げ銭額
        bool enabled;
    }

    // 連携先コントラクト
    IGifterra public gifterraSBT;
    IRewardNFT public rewardNFT;
    IERC20 public rewardToken;

    // トリガー別設定
    mapping(TriggerType => TriggerConfig) public triggerConfigs;

    // 確率テーブル（トリガー別・ランク別）
    // trigger => rank => RewardPool
    mapping(TriggerType => mapping(uint256 => RewardPool)) public rewardPools;

    // 報酬額設定（トリガー別・ランク別・レアリティ別）
    // trigger => rank => rarity => RewardAmount
    mapping(TriggerType => mapping(uint256 => mapping(Rarity => RewardAmount))) public rewardAmounts;

    // マイルストーン設定
    mapping(uint256 => Milestone) public milestones;
    uint256 public milestoneCount;

    // ユーザー状態管理
    mapping(address => mapping(TriggerType => uint256)) public lastDrawTime;
    mapping(address => mapping(uint256 => bool)) public milestoneDrawn;

    // コミットメント管理
    mapping(address => bytes32) public operatorSeedCommit;
    mapping(address => uint256) public commitTimestamp;
    mapping(bytes32 => bool) public usedSeeds;

    // 抽選履歴
    DrawHistory[] public drawHistory;
    mapping(address => uint256[]) public userDrawHistory;

    // 統計
    uint256 public totalDraws;
    mapping(TriggerType => uint256) public drawsByTrigger;
    mapping(Rarity => uint256) public drawsByRarity;

    // VRF拡張用（Phase 2）
    bool public vrfEnabled = false;
    uint256 public vrfThreshold;  // この額以上はVRF使用

    // イベント
    event SeedCommitted(address indexed operator, bytes32 seedHash, uint256 timestamp);
    event RewardDrawn(
        address indexed user,
        TriggerType triggerType,
        Rarity rarity,
        RewardType rewardType,
        uint256 rewardAmount,
        uint256 nftTokenId,
        uint256 userRank
    );
    event TriggerConfigUpdated(TriggerType triggerType, bool enabled);
    event RewardPoolUpdated(TriggerType triggerType, uint256 rank);
    event MilestoneAdded(uint256 indexed milestoneId, uint256 threshold);
    event MilestoneDrawn(address indexed user, uint256 indexed milestoneId);

    constructor(
        address _gifterraSBT,
        address _rewardNFT,
        address _rewardToken,
        address _owner
    ) {
        require(_gifterraSBT != address(0), "Invalid Gifterra address");
        require(_rewardNFT != address(0), "Invalid RewardNFT address");
        require(_rewardToken != address(0), "Invalid token address");
        require(_owner != address(0), "Invalid owner address");

        gifterraSBT = IGifterra(_gifterraSBT);
        rewardNFT = IRewardNFT(_rewardNFT);
        rewardToken = IERC20(_rewardToken);

        // ロール設定
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OPERATOR_ROLE, _owner);
        _grantRole(CONFIG_ROLE, _owner);

        // デフォルト設定
        _setupDefaultConfigs();
    }

    // ========================================
    // コミットメント関数
    // ========================================

    /**
     * @notice シードのハッシュをコミット（運営が事前実行）
     * @param seedHash シードのkeccak256ハッシュ
     */
    function commitSeed(bytes32 seedHash) external onlyRole(OPERATOR_ROLE) {
        require(seedHash != bytes32(0), "Invalid seed hash");

        operatorSeedCommit[msg.sender] = seedHash;
        commitTimestamp[msg.sender] = block.timestamp;

        emit SeedCommitted(msg.sender, seedHash, block.timestamp);
    }

    /**
     * @notice コミット済みシードの検証
     * @param seed 元のシード値
     * @param operator オペレーターアドレス
     */
    function _verifySeed(bytes32 seed, address operator) internal view returns (bool) {
        bytes32 seedHash = keccak256(abi.encodePacked(seed));
        return seedHash == operatorSeedCommit[operator];
    }

    // ========================================
    // 抽選実行関数（3つのトリガー）
    // ========================================

    /**
     * @notice デイリーリワード抽選
     * @param seed 運営が事前コミットしたシード
     * @param operator シードをコミットした運営アドレス
     */
    function drawDailyReward(bytes32 seed, address operator)
        external
        whenNotPaused
        nonReentrant
    {
        _executeDraw(msg.sender, TriggerType.DAILY_REWARD, seed, operator, 0);
    }

    /**
     * @notice 投げ銭マイルストーン抽選
     * @param milestoneId マイルストーンID
     * @param seed 運営が事前コミットしたシード
     * @param operator シードをコミットした運営アドレス
     */
    function drawTipMilestone(uint256 milestoneId, bytes32 seed, address operator)
        external
        whenNotPaused
        nonReentrant
    {
        require(milestones[milestoneId].enabled, "Milestone not enabled");
        require(!milestoneDrawn[msg.sender][milestoneId], "Already drawn");

        // 投げ銭額チェック
        uint256 totalTips = gifterraSBT.totalTips(msg.sender);
        require(totalTips >= milestones[milestoneId].tipThreshold, "Threshold not reached");

        milestoneDrawn[msg.sender][milestoneId] = true;
        emit MilestoneDrawn(msg.sender, milestoneId);

        _executeDraw(msg.sender, TriggerType.TIP_MILESTONE, seed, operator, milestoneId);
    }

    /**
     * @notice 手動ガチャ抽選
     * @param seed 運営が事前コミットしたシード
     * @param operator シードをコミットした運営アドレス
     */
    function drawManualGacha(bytes32 seed, address operator)
        external
        whenNotPaused
        nonReentrant
    {
        TriggerConfig memory config = triggerConfigs[TriggerType.MANUAL_GACHA];

        // コスト支払い
        if (config.costAmount > 0) {
            require(
                rewardToken.transferFrom(msg.sender, address(this), config.costAmount),
                "Cost payment failed"
            );
        }

        _executeDraw(msg.sender, TriggerType.MANUAL_GACHA, seed, operator, 0);
    }

    /**
     * @dev 抽選実行の共通ロジック
     */
    function _executeDraw(
        address user,
        TriggerType triggerType,
        bytes32 seed,
        address operator,
        uint256 milestoneId
    ) internal {
        // トリガー設定チェック
        TriggerConfig memory config = triggerConfigs[triggerType];
        require(config.isActive && config.enabled, "Trigger not active");

        // クールダウンチェック
        if (config.cooldown > 0) {
            require(
                block.timestamp >= lastDrawTime[user][triggerType] + config.cooldown,
                "Cooldown not elapsed"
            );
        }

        // シード検証
        require(_verifySeed(seed, operator), "Invalid seed");
        require(!usedSeeds[seed], "Seed already used");
        usedSeeds[seed] = true;

        // ユーザーランク取得
        uint256 userRank = gifterraSBT.userNFTLevel(user);
        require(userRank > 0, "User has no rank");

        // 確率テーブル取得
        RewardPool memory pool = rewardPools[triggerType][userRank];
        require(pool.isActive, "Reward pool not active");

        // ランダム抽選（コミットメント方式）
        Rarity rarity = _drawRarity(seed, user, pool);

        // 報酬配布
        (RewardType rewardType, uint256 rewardAmount, uint256 nftTokenId) =
            _distributeReward(user, triggerType, userRank, rarity, milestoneId);

        // 状態更新
        lastDrawTime[user][triggerType] = block.timestamp;
        totalDraws++;
        drawsByTrigger[triggerType]++;
        drawsByRarity[rarity]++;

        // 履歴記録
        DrawHistory memory history = DrawHistory({
            user: user,
            triggerType: triggerType,
            rarity: rarity,
            rewardType: rewardType,
            rewardAmount: rewardAmount,
            nftTokenId: nftTokenId,
            seed: seed,
            timestamp: block.timestamp,
            userRank: userRank
        });

        drawHistory.push(history);
        userDrawHistory[user].push(drawHistory.length - 1);

        emit RewardDrawn(user, triggerType, rarity, rewardType, rewardAmount, nftTokenId, userRank);
    }

    /**
     * @dev レアリティ抽選（重み付き乱数）
     */
    function _drawRarity(bytes32 seed, address user, RewardPool memory pool)
        internal
        view
        returns (Rarity)
    {
        uint256 totalWeight = pool.commonWeight + pool.rareWeight + pool.srWeight + pool.ssrWeight;
        require(totalWeight > 0, "No weights configured");

        // ユーザーアドレスとブロック情報を混入（特定ユーザー優遇防止）
        uint256 randomValue = uint256(
            keccak256(abi.encodePacked(seed, user, block.timestamp, block.number))
        ) % totalWeight;

        if (randomValue < pool.commonWeight) {
            return Rarity.COMMON;
        } else if (randomValue < pool.commonWeight + pool.rareWeight) {
            return Rarity.RARE;
        } else if (randomValue < pool.commonWeight + pool.rareWeight + pool.srWeight) {
            return Rarity.SR;
        } else {
            return Rarity.SSR;
        }
    }

    /**
     * @dev 報酬配布実行
     */
    function _distributeReward(
        address user,
        TriggerType triggerType,
        uint256 userRank,
        Rarity rarity,
        uint256 milestoneId
    ) internal returns (RewardType, uint256, uint256) {
        RewardAmount memory reward = rewardAmounts[triggerType][userRank][rarity];

        // トークン報酬とNFT報酬の両方が設定されている場合はランダム選択
        bool hasToken = reward.tokenAmount > 0;
        bool hasNFT = reward.nftSku != bytes32(0);

        if (hasToken && hasNFT) {
            // 50/50でどちらかを選択
            uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, user))) % 2;
            if (rand == 0) {
                hasNFT = false;
            } else {
                hasToken = false;
            }
        }

        if (hasNFT) {
            // NFT配布
            bytes32 triggerId = keccak256(abi.encodePacked(
                user,
                triggerType,
                milestoneId,
                block.timestamp
            ));

            uint256 tokenId = rewardNFT.distributeMintBySku(user, reward.nftSku, triggerId);
            return (RewardType.NFT, 0, tokenId);
        } else if (hasToken) {
            // トークン配布
            require(rewardToken.transfer(user, reward.tokenAmount), "Token transfer failed");
            return (RewardType.TOKEN, reward.tokenAmount, 0);
        } else {
            revert("No reward configured");
        }
    }

    // ========================================
    // 設定管理関数
    // ========================================

    /**
     * @notice トリガー設定更新
     */
    function setTriggerConfig(
        TriggerType triggerType,
        bool enabled,
        uint256 cooldown,
        uint256 costAmount
    ) external onlyRole(CONFIG_ROLE) {
        triggerConfigs[triggerType].enabled = enabled;
        triggerConfigs[triggerType].cooldown = cooldown;
        triggerConfigs[triggerType].costAmount = costAmount;
        triggerConfigs[triggerType].isActive = true;

        emit TriggerConfigUpdated(triggerType, enabled);
    }

    /**
     * @notice 報酬プール設定
     */
    function setRewardPool(
        TriggerType triggerType,
        uint256 rank,
        uint256 commonWeight,
        uint256 rareWeight,
        uint256 srWeight,
        uint256 ssrWeight
    ) external onlyRole(CONFIG_ROLE) {
        require(rank > 0 && rank <= 4, "Invalid rank");

        rewardPools[triggerType][rank] = RewardPool({
            commonWeight: commonWeight,
            rareWeight: rareWeight,
            srWeight: srWeight,
            ssrWeight: ssrWeight,
            isActive: true
        });

        emit RewardPoolUpdated(triggerType, rank);
    }

    /**
     * @notice 報酬額設定
     */
    function setRewardAmount(
        TriggerType triggerType,
        uint256 rank,
        Rarity rarity,
        uint256 tokenAmount,
        bytes32 nftSku
    ) external onlyRole(CONFIG_ROLE) {
        require(rank > 0 && rank <= 4, "Invalid rank");

        rewardAmounts[triggerType][rank][rarity] = RewardAmount({
            tokenAmount: tokenAmount,
            nftSku: nftSku
        });
    }

    /**
     * @notice マイルストーン追加
     */
    function addMilestone(uint256 tipThreshold) external onlyRole(CONFIG_ROLE) {
        uint256 milestoneId = milestoneCount++;
        milestones[milestoneId] = Milestone({
            tipThreshold: tipThreshold,
            enabled: true
        });

        emit MilestoneAdded(milestoneId, tipThreshold);
    }

    /**
     * @notice マイルストーン有効/無効切り替え
     */
    function setMilestoneEnabled(uint256 milestoneId, bool enabled)
        external
        onlyRole(CONFIG_ROLE)
    {
        require(milestoneId < milestoneCount, "Invalid milestone ID");
        milestones[milestoneId].enabled = enabled;
    }

    /**
     * @notice デフォルト設定
     */
    function _setupDefaultConfigs() internal {
        // デイリーリワード: 24時間クールダウン、無料
        triggerConfigs[TriggerType.DAILY_REWARD] = TriggerConfig({
            enabled: true,
            cooldown: 24 hours,
            costAmount: 0,
            isActive: true
        });

        // マイルストーン: クールダウンなし、無料
        triggerConfigs[TriggerType.TIP_MILESTONE] = TriggerConfig({
            enabled: true,
            cooldown: 0,
            costAmount: 0,
            isActive: true
        });

        // 手動ガチャ: クールダウンなし、100トークン
        triggerConfigs[TriggerType.MANUAL_GACHA] = TriggerConfig({
            enabled: true,
            cooldown: 0,
            costAmount: 100 * 1e18,
            isActive: true
        });
    }

    // ========================================
    // View関数
    // ========================================

    /**
     * @notice ユーザーの抽選履歴取得
     */
    function getUserDrawHistory(address user) external view returns (uint256[] memory) {
        return userDrawHistory[user];
    }

    /**
     * @notice 抽選履歴詳細取得
     */
    function getDrawHistoryDetail(uint256 index) external view returns (DrawHistory memory) {
        require(index < drawHistory.length, "Invalid index");
        return drawHistory[index];
    }

    /**
     * @notice 統計情報取得
     */
    function getStats() external view returns (
        uint256 total,
        uint256 daily,
        uint256 milestone,
        uint256 manual,
        uint256 common,
        uint256 rare,
        uint256 sr,
        uint256 ssr
    ) {
        return (
            totalDraws,
            drawsByTrigger[TriggerType.DAILY_REWARD],
            drawsByTrigger[TriggerType.TIP_MILESTONE],
            drawsByTrigger[TriggerType.MANUAL_GACHA],
            drawsByRarity[Rarity.COMMON],
            drawsByRarity[Rarity.RARE],
            drawsByRarity[Rarity.SR],
            drawsByRarity[Rarity.SSR]
        );
    }

    /**
     * @notice ユーザーがマイルストーン達成済みか確認
     */
    function canDrawMilestone(address user, uint256 milestoneId)
        external
        view
        returns (bool)
    {
        if (milestoneId >= milestoneCount) return false;
        if (!milestones[milestoneId].enabled) return false;
        if (milestoneDrawn[user][milestoneId]) return false;

        uint256 totalTips = gifterraSBT.totalTips(user);
        return totalTips >= milestones[milestoneId].tipThreshold;
    }

    /**
     * @notice デイリーリワード抽選可能か確認
     */
    function canDrawDaily(address user) external view returns (bool) {
        TriggerConfig memory config = triggerConfigs[TriggerType.DAILY_REWARD];
        if (!config.enabled || !config.isActive) return false;

        uint256 nextDrawTime = lastDrawTime[user][TriggerType.DAILY_REWARD] + config.cooldown;
        return block.timestamp >= nextDrawTime;
    }

    // ========================================
    // 管理機能
    // ========================================

    /**
     * @notice トークン引き出し（緊急用）
     */
    function withdrawToken(address recipient, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(recipient != address(0), "Invalid recipient");
        require(rewardToken.transfer(recipient, amount), "Transfer failed");
    }

    /**
     * @notice 緊急停止
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice バージョン情報
     */
    function version() external pure returns (string memory) {
        return "RandomRewardEngine v1.0.0 - Commitment-based Off-chain Random (VRF-ready)";
    }
}
