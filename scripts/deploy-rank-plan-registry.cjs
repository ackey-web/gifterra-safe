// scripts/deploy-rank-plan-registry.js
// RankPlanRegistryコントラクトのデプロイスクリプト
//
// 使用方法:
// npx hardhat run scripts/deploy-rank-plan-registry.js --network polygon_amoy
// npx hardhat run scripts/deploy-rank-plan-registry.js --network polygon_mainnet

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  console.log('========================================');
  console.log('RankPlanRegistry デプロイ開始');
  console.log('========================================\n');

  const network = hre.network.name;
  console.log(`📡 ネットワーク: ${network}`);

  // デプロイヤーの取得
  const [deployer] = await hre.ethers.getSigners();
  console.log(`🔑 デプロイヤー: ${deployer.address}`);

  // 残高確認
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 残高: ${hre.ethers.formatEther(balance)} ${network.includes('polygon') ? 'MATIC' : 'ETH'}\n`);

  if (balance === 0n) {
    throw new Error('❌ デプロイヤーの残高が不足しています');
  }

  // RankPlanRegistryのデプロイ
  console.log('📦 RankPlanRegistry をデプロイ中...');
  const RankPlanRegistry = await hre.ethers.getContractFactory('RankPlanRegistry');
  const registry = await RankPlanRegistry.deploy();
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log(`✅ RankPlanRegistry デプロイ完了: ${registryAddress}\n`);

  // デフォルトプランの確認
  console.log('🔍 デフォルトプランの確認...');
  const planNames = ['STUDIO', 'STUDIO_PRO', 'STUDIO_PRO_MAX'];

  for (const planName of planNames) {
    try {
      const plan = await registry.getPlan(planName);
      console.log(`\n  📋 ${planName}:`);
      console.log(`     - ステージ数: ${plan.stageCount}`);
      console.log(`     - 有効: ${plan.isActive}`);
      console.log(`     - 使用回数: ${plan.usageCount}`);

      // 各ステージの閾値を表示
      console.log(`     - 閾値: [${plan.thresholds.join(', ')}]`);
    } catch (error) {
      console.log(`  ⚠️  ${planName} の取得に失敗: ${error.message}`);
    }
  }

  // デプロイ情報をファイルに保存
  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RankPlanRegistry: registryAddress,
    },
  };

  const outputDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `rank-plan-registry-${network}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 デプロイ情報を保存: ${outputPath}`);

  // 検証コマンドの出力
  console.log('\n========================================');
  console.log('🔍 検証コマンド (PolygonScan):');
  console.log('========================================');
  console.log(`npx hardhat verify --network ${network} ${registryAddress}`);

  // ネットワーク別のエクスプローラーURL
  let explorerUrl = '';
  if (network === 'polygon_amoy') {
    explorerUrl = `https://amoy.polygonscan.com/address/${registryAddress}`;
  } else if (network === 'polygon_mainnet') {
    explorerUrl = `https://polygonscan.com/address/${registryAddress}`;
  }

  if (explorerUrl) {
    console.log(`\n🌐 エクスプローラー: ${explorerUrl}`);
  }

  console.log('\n========================================');
  console.log('✅ デプロイ完了');
  console.log('========================================\n');

  // 次のステップの案内
  console.log('📝 次のステップ:');
  console.log('1. PolygonScanで契約を検証');
  console.log('2. GifterraFactory のデプロイ時にこのアドレスを使用');
  console.log(`   RANK_PLAN_REGISTRY_ADDRESS=${registryAddress}`);
  console.log('3. Factory デプロイ: npx hardhat run scripts/deploy-factory.js --network ' + network);
  console.log('');

  return deploymentInfo;
}

// エラーハンドリング
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ デプロイエラー:');
    console.error(error);
    process.exit(1);
  });
