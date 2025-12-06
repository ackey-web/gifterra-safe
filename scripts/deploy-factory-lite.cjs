// scripts/deploy-factory-lite.cjs
// GifterraFactoryLite デプロイスクリプト
//
// 使用方法:
// npx hardhat run scripts/deploy-factory-lite.cjs --network polygon_amoy
// npx hardhat run scripts/deploy-factory-lite.cjs --network polygon_mainnet

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  console.log('========================================');
  console.log('GifterraFactoryLite デプロイ開始');
  console.log('========================================\n');

  const network = hre.network.name;
  console.log(`📡 ネットワーク: ${network}`);

  // デプロイヤーの取得
  const [deployer] = await hre.ethers.getSigners();
  console.log(`🔑 デプロイヤー: ${deployer.address}`);

  // 残高確認
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 残高: ${hre.ethers.utils.formatEther(balance)} ${network.includes('polygon') ? 'MATIC' : 'ETH'}\n`);

  if (balance === 0n) {
    throw new Error('❌ デプロイヤーの残高が不足しています');
  }

  // 環境変数からRankPlanRegistryアドレスを取得
  const rankPlanRegistryAddress = process.env.RANK_PLAN_REGISTRY_ADDRESS;
  if (!rankPlanRegistryAddress) {
    throw new Error('❌ RANK_PLAN_REGISTRY_ADDRESS が設定されていません');
  }

  console.log(`📋 RankPlanRegistry: ${rankPlanRegistryAddress}`);

  // デプロイメント設定
  const feeRecipient = deployer.address;  // 手数料受取先（後で変更可能）
  const deploymentFee = hre.ethers.utils.parseEther("1");  // 1 MATIC（最小構成のため低コスト）

  console.log(`💵 テナント作成手数料: ${hre.ethers.utils.formatEther(deploymentFee)} MATIC`);
  console.log(`👤 手数料受取先: ${feeRecipient}\n`);

  // GifterraFactoryLite のデプロイ
  console.log('📦 GifterraFactoryLite をデプロイ中...');
  const GifterraFactoryLite = await hre.ethers.getContractFactory('GifterraFactoryLite');
  const factory = await GifterraFactoryLite.deploy(
    feeRecipient,
    deploymentFee,
    rankPlanRegistryAddress
  );
  await factory.deployed();

  const factoryAddress = factory.address;
  console.log(`✅ GifterraFactoryLite デプロイ完了: ${factoryAddress}\n`);

  // デプロイされたコントラクトの情報を表示
  console.log('🔍 Factory 情報:');
  const totalTenants = await factory.totalTenants();
  const currentFee = await factory.deploymentFee();
  const currentRecipient = await factory.feeRecipient();

  console.log(`   - 総テナント数: ${totalTenants}`);
  console.log(`   - デプロイ手数料: ${hre.ethers.utils.formatEther(currentFee)} MATIC`);
  console.log(`   - 手数料受取先: ${currentRecipient}`);
  console.log(`   - RankPlanRegistry: ${await factory.rankPlanRegistry()}\n`);

  // デプロイ情報をファイルに保存
  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      GifterraFactoryLite: factoryAddress,
      RankPlanRegistry: rankPlanRegistryAddress,
    },
    config: {
      deploymentFee: hre.ethers.utils.formatEther(deploymentFee),
      feeRecipient: feeRecipient,
    },
  };

  const outputDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `factory-lite-${network}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 デプロイ情報を保存: ${outputPath}`);

  // 検証コマンドの出力
  console.log('\n========================================');
  console.log('🔍 検証コマンド (PolygonScan):');
  console.log('========================================');
  console.log(`npx hardhat verify --network ${network} ${factoryAddress} "${feeRecipient}" "${deploymentFee}" "${rankPlanRegistryAddress}"`);

  // ネットワーク別のエクスプローラーURL
  let explorerUrl = '';
  if (network === 'polygon_amoy') {
    explorerUrl = `https://amoy.polygonscan.com/address/${factoryAddress}`;
  } else if (network === 'polygon_mainnet') {
    explorerUrl = `https://polygonscan.com/address/${factoryAddress}`;
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
  console.log('2. テナント作成テスト（create-tenant-example.cjs）:');
  console.log(`   FACTORY_ADDRESS=${factoryAddress} npx hardhat run scripts/create-tenant-example.cjs --network ${network}`);
  console.log('3. 追加コントラクトのデプロイ（各テナントごと）:');
  console.log('   - RewardNFT_v2');
  console.log('   - GifterraPaySplitter');
  console.log('   - FlagNFT');
  console.log('   - RandomRewardEngine');
  console.log('   ※ ヘルパースクリプト: scripts/deploy-tenant-contracts.cjs');
  console.log('4. フロントエンドの設定更新:');
  console.log(`   - VITE_FACTORY_ADDRESS=${factoryAddress}`);
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
