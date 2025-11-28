// scripts/create-tenant-example.cjs
// テナント作成サンプルスクリプト
//
// 使用方法:
// FACTORY_ADDRESS=0x... npx hardhat run scripts/create-tenant-example.cjs --network polygon_amoy

const hre = require('hardhat');

async function main() {
  console.log('========================================');
  console.log('テナント作成サンプル');
  console.log('========================================\n');

  const network = hre.network.name;
  console.log(`📡 ネットワーク: ${network}`);

  // デプロイヤーの取得
  const [deployer] = await hre.ethers.getSigners();
  console.log(`🔑 作成者: ${deployer.address}`);

  // Factory アドレスを環境変数から取得
  const factoryAddress = process.env.FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error('❌ FACTORY_ADDRESS が設定されていません');
  }

  console.log(`🏭 Factory: ${factoryAddress}\n`);

  // Factory コントラクトに接続
  const GifterraFactoryLite = await hre.ethers.getContractFactory('GifterraFactoryLite');
  const factory = GifterraFactoryLite.attach(factoryAddress);

  // デプロイ手数料を確認
  const deploymentFee = await factory.deploymentFee();
  console.log(`💵 必要な手数料: ${hre.ethers.formatEther(deploymentFee)} MATIC`);

  // テナント作成パラメータ（サンプル）
  const tenantName = "Sample Cafe";
  const admin = deployer.address;  // 自分自身をadminに設定
  const rewardTokenAddress = "0x0000000000000000000000000000000000000000";  // ネイティブトークン
  const tipWalletAddress = deployer.address;  // 投げ銭受取先
  const rankPlan = 0;  // STUDIO プラン

  console.log('📝 テナント作成パラメータ:');
  console.log(`   - テナント名: ${tenantName}`);
  console.log(`   - 管理者: ${admin}`);
  console.log(`   - 報酬トークン: ${rewardTokenAddress}`);
  console.log(`   - 投げ銭先: ${tipWalletAddress}`);
  console.log(`   - ランクプラン: ${rankPlan} (STUDIO)\n`);

  // テナント作成
  console.log('🚀 テナント作成中...');
  const tx = await factory.createTenant(
    tenantName,
    admin,
    rewardTokenAddress,
    tipWalletAddress,
    rankPlan,
    { value: deploymentFee }
  );

  console.log(`📤 トランザクション送信: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ トランザクション確認: ${receipt.status === 1 ? '成功' : '失敗'}\n`);

  // イベントからテナント情報を取得
  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === 'TenantCreated');

  if (event) {
    console.log('🎉 テナント作成成功！');
    console.log(`   - テナントID: ${event.args.tenantId}`);
    console.log(`   - Gifterra (SBT): ${event.args.gifterra}\n`);
    console.log('📌 注意: 以下のコントラクトは別途デプロイが必要です:');
    console.log('   - RewardNFT_v2');
    console.log('   - GifterraPaySplitter');
    console.log('   - FlagNFT');
    console.log('   - RandomRewardEngine');
    console.log('   ※ ヘルパースクリプト: scripts/deploy-tenant-contracts.cjs\n');

    // テナント情報を取得
    const tenantInfo = await factory.getTenantInfo(event.args.tenantId);
    console.log('📊 テナント詳細情報:');
    console.log(`   - アクティブ: ${tenantInfo.isActive}`);
    console.log(`   - 一時停止: ${tenantInfo.isPaused}`);
    console.log(`   - 作成日時: ${new Date(Number(tenantInfo.createdAt) * 1000).toISOString()}`);
  }

  console.log('\n========================================');
  console.log('✅ 完了');
  console.log('========================================\n');
}

// エラーハンドリング
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ エラー:');
    console.error(error);
    process.exit(1);
  });
