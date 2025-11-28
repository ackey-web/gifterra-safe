// scripts/deploy-tenant-contracts.cjs
// テナント用追加コントラクトデプロイスクリプト
//
// 使用方法:
// GIFTERRA_ADDRESS=0x... TENANT_NAME="My Shop" npx hardhat run scripts/deploy-tenant-contracts.cjs --network polygon_amoy
//
// 必須環境変数:
// - GIFTERRA_ADDRESS: デプロイ済みのGifterraコントラクトアドレス
// - TENANT_NAME: テナント名（RewardNFTとFlagNFTの名前に使用）
//
// オプション環境変数:
// - ADMIN_ADDRESS: 管理者アドレス（デフォルト: デプロイヤー）
// - REWARD_TOKEN_ADDRESS: 報酬トークンアドレス（デフォルト: ゼロアドレス = ネイティブトークン）
// - PAYEES: PaySplitter分配先アドレス（カンマ区切り、デフォルト: デプロイヤーのみ）
// - SHARES: PaySplitter分配率（カンマ区切り、デフォルト: 100）

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  console.log('========================================');
  console.log('テナント追加コントラクトデプロイ');
  console.log('========================================\n');

  const network = hre.network.name;
  console.log(`📡 ネットワーク: ${network}`);

  // デプロイヤーの取得
  const [deployer] = await hre.ethers.getSigners();
  console.log(`🔑 デプロイヤー: ${deployer.address}`);

  // 残高確認
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 残高: ${hre.ethers.formatEther(balance)} ${network.includes('polygon') ? 'MATIC' : 'ETH'}\n`);

  // 必須パラメータの確認
  const gifterraAddress = process.env.GIFTERRA_ADDRESS;
  const tenantName = process.env.TENANT_NAME;

  if (!gifterraAddress) {
    throw new Error('❌ GIFTERRA_ADDRESS が設定されていません');
  }
  if (!tenantName) {
    throw new Error('❌ TENANT_NAME が設定されていません');
  }

  // オプションパラメータ
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000';
  const payeesStr = process.env.PAYEES || deployer.address;
  const sharesStr = process.env.SHARES || '100';

  const payees = payeesStr.split(',').map(addr => addr.trim());
  const shares = sharesStr.split(',').map(share => parseInt(share.trim()));

  if (payees.length !== shares.length) {
    throw new Error('❌ PAYEESとSHARESの数が一致しません');
  }

  console.log('📝 デプロイパラメータ:');
  console.log(`   - Gifterraアドレス: ${gifterraAddress}`);
  console.log(`   - テナント名: ${tenantName}`);
  console.log(`   - 管理者: ${adminAddress}`);
  console.log(`   - 報酬トークン: ${rewardTokenAddress}`);
  console.log(`   - 分配先数: ${payees.length}\n`);

  const deployedContracts = {};

  // 1. RewardNFT_v2 デプロイ
  console.log('📦 RewardNFT_v2 をデプロイ中...');
  const RewardNFT_v2 = await hre.ethers.getContractFactory('RewardNFT_v2');
  const rewardNFT = await RewardNFT_v2.deploy(
    `${tenantName} Reward`,
    'REWARD',
    'https://api.gifterra.com/metadata/',
    adminAddress,
    hre.ethers.ZeroAddress,  // distributor は後で設定
    0,                        // maxSupply無制限
    0                         // mintPrice無料
  );
  await rewardNFT.waitForDeployment();
  deployedContracts.rewardNFT = await rewardNFT.getAddress();
  console.log(`✅ RewardNFT_v2: ${deployedContracts.rewardNFT}\n`);

  // 2. GifterraPaySplitter デプロイ
  console.log('📦 GifterraPaySplitter をデプロイ中...');
  const GifterraPaySplitter = await hre.ethers.getContractFactory('GifterraPaySplitter');
  const paySplitter = await GifterraPaySplitter.deploy(payees, shares);
  await paySplitter.waitForDeployment();
  const paySplitterAddress = await paySplitter.getAddress();

  // 所有権を管理者に移譲
  if (adminAddress !== deployer.address) {
    await paySplitter.transferOwnership(adminAddress);
    console.log(`   ↳ 所有権を ${adminAddress} に移譲`);
  }

  deployedContracts.paySplitter = paySplitterAddress;
  console.log(`✅ PaySplitter: ${deployedContracts.paySplitter}\n`);

  // 3. FlagNFT デプロイ
  console.log('📦 FlagNFT をデプロイ中...');
  const FlagNFT = await hre.ethers.getContractFactory('FlagNFT');
  const flagNFT = await FlagNFT.deploy(
    `${tenantName} Flag`,
    'FLAG',
    'https://api.gifterra.com/flag/',
    adminAddress,
    0  // mintPrice無料
  );
  await flagNFT.waitForDeployment();
  deployedContracts.flagNFT = await flagNFT.getAddress();
  console.log(`✅ FlagNFT: ${deployedContracts.flagNFT}\n`);

  // 4. RandomRewardEngine デプロイ
  console.log('📦 RandomRewardEngine をデプロイ中...');
  const RandomRewardEngine = await hre.ethers.getContractFactory('RandomRewardEngine');
  const rewardEngine = await RandomRewardEngine.deploy(
    gifterraAddress,
    deployedContracts.rewardNFT,
    rewardTokenAddress,
    adminAddress
  );
  await rewardEngine.waitForDeployment();
  deployedContracts.randomRewardEngine = await rewardEngine.getAddress();
  console.log(`✅ RandomRewardEngine: ${deployedContracts.randomRewardEngine}\n`);

  // デプロイサマリー
  console.log('========================================');
  console.log('📊 デプロイ完了サマリー');
  console.log('========================================\n');

  console.log(`🏪 テナント: ${tenantName}`);
  console.log(`👤 管理者: ${adminAddress}`);
  console.log(`\n📝 デプロイされたコントラクト:`);
  console.log(`   - Gifterra (SBT): ${gifterraAddress} ※既存`);
  console.log(`   - RewardNFT_v2: ${deployedContracts.rewardNFT}`);
  console.log(`   - PaySplitter: ${deployedContracts.paySplitter}`);
  console.log(`   - FlagNFT: ${deployedContracts.flagNFT}`);
  console.log(`   - RandomRewardEngine: ${deployedContracts.randomRewardEngine}\n`);

  // デプロイ情報を保存
  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    tenantName: tenantName,
    admin: adminAddress,
    contracts: {
      gifterra: gifterraAddress,
      ...deployedContracts
    }
  };

  const outputDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sanitizedName = tenantName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const outputPath = path.join(outputDir, `tenant-${sanitizedName}-${network}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 デプロイ情報を保存: ${outputPath}\n`);

  // 次のステップの案内
  console.log('========================================');
  console.log('📝 次のステップ:');
  console.log('========================================\n');

  console.log('1. PolygonScanで各契約を検証');
  console.log('2. フロントエンドの設定更新:');
  console.log(`   - GIFTERRA_ADDRESS=${gifterraAddress}`);
  console.log(`   - REWARD_NFT_ADDRESS=${deployedContracts.rewardNFT}`);
  console.log(`   - PAY_SPLITTER_ADDRESS=${deployedContracts.paySplitter}`);
  console.log(`   - FLAG_NFT_ADDRESS=${deployedContracts.flagNFT}`);
  console.log(`   - RANDOM_REWARD_ENGINE_ADDRESS=${deployedContracts.randomRewardEngine}`);
  console.log('\n3. 各コントラクトの初期設定:');
  console.log('   - RewardNFT_v2: distributor設定、報酬追加');
  console.log('   - FlagNFT: カテゴリ追加、フラグ作成');
  console.log('   - RandomRewardEngine: 報酬プール設定\n');

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
