const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("========================================");
  console.log("Create New Tenant");
  console.log("========================================\n");

  console.log("Creating tenant with account:", deployer.address);
  console.log("Network:", network.name);

  // ネットワーク判定
  const isPolygon = network.name === "polygon" || network.name === "amoy";
  const nativeToken = isPolygon ? "MATIC" : "ETH";

  // 環境変数から設定取得
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const tenantName = process.env.TENANT_NAME || "Test Tenant";
  const tenantAdmin = process.env.TENANT_ADMIN || deployer.address;
  const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS;
  const tipWalletAddress = process.env.TIP_WALLET_ADDRESS || deployer.address;

  // 必須パラメータチェック
  if (!factoryAddress) {
    throw new Error("FACTORY_ADDRESS is required");
  }
  if (!rewardTokenAddress) {
    throw new Error("REWARD_TOKEN_ADDRESS is required");
  }

  console.log("\nConfiguration:");
  console.log("  Factory Address:", factoryAddress);
  console.log("  Tenant Name:", tenantName);
  console.log("  Tenant Admin:", tenantAdmin);
  console.log("  Reward Token:", rewardTokenAddress);
  console.log("  Tip Wallet:", tipWalletAddress);

  // Factory コントラクト接続
  const factory = await ethers.getContractAt("GifterraFactory", factoryAddress);

  // デプロイ手数料確認
  const deploymentFee = await factory.deploymentFee();
  console.log("\nDeployment Fee:", ethers.formatEther(deploymentFee), nativeToken);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Your Balance:", ethers.formatEther(balance), nativeToken);

  if (balance < deploymentFee) {
    throw new Error("Insufficient balance for deployment fee");
  }

  // テナント作成
  console.log("\nCreating tenant...");
  const tx = await factory.createTenant(
    tenantName,
    tenantAdmin,
    rewardTokenAddress,
    tipWalletAddress,
    { value: deploymentFee }
  );

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");

  // イベントから情報取得
  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .find((parsedLog) => parsedLog && parsedLog.name === "TenantCreated");

  if (!event) {
    throw new Error("TenantCreated event not found");
  }

  const {
    tenantId,
    admin,
    tenantName: createdName,
    gifterra,
    rewardNFT,
    payLitter,
    journeyPass,
    randomRewardEngine,
  } = event.args;

  console.log("\n========================================");
  console.log("Tenant Created Successfully!");
  console.log("========================================");
  console.log("Tenant ID:", tenantId.toString());
  console.log("Admin:", admin);
  console.log("Name:", createdName);
  console.log("\n--- Contract Addresses ---");
  console.log("Gifterra (SBT):", gifterra);
  console.log("RewardNFT_v2:", rewardNFT);
  console.log("PaySplitter:", payLitter);
  console.log("JourneyPass:", journeyPass);
  console.log("RandomRewardEngine:", randomRewardEngine);

  // テナント情報保存
  const tenantInfo = {
    network: network.name,
    timestamp: new Date().toISOString(),
    creator: deployer.address,
    tenantId: tenantId.toString(),
    admin: admin,
    tenantName: createdName,
    contracts: {
      gifterra: gifterra,
      rewardNFT: rewardNFT,
      payLitter: payLitter,
      journeyPass: journeyPass,
      randomRewardEngine: randomRewardEngine,
    },
    config: {
      rewardToken: rewardTokenAddress,
      tipWallet: tipWalletAddress,
    },
    transactionHash: tx.hash,
  };

  const outputDir = path.join(__dirname, "..", "deployments", "tenants");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(
    outputDir,
    `tenant-${tenantId}-${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(outputFile, JSON.stringify(tenantInfo, null, 2));

  console.log("\n✅ Tenant info saved to:", outputFile);

  // 次のステップ案内
  console.log("\n========================================");
  console.log("Next Steps");
  console.log("========================================");
  console.log("\n1. Configure Gifterra (SBT):");
  console.log(`   - Set rank thresholds: gifterra.setRankThreshold(level, amount)`);
  console.log(`   - Set NFT URIs: gifterra.setNFTRankUri(level, uri)`);
  console.log(`   - Transfer reward tokens to: ${gifterra}`);

  console.log("\n2. Configure RewardNFT_v2:");
  console.log(`   - Register SKUs: rewardNFT.registerSKU(sku, uri, maxSupply)`);
  console.log(
    `   - Grant DISTRIBUTOR_ROLE: rewardNFT.grantRole(DISTRIBUTOR_ROLE, distributorAddress)`
  );

  console.log("\n3. Configure RandomRewardEngine:");
  console.log(`   - Grant OPERATOR_ROLE: randomEngine.grantRole(OPERATOR_ROLE, operatorAddress)`);
  console.log(`   - Set reward pools: randomEngine.setRewardPool(trigger, rank, c, r, sr, ssr)`);
  console.log(`   - Set reward amounts: randomEngine.setRewardAmount(...)`);
  console.log(`   - Add milestones: randomEngine.addMilestone(threshold)`);
  console.log(`   - Transfer reward tokens to: ${randomRewardEngine}`);

  console.log("\n4. Set up Indexer:");
  console.log(`   - Update tools/indexer/.env with contract addresses`);
  console.log(`   - Run: pnpm indexer:dev`);

  console.log("\n5. Set up Distributor:");
  console.log(`   - Update tools/distributor/.env with contract addresses`);
  console.log(`   - Configure rules in tools/distributor/config/rules.json`);
  console.log(`   - Run: pnpm distributor:dev`);

  console.log("\nSee docs/FACTORY-DEPLOYMENT-GUIDE.md for detailed instructions.");

  // .env.example 生成（Indexer/Distributor用）
  const envExample = `# Indexer Configuration for Tenant ${tenantId}
GIFTERRA_ADDRESS=${gifterra}
REWARD_NFT_ADDRESS=${rewardNFT}
PAY_SPLITTER_ADDRESS=${payLitter}
JOURNEY_PASS_ADDRESS=${journeyPass}

RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
START_BLOCK=${receipt.blockNumber}
OUTPUT_DIR=./events
POLL_INTERVAL_MS=5000

# Distributor Configuration
DISTRIBUTOR_PRIVATE_KEY=YOUR_PRIVATE_KEY
INPUT_DIR=../indexer/events
STATE_DIR=./state
RULES_FILE=./config/rules.json
`;

  const envFile = path.join(outputDir, `tenant-${tenantId}.env.example`);
  fs.writeFileSync(envFile, envExample);

  console.log(`\n✅ .env example saved to: ${envFile}`);

  return tenantInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
