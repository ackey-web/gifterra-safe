// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Gifterra.sol";
import "./RankPlanRegistry.sol";

/**
 * @title GifterraFactoryLite v1.0.0
 * @notice マルチテナント対応Gifterraシステムファクトリー（最小版）
 *
 * 【ファクトリーがデプロイするコントラクト】
 * 1. Gifterra (SBT) - TIP＋ランク管理のコアコントラクト
 *
 * 【別途手動デプロイが必要なコントラクト】
 * - RewardNFT_v2: 報酬NFT配布
 * - GifterraPaySplitter: 支払い受付・分配
 * - FlagNFT: カテゴリ付きフラグNFT（スタンプラリー＋特典）
 * - RandomRewardEngine: ランダム報酬配布
 *
 * 【特許対応】
 * 特許出願人による実装。各テナントが自動配布機能を利用可能。
 *
 * 【ネットワーク対応】
 * - Testnet: Polygon Amoy
 * - Mainnet: Polygon Mainnet
 * - 推奨デプロイ手数料: 1 MATIC（低コスト運用）
 *
 * 【設計思想】
 * 契約サイズ制限（24KB）を回避するため、コアとなるGifterraのみをデプロイ。
 * 他コントラクトは手動デプロイでも1テナント約30円と安価なため実用的。
 */
contract GifterraFactoryLite is AccessControl, ReentrancyGuard, Pausable {

    // ========================================
    // ロール定義
    // ========================================

    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ========================================
    // テナント情報構造体
    // ========================================

    struct TenantContracts {
        address gifterra;           // Gifterra (SBT) - ファクトリーがデプロイ
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

    // ランクプランレジストリ
    address public rankPlanRegistry;

    // ========================================
    // イベント
    // ========================================

    event TenantCreated(
        uint256 indexed tenantId,
        address indexed admin,
        string tenantName,
        address gifterra
    );

    event TenantStatusUpdated(uint256 indexed tenantId, bool isActive, bool isPaused);
    event TenantAdminTransferred(uint256 indexed tenantId, address indexed oldAdmin, address indexed newAdmin);
    event DeploymentFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address recipient, uint256 amount);
    event RankPlanRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // ========================================
    // コンストラクタ
    // ========================================

    /**
     * @notice Factory デプロイ
     * @param _feeRecipient 手数料受取アドレス
     * @param _deploymentFee テナント作成手数料（wei単位）
     * @param _rankPlanRegistry RankPlanRegistryアドレス
     */
    constructor(
        address _feeRecipient,
        uint256 _deploymentFee,
        address _rankPlanRegistry
    ) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_deploymentFee > 0, "Fee must be positive");
        require(_rankPlanRegistry != address(0), "Invalid registry");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SUPER_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        feeRecipient = _feeRecipient;
        deploymentFee = _deploymentFee;
        rankPlanRegistry = _rankPlanRegistry;
    }

    // ========================================
    // テナント作成（メイン機能）
    // ========================================

    /**
     * @notice 新規テナント作成（Gifterraのみデプロイ）
     * @param tenantName テナント名
     * @param admin テナント管理者アドレス
     * @param rewardTokenAddress 報酬トークンアドレス
     * @param tipWalletAddress 投げ銭受取ウォレット
     * @param rankPlan ランクプラン
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

        // テナント情報を初期化
        TenantInfo storage tenant = tenants[tenantId];
        tenant.tenantId = tenantId;
        tenant.admin = admin;
        tenant.tenantName = tenantName;
        tenant.createdAt = block.timestamp;
        tenant.lastActivityAt = block.timestamp;
        tenant.isActive = true;
        tenant.isPaused = false;

        // Gifterra (SBT) デプロイ
        Gifterra gifterra = new Gifterra(rewardTokenAddress, tipWalletAddress);

        // ランクプラン初期化
        if (rankPlan != RankPlanRegistry.PlanType.CUSTOM) {
            gifterra.initializeWithPlan(rankPlanRegistry, rankPlan);
            RankPlanRegistry(rankPlanRegistry).recordPlanUsage(rankPlan);
        }

        // 所有権をテナント管理者に移譲
        gifterra.transferOwnership(admin);
        tenant.contracts.gifterra = address(gifterra);
        isTenantContract[address(gifterra)] = true;

        adminToTenantId[admin] = tenantId;
        totalTenants++;
        activeTenants++;
        totalFeesCollected += msg.value;

        emit TenantCreated(
            tenantId,
            admin,
            tenantName,
            tenant.contracts.gifterra
        );

        return tenantId;
    }

    // ========================================
    // テナント管理機能
    // ========================================

    function pauseTenant(uint256 tenantId) external onlyRole(SUPER_ADMIN_ROLE) {
        require(tenants[tenantId].isActive, "Tenant not active");
        tenants[tenantId].isPaused = true;
        emit TenantStatusUpdated(tenantId, tenants[tenantId].isActive, true);
    }

    function unpauseTenant(uint256 tenantId) external onlyRole(SUPER_ADMIN_ROLE) {
        require(tenants[tenantId].isActive, "Tenant not active");
        tenants[tenantId].isPaused = false;
        emit TenantStatusUpdated(tenantId, tenants[tenantId].isActive, false);
    }

    function deactivateTenant(uint256 tenantId) external onlyRole(SUPER_ADMIN_ROLE) {
        require(tenants[tenantId].isActive, "Already inactive");
        tenants[tenantId].isActive = false;
        activeTenants--;
        emit TenantStatusUpdated(tenantId, false, tenants[tenantId].isPaused);
    }

    function transferTenantAdmin(uint256 tenantId, address newAdmin) external {
        TenantInfo storage tenant = tenants[tenantId];
        require(msg.sender == tenant.admin || hasRole(SUPER_ADMIN_ROLE, msg.sender), "Not authorized");
        require(newAdmin != address(0), "Invalid new admin");
        require(adminToTenantId[newAdmin] == 0, "New admin already has tenant");

        address oldAdmin = tenant.admin;
        delete adminToTenantId[oldAdmin];
        tenant.admin = newAdmin;
        adminToTenantId[newAdmin] = tenantId;

        emit TenantAdminTransferred(tenantId, oldAdmin, newAdmin);
    }

    // ========================================
    // Factory管理機能
    // ========================================

    function setDeploymentFee(uint256 newFee) external onlyRole(SUPER_ADMIN_ROLE) {
        require(newFee > 0, "Fee must be positive");
        uint256 oldFee = deploymentFee;
        deploymentFee = newFee;
        emit DeploymentFeeUpdated(oldFee, newFee);
    }

    function setFeeRecipient(address newRecipient) external onlyRole(SUPER_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    function setRankPlanRegistry(address newRegistry) external onlyRole(SUPER_ADMIN_ROLE) {
        require(newRegistry != address(0), "Invalid registry");
        address oldRegistry = rankPlanRegistry;
        rankPlanRegistry = newRegistry;
        emit RankPlanRegistryUpdated(oldRegistry, newRegistry);
    }

    function withdrawFees() external onlyRole(SUPER_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = feeRecipient.call{value: balance}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(feeRecipient, balance);
    }

    function pause() external onlyRole(SUPER_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(SUPER_ADMIN_ROLE) {
        _unpause();
    }

    // ========================================
    // View 関数
    // ========================================

    function getTenantInfo(uint256 tenantId) external view returns (TenantInfo memory) {
        return tenants[tenantId];
    }

    function getTenantByAdmin(address admin) external view returns (TenantInfo memory) {
        uint256 tenantId = adminToTenantId[admin];
        require(tenantId > 0, "No tenant for this admin");
        return tenants[tenantId];
    }

    function version() external pure returns (string memory) {
        return "GifterraFactoryLite v1.0.0 - Minimal Edition";
    }
}
