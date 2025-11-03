const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("========================================");
  console.log("GifterraFactory Deployment");
  console.log("========================================\n");

  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), network.name === "polygon" || network.name === "amoy" ? "MATIC" : "ETH");
  console.log("Network:", network.name, "\n");

  // 手数料受取アドレス（環境変数または deployer）
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log("Fee recipient:", feeRecipient);

  // デプロイ手数料設定（環境変数またはネットワーク別デフォルト）
  let deploymentFee;
  if (process.env.DEPLOYMENT_FEE) {
    deploymentFee = ethers.parseEther(process.env.DEPLOYMENT_FEE);
  } else {
    // ネットワーク別デフォルト設定
    if (network.name === "polygon" || network.name === "amoy") {
      deploymentFee = ethers.parseEther("10");  // 10 MATIC
      console.log("Using Polygon default fee: 10 MATIC");
    } else {
      deploymentFee = ethers.parseEther("0.1");  // 0.1 ETH
      console.log("Using Ethereum default fee: 0.1 ETH");
    }
  }
  console.log("Deployment fee:", ethers.formatEther(deploymentFee), network.name === "polygon" || network.name === "amoy" ? "MATIC" : "ETH");

  // Factory デプロイ
  console.log("\nDeploying GifterraFactory...");
  const GifterraFactory = await ethers.getContractFactory("GifterraFactory");
  const factory = await GifterraFactory.deploy(feeRecipient, deploymentFee);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ GifterraFactory deployed to:", factoryAddress);

  // 初期設定確認
  console.log("\n--- Initial Configuration ---");
  const deploymentFeeFromContract = await factory.deploymentFee();
  const totalTenants = await factory.totalTenants();
  const activeTenants = await factory.activeTenants();
  const nextTenantId = await factory.nextTenantId();

  console.log("Deployment Fee:", ethers.formatEther(deploymentFeeFromContract), network.name === "polygon" || network.name === "amoy" ? "MATIC" : "ETH");
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

  // デプロイ情報保存
  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      factory: factoryAddress,
      feeRecipient: feeRecipient,
    },
    config: {
      deploymentFee: ethers.formatEther(deploymentFee),
      totalTenants: totalTenants.toString(),
    },
    roles: {
      DEFAULT_ADMIN_ROLE: DEFAULT_ADMIN_ROLE,
      SUPER_ADMIN_ROLE: SUPER_ADMIN_ROLE,
      OPERATOR_ROLE: OPERATOR_ROLE,
    },
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(
    outputDir,
    `factory-${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(outputFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Deployment info saved to:", outputFile);

  // Verification コマンド
  console.log("\n========================================");
  console.log("Verification Command");
  console.log("========================================");
  console.log(
    `npx hardhat verify --network ${network.name} ${factoryAddress} "${feeRecipient}" "${deploymentFee.toString()}"`
  );
  console.log("\nNote: deploymentFee is in wei (e.g., 10000000000000000000 = 10 MATIC)");

  console.log("\n========================================");
  console.log("Next Steps");
  console.log("========================================");
  console.log("1. Verify the contract on Etherscan (see command above)");
  console.log("2. Create tenants using factory.createTenant()");
  console.log("3. Configure tenant contracts (Gifterra, RewardNFT, etc.)");
  console.log("4. Set up indexer/distributor for each tenant");
  console.log("\nSee docs/FACTORY-DEPLOYMENT-GUIDE.md for details.");

  return {
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
