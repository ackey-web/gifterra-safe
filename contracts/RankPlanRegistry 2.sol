// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RankPlanRegistry
 * @notice プラットフォーム共通のランクプラン管理コントラクト
 *
 * 【デプロイモデル】
 * - グローバル単一インスタンス：Gifterraプラットフォーム全体で1つのみデプロイ
 * - スーパーアドミンがプランを一元管理
 *
 * 【設計理由】
 * - **ユーザー体験の統一**: 複数テナントで一貫したランク基準
 * - **管理コストの削減**: テナントごとのカスタマイズを制限
 * - **スコアシステムとの整合性**: 二軸スコアと同様、プラットフォーム共通の評価基準
 *
 * 【プラン種類】
 * - LITE: 3段階（シンプル）
 * - STANDARD: 5段階（標準）
 * - PRO: 7段階（詳細）
 */
contract RankPlanRegistry is AccessControl {
    // ========================================
    // 定数
    // ========================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");

    // ========================================
    // 型定義
    // ========================================

    /**
     * @notice プランタイプ列挙型
     */
    enum PlanType {
        STUDIO,         // 3段階: Beginner → Supporter → Champion
        STUDIO_PRO,     // 5段階: Beginner → Bronze → Silver → Gold → Platinum
        STUDIO_PRO_MAX, // 10段階: Beginner → Bronze → Silver → Gold → Platinum → Diamond → Ruby → Sapphire → Emerald → Legend
        CUSTOM          // カスタム: 運営デフォルトテナント・フルカスタムオーダー向け（手動設定）
    }

    /**
     * @notice ランクプラン構造体
     */
    struct RankPlan {
        string name;              // プラン名（例: "LITE Plan"）
        string description;       // プラン説明
        uint256 stages;           // 段階数
        uint256[] thresholds;     // 各レベルの閾値（JPYCベース、18 decimals）
        string[] rankNames;       // 各レベルの名前
        string[] uriTemplates;    // 各レベルのNFT URIテンプレート
        bool isActive;            // 有効フラグ
    }

    // ========================================
    // 状態変数
    // ========================================

    // プランタイプ → プラン詳細
    mapping(PlanType => RankPlan) public plans;

    // プラン使用統計
    mapping(PlanType => uint256) public planUsageCount;

    // ========================================
    // イベント
    // ========================================

    event PlanCreated(PlanType indexed planType, string name, uint256 stages);
    event PlanUpdated(PlanType indexed planType, string name);
    event PlanActivated(PlanType indexed planType);
    event PlanDeactivated(PlanType indexed planType);

    // ========================================
    // コンストラクタ
    // ========================================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SUPER_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // デフォルトプランを初期化
        _initializeDefaultPlans();
    }

    // ========================================
    // プラン初期化
    // ========================================

    /**
     * @notice デフォルトプランの初期化
     * @dev コンストラクタから呼び出される
     */
    function _initializeDefaultPlans() internal {
        // STUDIO Plan (3段階)
        {
            uint256[] memory thresholds = new uint256[](3);
            thresholds[0] = 0;              // Beginner: 0 JPYC
            thresholds[1] = 10000 * 1e18;   // Supporter: 10,000 JPYC
            thresholds[2] = 50000 * 1e18;   // Champion: 50,000 JPYC

            string[] memory rankNames = new string[](3);
            rankNames[0] = "Beginner";
            rankNames[1] = "Supporter";
            rankNames[2] = "Champion";

            string[] memory uriTemplates = new string[](3);
            uriTemplates[0] = "https://api.gifterra.com/rank/studio/beginner.json";
            uriTemplates[1] = "https://api.gifterra.com/rank/studio/supporter.json";
            uriTemplates[2] = "https://api.gifterra.com/rank/studio/champion.json";

            plans[PlanType.STUDIO] = RankPlan({
                name: "STUDIO Plan",
                description: unicode"シンプルな3段階ランクシステム。小規模テナント向け。",
                stages: 3,
                thresholds: thresholds,
                rankNames: rankNames,
                uriTemplates: uriTemplates,
                isActive: true
            });

            emit PlanCreated(PlanType.STUDIO, "STUDIO Plan", 3);
        }

        // STUDIO PRO Plan (5段階)
        {
            uint256[] memory thresholds = new uint256[](5);
            thresholds[0] = 0;              // Beginner: 0 JPYC
            thresholds[1] = 5000 * 1e18;    // Bronze: 5,000 JPYC
            thresholds[2] = 20000 * 1e18;   // Silver: 20,000 JPYC
            thresholds[3] = 50000 * 1e18;   // Gold: 50,000 JPYC
            thresholds[4] = 100000 * 1e18;  // Platinum: 100,000 JPYC

            string[] memory rankNames = new string[](5);
            rankNames[0] = "Beginner";
            rankNames[1] = "Bronze";
            rankNames[2] = "Silver";
            rankNames[3] = "Gold";
            rankNames[4] = "Platinum";

            string[] memory uriTemplates = new string[](5);
            uriTemplates[0] = "https://api.gifterra.com/rank/studio-pro/beginner.json";
            uriTemplates[1] = "https://api.gifterra.com/rank/studio-pro/bronze.json";
            uriTemplates[2] = "https://api.gifterra.com/rank/studio-pro/silver.json";
            uriTemplates[3] = "https://api.gifterra.com/rank/studio-pro/gold.json";
            uriTemplates[4] = "https://api.gifterra.com/rank/studio-pro/platinum.json";

            plans[PlanType.STUDIO_PRO] = RankPlan({
                name: "STUDIO PRO Plan",
                description: unicode"標準的な5段階ランクシステム。中規模テナント向け。",
                stages: 5,
                thresholds: thresholds,
                rankNames: rankNames,
                uriTemplates: uriTemplates,
                isActive: true
            });

            emit PlanCreated(PlanType.STUDIO_PRO, "STUDIO PRO Plan", 5);
        }

        // STUDIO PRO MAX Plan (10段階)
        {
            uint256[] memory thresholds = new uint256[](10);
            thresholds[0] = 0;                // Beginner: 0 JPYC
            thresholds[1] = 3000 * 1e18;      // Bronze: 3,000 JPYC
            thresholds[2] = 10000 * 1e18;     // Silver: 10,000 JPYC
            thresholds[3] = 30000 * 1e18;     // Gold: 30,000 JPYC
            thresholds[4] = 100000 * 1e18;    // Platinum: 100,000 JPYC
            thresholds[5] = 300000 * 1e18;    // Diamond: 300,000 JPYC
            thresholds[6] = 600000 * 1e18;    // Ruby: 600,000 JPYC
            thresholds[7] = 1000000 * 1e18;   // Sapphire: 1,000,000 JPYC
            thresholds[8] = 2000000 * 1e18;   // Emerald: 2,000,000 JPYC
            thresholds[9] = 5000000 * 1e18;   // Legend: 5,000,000 JPYC

            string[] memory rankNames = new string[](10);
            rankNames[0] = "Beginner";
            rankNames[1] = "Bronze";
            rankNames[2] = "Silver";
            rankNames[3] = "Gold";
            rankNames[4] = "Platinum";
            rankNames[5] = "Diamond";
            rankNames[6] = "Ruby";
            rankNames[7] = "Sapphire";
            rankNames[8] = "Emerald";
            rankNames[9] = "Legend";

            string[] memory uriTemplates = new string[](10);
            uriTemplates[0] = "https://api.gifterra.com/rank/studio-pro-max/beginner.json";
            uriTemplates[1] = "https://api.gifterra.com/rank/studio-pro-max/bronze.json";
            uriTemplates[2] = "https://api.gifterra.com/rank/studio-pro-max/silver.json";
            uriTemplates[3] = "https://api.gifterra.com/rank/studio-pro-max/gold.json";
            uriTemplates[4] = "https://api.gifterra.com/rank/studio-pro-max/platinum.json";
            uriTemplates[5] = "https://api.gifterra.com/rank/studio-pro-max/diamond.json";
            uriTemplates[6] = "https://api.gifterra.com/rank/studio-pro-max/ruby.json";
            uriTemplates[7] = "https://api.gifterra.com/rank/studio-pro-max/sapphire.json";
            uriTemplates[8] = "https://api.gifterra.com/rank/studio-pro-max/emerald.json";
            uriTemplates[9] = "https://api.gifterra.com/rank/studio-pro-max/legend.json";

            plans[PlanType.STUDIO_PRO_MAX] = RankPlan({
                name: "STUDIO PRO MAX Plan",
                description: unicode"最高峰の10段階ランクシステム。大規模テナント・長期運用向け。",
                stages: 10,
                thresholds: thresholds,
                rankNames: rankNames,
                uriTemplates: uriTemplates,
                isActive: true
            });

            emit PlanCreated(PlanType.STUDIO_PRO_MAX, "STUDIO PRO MAX Plan", 10);
        }
    }

    // ========================================
    // プラン取得
    // ========================================

    /**
     * @notice プラン詳細を取得
     * @param planType プランタイプ
     * @return プラン構造体
     */
    function getPlan(PlanType planType) external view returns (RankPlan memory) {
        RankPlan memory plan = plans[planType];
        require(plan.stages > 0, "Plan not found");
        require(plan.isActive, "Plan is not active");
        return plan;
    }

    /**
     * @notice 特定レベルの閾値を取得
     * @param planType プランタイプ
     * @param level レベル（0始まり）
     * @return 閾値（JPYC、18 decimals）
     */
    function getThreshold(PlanType planType, uint256 level) external view returns (uint256) {
        RankPlan memory plan = plans[planType];
        require(level < plan.stages, "Invalid level");
        return plan.thresholds[level];
    }

    /**
     * @notice 特定レベルのランク名を取得
     * @param planType プランタイプ
     * @param level レベル（0始まり）
     * @return ランク名
     */
    function getRankName(PlanType planType, uint256 level) external view returns (string memory) {
        RankPlan memory plan = plans[planType];
        require(level < plan.stages, "Invalid level");
        return plan.rankNames[level];
    }

    /**
     * @notice プラン使用回数を記録
     * @param planType プランタイプ
     */
    function recordPlanUsage(PlanType planType) external onlyRole(ADMIN_ROLE) {
        planUsageCount[planType]++;
    }

    // ========================================
    // プラン管理（スーパーアドミンのみ）
    // ========================================

    /**
     * @notice プラン更新
     * @param planType プランタイプ
     * @param name プラン名
     * @param description プラン説明
     * @param thresholds 閾値配列
     * @param rankNames ランク名配列
     * @param uriTemplates URIテンプレート配列
     */
    function updatePlan(
        PlanType planType,
        string calldata name,
        string calldata description,
        uint256[] calldata thresholds,
        string[] calldata rankNames,
        string[] calldata uriTemplates
    ) external onlyRole(SUPER_ADMIN_ROLE) {
        require(thresholds.length == rankNames.length, "Length mismatch");
        require(thresholds.length == uriTemplates.length, "Length mismatch");
        require(thresholds.length > 0, "Empty plan");

        plans[planType] = RankPlan({
            name: name,
            description: description,
            stages: thresholds.length,
            thresholds: thresholds,
            rankNames: rankNames,
            uriTemplates: uriTemplates,
            isActive: true
        });

        emit PlanUpdated(planType, name);
    }

    /**
     * @notice プラン有効化
     * @param planType プランタイプ
     */
    function activatePlan(PlanType planType) external onlyRole(SUPER_ADMIN_ROLE) {
        plans[planType].isActive = true;
        emit PlanActivated(planType);
    }

    /**
     * @notice プラン無効化
     * @param planType プランタイプ
     */
    function deactivatePlan(PlanType planType) external onlyRole(SUPER_ADMIN_ROLE) {
        plans[planType].isActive = false;
        emit PlanDeactivated(planType);
    }

    // ========================================
    // 統計情報
    // ========================================

    /**
     * @notice 全プラン使用統計を取得
     * @return STUDIO使用回数, STUDIO_PRO使用回数, STUDIO_PRO_MAX使用回数
     */
    function getPlanUsageStats() external view returns (uint256, uint256, uint256) {
        return (
            planUsageCount[PlanType.STUDIO],
            planUsageCount[PlanType.STUDIO_PRO],
            planUsageCount[PlanType.STUDIO_PRO_MAX]
        );
    }
}
