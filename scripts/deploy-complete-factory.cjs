const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Complete Factory Deployment Script
 *
 * This script deploys:
 * 1. RankPlanRegistry (global singleton)
 * 2. GifterraFactory
 * 3. Links them together
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("========================================");
  console.log("Complete Gifterra Factory Deployment");
  console.log("========================================\n");

  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance), network.name === "polygon_mainnet" || network.name === "polygon_amoy" ? "MATIC" : "ETH");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId, "\n");

  // ========================================
  // Configuration
  // ========================================

  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log("Fee recipient:", feeRecipient);

  // JPYCトークンアドレス（ガスレス決済用）
  const jpycAddress = process.env.JPYC_MAINNET_ADDRESS || "0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c";
  console.log("JPYC Token address:", jpycAddress);

  // デプロイ手数料設定（環境変数またはネットワーク別デフォルト）
  let deploymentFee;
  if (process.env.DEPLOYMENT_FEE) {
    deploymentFee = ethers.utils.parseEther(process.env.DEPLOYMENT_FEE);
  } else {
    // ネットワーク別デフォルト設定
    if (network.name === "polygon_mainnet" || network.name === "polygon_amoy") {
      deploymentFee = ethers.utils.parseEther("10");  // 10 MATIC
      console.log("Using Polygon default fee: 10 MATIC");
    } else if (network.name === "localhost" || network.name === "hardhat") {
      deploymentFee = ethers.utils.parseEther("0.01");  // 0.01 ETH for testing
      console.log("Using local network fee: 0.01 ETH");
    } else {
      deploymentFee = ethers.utils.parseEther("0.1");  // 0.1 ETH
      console.log("Using Ethereum default fee: 0.1 ETH");
    }
  }
  console.log("Deployment fee:", ethers.utils.formatEther(deploymentFee), network.name === "polygon_mainnet" || network.name === "polygon_amoy" ? "MATIC" : "ETH", "\n");

  // ========================================
  // Step 1: Deploy RankPlanRegistry
  // ========================================

  console.log("========================================");
  console.log("Step 1: Deploying RankPlanRegistry");
  console.log("========================================\n");

  const RankPlanRegistry = await ethers.getContractFactory("RankPlanRegistry");
  const rankPlanRegistry = await RankPlanRegistry.deploy();

  await rankPlanRegistry.deployed();
  const rankPlanRegistryAddress = rankPlanRegistry.address;

  console.log("✅ RankPlanRegistry deployed to:", rankPlanRegistryAddress);

  // RankPlanRegistry初期化確認
  console.log("\n--- RankPlanRegistry Configuration ---");

  // STUDIO Plan確認
  const studioPlan = await rankPlanRegistry.getPlan(0); // PlanType.STUDIO = 0
  console.log("\nSTUDIO Plan:");
  console.log("  Name:", studioPlan.name);
  console.log("  Description:", studioPlan.description);
  console.log("  Stages:", studioPlan.stages.toString());
  console.log("  Active:", studioPlan.isActive);
  console.log("  Rank Names:", studioPlan.rankNames.join(", "));

  // STUDIO PRO Plan確認
  const studioProPlan = await rankPlanRegistry.getPlan(1); // PlanType.STUDIO_PRO = 1
  console.log("\nSTUDIO PRO Plan:");
  console.log("  Name:", studioProPlan.name);
  console.log("  Description:", studioProPlan.description);
  console.log("  Stages:", studioProPlan.stages.toString());
  console.log("  Active:", studioProPlan.isActive);
  console.log("  Rank Names:", studioProPlan.rankNames.join(", "));

  // STUDIO PRO MAX Plan確認
  const studioProMaxPlan = await rankPlanRegistry.getPlan(2); // PlanType.STUDIO_PRO_MAX = 2
  console.log("\nSTUDIO PRO MAX Plan:");
  console.log("  Name:", studioProMaxPlan.name);
  console.log("  Description:", studioProMaxPlan.description);
  console.log("  Stages:", studioProMaxPlan.stages.toString());
  console.log("  Active:", studioProMaxPlan.isActive);
  console.log("  Rank Names:", studioProMaxPlan.rankNames.join(", "));

  // ========================================
  // Step 2: Deploy GifterraFactory
  // ========================================

  console.log("\n========================================");
  console.log("Step 2: Deploying GifterraFactory");
  console.log("========================================\n");

  const GifterraFactory = await ethers.getContractFactory("GifterraFactory");
  const factory = await GifterraFactory.deploy(feeRecipient, deploymentFee, jpycAddress);

  await factory.deployed();
  const factoryAddress = factory.address;

  console.log("✅ GifterraFactory deployed to:", factoryAddress);

  // Factory初期設定確認
  console.log("\n--- GifterraFactory Configuration ---");
  const deploymentFeeFromContract = await factory.deploymentFee();
  const totalTenants = await factory.totalTenants();
  const activeTenants = await factory.activeTenants();
  const nextTenantId = await factory.nextTenantId();

  console.log("Deployment Fee:", ethers.utils.formatEther(deploymentFeeFromContract), network.name === "polygon_mainnet" || network.name === "polygon_amoy" ? "MATIC" : "ETH");
  console.log("Total Tenants:", totalTenants.toString());
  console.log("Active Tenants:", activeTenants.toString());
  console.log("Next Tenant ID:", nextTenantId.toString());

  // ロール確認
  const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
  const SUPER_ADMIN_ROLE = await factory.SUPER_ADMIN_ROLE();
  const OPERATOR_ROLE = await factory.OPERATOR_ROLE();

  const hasDefaultAdmin = await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const hasSuperAdmin = await factory.hasRole(SUPER_ADMIN_ROLE, deployer.address);
  const hasOperator = await factory.hasRole(OPERATOR_ROLE, deployer.address);

  console.log("\n--- Deployer Roles ---");
  console.log("DEFAULT_ADMIN_ROLE:", hasDefaultAdmin);
  console.log("SUPER_ADMIN_ROLE:", hasSuperAdmin);
  console.log("OPERATOR_ROLE:", hasOperator);

  // ========================================
  // Step 3: Link RankPlanRegistry to Factory
  // ========================================

  console.log("\n========================================");
  console.log("Step 3: Linking RankPlanRegistry to Factory");
  console.log("========================================\n");

  console.log("Setting RankPlanRegistry address in GifterraFactory...");
  const tx = await factory.setRankPlanRegistry(rankPlanRegistryAddress);
  await tx.wait();

  const linkedRegistryAddress = await factory.rankPlanRegistry();
  console.log("✅ RankPlanRegistry linked:", linkedRegistryAddress);
  console.log("   Verification:", linkedRegistryAddress === rankPlanRegistryAddress ? "SUCCESS" : "FAILED");

  // ========================================
  // Save Deployment Info
  // ========================================

  console.log("\n========================================");
  console.log("Saving Deployment Information");
  console.log("========================================\n");

  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      rankPlanRegistry: rankPlanRegistryAddress,
      factory: factoryAddress,
      feeRecipient: feeRecipient,
    },
    config: {
      deploymentFee: ethers.utils.formatEther(deploymentFee),
      totalTenants: totalTenants.toString(),
    },
    roles: {
      DEFAULT_ADMIN_ROLE: DEFAULT_ADMIN_ROLE,
      SUPER_ADMIN_ROLE: SUPER_ADMIN_ROLE,
      OPERATOR_ROLE: OPERATOR_ROLE,
    },
    plans: {
      studio: {
        name: studioPlan.name,
        stages: studioPlan.stages.toString(),
        rankNames: studioPlan.rankNames,
      },
      studioPro: {
        name: studioProPlan.name,
        stages: studioProPlan.stages.toString(),
        rankNames: studioProPlan.rankNames,
      },
      studioProMax: {
        name: studioProMaxPlan.name,
        stages: studioProMaxPlan.stages.toString(),
        rankNames: studioProMaxPlan.rankNames,
      },
    },
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(
    outputDir,
    `complete-factory-${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(outputFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("✅ Deployment info saved to:", outputFile);

  // ========================================
  // Verification Commands
  // ========================================

  console.log("\n========================================");
  console.log("Contract Verification Commands");
  console.log("========================================\n");

  console.log("1. Verify RankPlanRegistry:");
  console.log(`   npx hardhat verify --network ${network.name} ${rankPlanRegistryAddress}`);

  console.log("\n2. Verify GifterraFactory:");
  console.log(`   npx hardhat verify --network ${network.name} ${factoryAddress} "${feeRecipient}" "${deploymentFee.toString()}" "${jpycAddress}"`);
  console.log("   Note: deploymentFee is in wei (e.g., 10000000000000000000 = 10 MATIC)");

  // ========================================
  // Environment Variables Template
  // ========================================

  console.log("\n========================================");
  console.log("Environment Variables (for .env)");
  console.log("========================================\n");

  console.log("# Add these to your .env file:");
  console.log(`VITE_RANK_PLAN_REGISTRY_ADDRESS=${rankPlanRegistryAddress}`);
  console.log(`VITE_GIFTERRA_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`VITE_NETWORK_CHAIN_ID=${network.config.chainId}`);

  // ========================================
  // Next Steps
  // ========================================

  console.log("\n========================================");
  console.log("Next Steps");
  console.log("========================================\n");
  console.log("1. Verify contracts on block explorer (see commands above)");
  console.log("2. Update .env with deployed contract addresses");
  console.log("3. Update src/config/contracts.ts with new addresses");
  console.log("4. Create test tenant using:");
  console.log(`   npx hardhat run scripts/create-tenant.js --network ${network.name}`);
  console.log("5. Test full tenant creation flow");
  console.log("6. Set up indexer/distributor for tenant contracts");

  console.log("\n========================================");
  console.log("Deployment Complete! ✅");
  console.log("========================================\n");

  return {
    rankPlanRegistry: rankPlanRegistryAddress,
    factory: factoryAddress,
    feeRecipient: feeRecipient,
    deploymentInfo: outputFile,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
