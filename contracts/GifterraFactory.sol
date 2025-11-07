// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Gifterra.sol";
import "./RewardNFT_v2.sol";
import "./GifterraPaySplitter.sol";
import "./FlagNFT.sol";
import "./RandomRewardEngine.sol";
import "./RankPlanRegistry.sol";

/**
 * @title GifterraFactory
 * @notice マルチテナント対応Gifterraシステムファクトリー
 *
 * 【設計思想】
 * - スーパーアドミン：全テナント管理、統計監視、手数料管理
 * - テナントアドミン：自分のコントラクトセットのみ管理
 * - SaaS型アーキテクチャ：各テナントは完全に独立したコントラクトセットを持つ
 *
 * 【各テナントが持つコントラクト】
 * 1. Gifterra (SBT) - TIP＋ランク管理
 * 2. RewardNFT_v2 - 報酬NFT配布
 * 3. GifterraPaySplitter - 支払い受付
 * 4. FlagNFT - カテゴリ付きフラグNFT（スタンプラリー＋特典）
 * 5. RandomRewardEngine - ランダム報酬配布
 *
 * 【特許対応】
 * 特許出願人による実装。各テナントが自動配布機能を利用可能。
 *
 * 【ネットワーク対応】
 * - Testnet: Polygon Amoy
 * - Mainnet: Polygon Mainnet
 * - 推奨デプロイ手数料: 10 MATIC（約$9 @ $0.9/MATIC）
 *
 * @dev 本コントラクトが初回リリース版（V1相当）
 */
contract GifterraFactory is AccessControl, ReentrancyGuard, Pausable {

    // ========================================
    // ロール定義
    // ========================================

    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ========================================
    // テナント情報構造体
    // ========================================

    struct TenantContracts {
        address gifterra;           // Gifterra (SBT)
        address rewardNFT;          // RewardNFT_v2
        address payLitter;          // GifterraPaySplitter
        address flagNFT;            // FlagNFT
        address randomRewardEngine; // RandomRewardEngine
    }

    struct TenantInfo {
        uint256 tenantId;
        address admin;              // テナント管理者
        string tenantName;          // テナント名（店舗名等）
        TenantContracts contracts;  // デプロイされたコントラクト群
        uint256 createdAt;
        uint256 lastActivityAt;
        bool isActive;
        bool isPaused;
    }

    // ========================================
    // 状態変数
    // ========================================

    mapping(uint256 => TenantInfo) public tenants;
    mapping(address => uint256) public adminToTenantId;  // admin => tenantId
    mapping(address => bool) public isTenantContract;     // デプロイされたコントラクトの識別用

    uint256 public nextTenantId = 1;
    uint256 public totalTenants;
    uint256 public activeTenants;

    // 手数料設定
    uint256 public deploymentFee;
    address public feeRecipient;
    uint256 public totalFeesCollected;

    // テンプレート設定（デフォルト値）
    uint256 public defaultDailyRewardAmount = 30 * 1e18;
    uint256[] public defaultRankThresholds;  // [0, 1000, 5000, 10000, 50000]

    // ランクプランレジストリ（固定プラン制）
    address public rankPlanRegistry;

    // ========================================
    // イベント
    // ========================================

    event TenantCreated(
        uint256 indexed tenantId,
        address indexed admin,
        string tenantName,
        address gifterra,
        address rewardNFT,
        address payLitter,
        address flagNFT,
        address randomRewardEngine
    );

    event TenantStatusUpdated(uint256 indexed tenantId, bool isActive, bool isPaused);
    event TenantAdminTransferred(uint256 indexed tenantId, address indexed oldAdmin, address indexed newAdmin);
    event DeploymentFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address recipient, uint256 amount);

    // ========================================
    // コンストラクタ
    // ========================================

    /**
     * @notice Factory デプロイ
     * @param _feeRecipient 手数料受取アドレス
     * @param _deploymentFee テナント作成手数料（wei単位）
     *
     * 【推奨設定】
     * Polygon Amoy (Testnet): 10 MATIC = 10 * 10^18 wei
     * Polygon Mainnet: 10 MATIC = 10 * 10^18 wei
     *
     * 例：ethers.parseEther("10") で 10 MATIC
     */
    constructor(address _feeRecipient, uint256 _deploymentFee) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_deploymentFee > 0, "Fee must be positive");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SUPER_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        feeRecipient = _feeRecipient;
        deploymentFee = _deploymentFee;

        // デフォルトランク閾値設定
        defaultRankThresholds.push(0);
        defaultRankThresholds.push(1000 * 1e18);
        defaultRankThresholds.push(5000 * 1e18);
        defaultRankThresholds.push(10000 * 1e18);
        defaultRankThresholds.push(50000 * 1e18);
    }

    // ========================================
    // テナント作成（メイン機能）
    // ========================================

    /**
     * @notice 新規テナント作成
     * @dev 完全なコントラクトセットを一括デプロイ
     * @param tenantName テナント名
     * @param admin テナント管理者アドレス
     * @param rewardTokenAddress 報酬トークンアドレス
     * @param tipWalletAddress 投げ銭受取ウォレット
     * @param rankPlan ランクプラン（LITE/STANDARD/PRO）
     * @return tenantId 作成されたテナントID
     */
    function createTenant(
        string memory tenantName,
        address admin,
        address rewardTokenAddress,
        address tipWalletAddress,
        RankPlanRegistry.PlanType rankPlan
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(bytes(tenantName).length > 0, "Invalid tenant name");
        require(admin != address(0), "Invalid admin address");
        require(adminToTenantId[admin] == 0, "Admin already has tenant");
        require(msg.value >= deploymentFee, "Insufficient deployment fee");

        uint256 tenantId = nextTenantId++;

        // 1. Gifterra (SBT) デプロイ
        Gifterra gifterra = new Gifterra(rewardTokenAddress, tipWalletAddress);

        // 1-1. ランクプランで初期化（固定プラン制）
        // CUSTOM プランの場合はスキップ（手動設定を許可）
        if (rankPlanRegistry != address(0) && rankPlan != RankPlanRegistry.PlanType.CUSTOM) {
            gifterra.initializeWithPlan(rankPlanRegistry, rankPlan);

            // プラン使用回数を記録
            RankPlanRegistry(rankPlanRegistry).recordPlanUsage(rankPlan);
        }

        gifterra.transferOwnership(admin);

        // 2. RewardNFT_v2 デプロイ
        RewardNFT_v2 rewardNFT = new RewardNFT_v2(
            string(abi.encodePacked(tenantName, " Reward")),
            "REWARD",
            "https://api.gifterra.com/metadata/",
            admin,
            address(0),  // distributor は後で設定
            0,           // maxSupply無制限
            0            // mintPrice
        );

        // 3. GifterraPaySplitter デプロイ
        address[] memory payees = new address[](1);
        uint256[] memory shares = new uint256[](1);
        payees[0] = admin;
        shares[0] = 100;
        GifterraPaySplitter payLitter = new GifterraPaySplitter(payees, shares);

        // 4. FlagNFT デプロイ
        FlagNFT flagNFT = new FlagNFT(
            string(abi.encodePacked(tenantName, " Flag NFT")),
            "FNFT",
            "https://api.gifterra.com/flagnft/",
            admin
        );

        // 5. RandomRewardEngine デプロイ
        RandomRewardEngine randomEngine = new RandomRewardEngine(
            address(gifterra),
            address(rewardNFT),
            rewardTokenAddress,
            admin
        );

        // 権限設定：RandomRewardEngine に RewardNFT の DISTRIBUTOR_ROLE 付与
        bytes32 DISTRIBUTOR_ROLE = rewardNFT.DISTRIBUTOR_ROLE();
        rewardNFT.grantRole(DISTRIBUTOR_ROLE, address(randomEngine));

        // テナント情報保存
        tenants[tenantId] = TenantInfo({
            tenantId: tenantId,
            admin: admin,
            tenantName: tenantName,
            contracts: TenantContracts({
                gifterra: address(gifterra),
                rewardNFT: address(rewardNFT),
                payLitter: address(payLitter),
                flagNFT: address(flagNFT),
                randomRewardEngine: address(randomEngine)
            }),
            createdAt: block.timestamp,
            lastActivityAt: block.timestamp,
            isActive: true,
            isPaused: false
        });

        adminToTenantId[admin] = tenantId;
        totalTenants++;
        activeTenants++;

        // デプロイされたコントラクトをマーク
        isTenantContract[address(gifterra)] = true;
        isTenantContract[address(rewardNFT)] = true;
        isTenantContract[address(payLitter)] = true;
        isTenantContract[address(flagNFT)] = true;
        isTenantContract[address(randomEngine)] = true;

        // 手数料徴収
        totalFeesCollected += msg.value;

        emit TenantCreated(
            tenantId,
            admin,
            tenantName,
            address(gifterra),
            address(rewardNFT),
            address(payLitter),
            address(flagNFT),
            address(randomEngine)
        );

        return tenantId;
    }

    // ========================================
    // テナント管理（スーパーアドミン）
    // ========================================

    /**
     * @notice テナント停止/再開
     */
    function setTenantPaused(uint256 tenantId, bool paused)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(tenantId > 0 && tenantId < nextTenantId, "Invalid tenant ID");
        TenantInfo storage tenant = tenants[tenantId];
        tenant.isPaused = paused;

        emit TenantStatusUpdated(tenantId, tenant.isActive, paused);
    }

    /**
     * @notice テナント有効/無効切り替え
     */
    function setTenantActive(uint256 tenantId, bool active)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(tenantId > 0 && tenantId < nextTenantId, "Invalid tenant ID");
        TenantInfo storage tenant = tenants[tenantId];

        bool wasActive = tenant.isActive;
        tenant.isActive = active;

        if (wasActive && !active) {
            activeTenants--;
        } else if (!wasActive && active) {
            activeTenants++;
        }

        emit TenantStatusUpdated(tenantId, active, tenant.isPaused);
    }

    /**
     * @notice テナント管理者変更
     */
    function transferTenantAdmin(uint256 tenantId, address newAdmin)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(tenantId > 0 && tenantId < nextTenantId, "Invalid tenant ID");
        require(newAdmin != address(0), "Invalid new admin");
        require(adminToTenantId[newAdmin] == 0, "New admin already has tenant");

        TenantInfo storage tenant = tenants[tenantId];
        address oldAdmin = tenant.admin;

        delete adminToTenantId[oldAdmin];
        adminToTenantId[newAdmin] = tenantId;
        tenant.admin = newAdmin;

        emit TenantAdminTransferred(tenantId, oldAdmin, newAdmin);
    }

    // ========================================
    // 手数料管理
    // ========================================

    /**
     * @notice ランクプランレジストリアドレス設定
     * @param _rankPlanRegistry RankPlanRegistryコントラクトアドレス
     */
    function setRankPlanRegistry(address _rankPlanRegistry)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(_rankPlanRegistry != address(0), "Invalid address");
        rankPlanRegistry = _rankPlanRegistry;
    }

    /**
     * @notice デプロイ手数料変更
     */
    function setDeploymentFee(uint256 newFee)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        uint256 oldFee = deploymentFee;
        deploymentFee = newFee;
        emit DeploymentFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice 手数料引き出し
     */
    function withdrawFees()
        external
        onlyRole(SUPER_ADMIN_ROLE)
        nonReentrant
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = payable(feeRecipient).call{value: balance}("");
        require(success, "Withdrawal failed");

        emit FeesWithdrawn(feeRecipient, balance);
    }

    /**
     * @notice 手数料受取人変更
     */
    function setFeeRecipient(address newRecipient)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    // ========================================
    // View関数（統計情報）
    // ========================================

    /**
     * @notice テナント情報取得
     */
    function getTenantInfo(uint256 tenantId)
        external
        view
        returns (TenantInfo memory)
    {
        require(tenantId > 0 && tenantId < nextTenantId, "Invalid tenant ID");
        return tenants[tenantId];
    }

    /**
     * @notice テナント一覧取得（ページネーション）
     */
    function getTenantList(uint256 offset, uint256 limit)
        external
        view
        returns (TenantInfo[] memory)
    {
        require(limit > 0 && limit <= 100, "Invalid limit");
        uint256 end = offset + limit;
        if (end > nextTenantId) {
            end = nextTenantId;
        }

        uint256 resultCount = end > offset ? end - offset : 0;
        TenantInfo[] memory result = new TenantInfo[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = tenants[offset + i + 1];
        }

        return result;
    }

    /**
     * @notice 全体統計取得
     */
    function getGlobalStats()
        external
        view
        returns (
            uint256 total,
            uint256 active,
            uint256 feesCollected,
            uint256 currentFee
        )
    {
        return (
            totalTenants,
            activeTenants,
            totalFeesCollected,
            deploymentFee
        );
    }

    /**
     * @notice アドミンのテナントID取得
     */
    function getTenantIdByAdmin(address admin)
        external
        view
        returns (uint256)
    {
        return adminToTenantId[admin];
    }

    // ========================================
    // 緊急機能
    // ========================================

    function pause() external onlyRole(SUPER_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(SUPER_ADMIN_ROLE) {
        _unpause();
    }

    // ========================================
    // バージョン情報
    // ========================================

    function version() external pure returns (string memory) {
        return "GifterraFactoryV2 v1.0.0 - Multi-Tenant SaaS Architecture";
    }
}
