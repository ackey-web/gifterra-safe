const { ethers } = require("hardhat");

/**
 * ローカルノードでのテストスクリプト
 *
 * 使用方法:
 * 1. ターミナル1: npx hardhat node
 * 2. ターミナル2: npx hardhat run scripts/test-local.js --network localhost
 */

async function main() {
  console.log("========================================");
  console.log("Local Test: Factory + Tenant Creation");
  console.log("========================================\n");

  const [deployer, tenant1Admin, user1] = await ethers.getSigners();

  console.log("Test Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  Tenant1 Admin:", tenant1Admin.address);
  console.log("  User1:", user1.address);
  console.log();

  // 1. テスト用ERC20トークンをデプロイ
  console.log("1. Deploying Test ERC20 Token...");
  const TestToken = await ethers.getContractFactory("TestRewardToken");
  const testToken = await TestToken.deploy();
  await testToken.waitForDeployment();
  const tokenAddress = await testToken.getAddress();
  console.log("   ✅ Test Token deployed:", tokenAddress);
  console.log();

  // 2. Factoryをデプロイ
  console.log("2. Deploying GifterraFactory...");
  const deploymentFee = ethers.parseEther("0.01"); // 0.01 ETH
  const GifterraFactory = await ethers.getContractFactory("GifterraFactory");
  const factory = await GifterraFactory.deploy(deployer.address, deploymentFee);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   ✅ Factory deployed:", factoryAddress);
  console.log("   Deployment Fee:", ethers.formatEther(deploymentFee), "ETH");
  console.log();

  // 3. テナント作成
  console.log("3. Creating Tenant 1...");
  const tx = await factory.connect(tenant1Admin).createTenant(
    "Test Cafe A",
    tenant1Admin.address,
    tokenAddress,
    tenant1Admin.address,
    { value: deploymentFee }
  );
  const receipt = await tx.wait();

  // イベントから情報取得
  const tenantCreatedEvent = receipt.logs
    .map(log => {
      try {
        return factory.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .find(parsedLog => parsedLog && parsedLog.name === "TenantCreated");

  const {
    tenantId,
    gifterra,
    rewardNFT,
    payLitter,
    journeyPass,
    randomRewardEngine
  } = tenantCreatedEvent.args;

  console.log("   ✅ Tenant created!");
  console.log("   Tenant ID:", tenantId.toString());
  console.log("   Contracts:");
  console.log("     - Gifterra:", gifterra);
  console.log("     - RewardNFT_v2:", rewardNFT);
  console.log("     - PaySplitter:", payLitter);
  console.log("     - JourneyPass:", journeyPass);
  console.log("     - RandomRewardEngine:", randomRewardEngine);
  console.log();

  // 4. 可変ランク機能テスト
  console.log("4. Testing Variable Rank System...");
  const Gifterra = await ethers.getContractAt("Gifterra", gifterra);

  // 初期ランク数確認
  const initialMaxRank = await Gifterra.maxRankLevel();
  console.log("   Initial Max Rank Level:", initialMaxRank.toString());

  // ランク数を6に変更
  await Gifterra.connect(tenant1Admin).setMaxRankLevel(6);
  const newMaxRank = await Gifterra.maxRankLevel();
  console.log("   ✅ Max Rank Level changed to:", newMaxRank.toString());

  // 閾値設定
  console.log("   Setting rank thresholds...");
  await Gifterra.connect(tenant1Admin).setRankThreshold(1, ethers.parseEther("1000"));
  await Gifterra.connect(tenant1Admin).setRankThreshold(2, ethers.parseEther("5000"));
  await Gifterra.connect(tenant1Admin).setRankThreshold(3, ethers.parseEther("10000"));
  await Gifterra.connect(tenant1Admin).setRankThreshold(4, ethers.parseEther("50000"));
  await Gifterra.connect(tenant1Admin).setRankThreshold(5, ethers.parseEther("100000"));
  await Gifterra.connect(tenant1Admin).setRankThreshold(6, ethers.parseEther("500000"));

  // 全閾値取得
  const thresholds = await Gifterra.getAllRankThresholds();
  console.log("   ✅ All Rank Thresholds:");
  thresholds.forEach((threshold, i) => {
    console.log(`     Rank ${i + 1}: ${ethers.formatEther(threshold)} tokens`);
  });
  console.log();

  // 5. Factory統計確認
  console.log("5. Factory Statistics...");
  const stats = await factory.getGlobalStats();
  console.log("   Total Tenants:", stats.total.toString());
  console.log("   Active Tenants:", stats.active.toString());
  console.log("   Fees Collected:", ethers.formatEther(stats.feesCollected), "ETH");
  console.log();

  console.log("========================================");
  console.log("✅ All Tests Passed!");
  console.log("========================================");
  console.log("\nYou can now connect your frontend to:");
  console.log("  Factory Address:", factoryAddress);
  console.log("  Tenant ID: 1");
  console.log("\nAdd to .env:");
  console.log(`  VITE_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`  VITE_TENANT_ID=1`);
}

// TestRewardToken コントラクト（同じファイル内に定義）
// これをコンパイルするために、以下のコントラクトを contracts/ に作成する必要があります

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
