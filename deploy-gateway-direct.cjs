// Direct deployment script for PaymentGatewayWithPermit
// Bypasses Hardhat compilation to avoid errors in other contracts

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🚀 PaymentGatewayWithPermit デプロイ開始...\n');

  // 1. 環境変数チェック
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/';
  const jpycAddress = process.env.JPYC_MAINNET_ADDRESS || '0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c';

  if (!privateKey) {
    console.error('❌ エラー: PRIVATE_KEY が .env に設定されていません');
    process.exit(1);
  }

  console.log('✓ 環境変数確認完了');
  console.log('  RPC URL:', rpcUrl);
  console.log('  JPYC Address:', jpycAddress);

  // 2. プロバイダーとウォレット設定
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const deployerAddress = wallet.address;

  console.log('\n✓ ウォレット接続完了');
  console.log('  デプロイヤーアドレス:', deployerAddress);

  // 3. 残高確認
  const balance = await provider.getBalance(deployerAddress);
  const balanceMatic = ethers.utils.formatEther(balance);
  console.log('  MATIC残高:', balanceMatic, 'MATIC');

  if (balance.lt(ethers.utils.parseEther('0.05'))) {
    console.warn('\n⚠️  警告: MATIC残高が少ない可能性があります（推奨: 0.1 MATIC以上）');
  }

  // 4. コンパイル済みアーティファクトを読み込み
  const artifactPath = path.join(__dirname, 'artifacts/contracts/PaymentGatewayWithPermit.sol/PaymentGatewayWithPermit.json');

  if (!fs.existsSync(artifactPath)) {
    console.error('\n❌ エラー: コンパイル済みアーティファクトが見つかりません');
    console.error('   以下のコマンドを実行してください:');
    console.error('   node compile-payment-gateway-only.cjs');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  console.log('\n✓ コントラクトアーティファクト読み込み完了');

  // 5. デプロイ
  console.log('\n📝 デプロイトランザクションを準備中...');

  const platformFeeRecipient = process.env.PLATFORM_FEE_RECIPIENT || deployerAddress;
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log('  Constructor引数:');
  console.log('    _jpycAddress:', jpycAddress);
  console.log('    _platformFeeRecipient:', platformFeeRecipient);

  // 現在のガス価格を取得して、推奨値より高く設定
  const feeData = await provider.getFeeData();
  console.log('\n⛽ ガス価格を取得中...');
  console.log('  現在のガス価格:', ethers.utils.formatUnits(feeData.gasPrice || '0', 'gwei'), 'Gwei');

  const gasPrice = feeData.gasPrice ? feeData.gasPrice.mul(120).div(100) : ethers.utils.parseUnits('50', 'gwei'); // 20%上乗せまたは50 Gwei
  console.log('  使用するガス価格:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'Gwei');

  console.log('\n🔄 デプロイ実行中...');
  console.log('   (Polygon Mainnetへのデプロイには1-2分かかる場合があります)');

  const contract = await factory.deploy(jpycAddress, platformFeeRecipient, {
    gasPrice: gasPrice,
    gasLimit: 3000000
  });

  console.log('\n⏳ トランザクション送信完了。マイニング待機中...');
  console.log('   Transaction Hash:', contract.deployTransaction.hash);

  await contract.deployed();

  console.log('\n✅ デプロイ成功！\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 PaymentGatewayWithPermit Address:');
  console.log('   ', contract.address);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 6. .env ファイルを更新
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // VITE_PAYMENT_GATEWAY_ADDRESS を更新
  if (envContent.includes('VITE_PAYMENT_GATEWAY_ADDRESS=')) {
    envContent = envContent.replace(
      /VITE_PAYMENT_GATEWAY_ADDRESS=.*/,
      `VITE_PAYMENT_GATEWAY_ADDRESS=${contract.address}`
    );
  } else {
    envContent += `\nVITE_PAYMENT_GATEWAY_ADDRESS=${contract.address}\n`;
  }

  // PLATFORM_FEE_RECIPIENT を更新
  if (envContent.includes('PLATFORM_FEE_RECIPIENT=')) {
    envContent = envContent.replace(
      /PLATFORM_FEE_RECIPIENT=.*/,
      `PLATFORM_FEE_RECIPIENT=${platformFeeRecipient}`
    );
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✓ .env ファイルを更新しました\n');

  // 7. デプロイ情報を保存
  const deploymentInfo = {
    network: 'polygon',
    chainId: 137,
    contractAddress: contract.address,
    deployerAddress: deployerAddress,
    jpycAddress: jpycAddress,
    platformFeeRecipient: platformFeeRecipient,
    transactionHash: contract.deployTransaction.hash,
    deployedAt: new Date().toISOString(),
    gasUsed: (await contract.deployTransaction.wait()).gasUsed.toString(),
  };

  const deploymentPath = path.join(__dirname, 'deployment-info.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('✓ デプロイ情報を deployment-info.json に保存しました\n');

  // 8. 次のステップを表示
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 次のステップ:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. Polygonscan で確認:');
  console.log(`   https://polygonscan.com/address/${contract.address}\n`);
  console.log('2. コントラクトを検証 (オプション):');
  console.log(`   npx hardhat verify --network polygon ${contract.address} "${jpycAddress}" "${platformFeeRecipient}"\n`);
  console.log('3. テストページでテスト:');
  console.log('   pnpm dev');
  console.log('   → http://localhost:5173/gasless-qr-test');
  console.log('   → http://localhost:5173/gasless-scanner-test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ デプロイエラー:\n', error);
    process.exit(1);
  });
