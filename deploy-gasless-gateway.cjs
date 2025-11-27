// deploy-gasless-gateway.cjs
// 真のガスレス版PaymentGatewayをPolygonにデプロイ

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function deployGaslessGateway() {
  console.log('🚀 真のガスレスPaymentGatewayデプロイ開始');

  // 1. 環境変数から秘密鍵を取得
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY または PRIVATE_KEY 環境変数が設定されていません');
  }

  // 2. Polygon Mainnetに接続
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('📡 デプロイヤーアドレス:', wallet.address);

  // 残高確認
  const balance = await wallet.getBalance();
  console.log('💰 MATIC残高:', ethers.utils.formatEther(balance), 'MATIC');

  if (balance.lt(ethers.utils.parseEther('0.1'))) {
    throw new Error('MATIC残高が不足しています（最低0.1 MATIC必要）');
  }

  // 3. コントラクトをコンパイル
  console.log('\n📦 コントラクトをコンパイル中...');
  const { execSync } = require('child_process');

  try {
    execSync('pnpm hardhat compile', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ コンパイルエラー:', error.message);
    throw error;
  }

  // 4. コンパイル済みコントラクトを読み込み
  const artifactPath = path.join(
    __dirname,
    'artifacts/contracts/PaymentGatewayWithPermit.sol/PaymentGatewayWithPermit.json'
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`コントラクトアーティファクトが見つかりません: ${artifactPath}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const { abi, bytecode } = artifact;

  console.log('✅ コンパイル完了');

  // 5. デプロイ
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29'; // Polygon JPYC
  const platformFeeRecipient = wallet.address; // デプロイヤーを手数料受取人に設定

  console.log('\n🚀 デプロイ開始...');
  console.log('JPYC Address:', jpycAddress);
  console.log('Platform Fee Recipient:', platformFeeRecipient);

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(jpycAddress, platformFeeRecipient);

  console.log('⏳ トランザクション送信完了。確認待ち...');
  console.log('Transaction Hash:', contract.deployTransaction.hash);

  await contract.deployed();

  console.log('\n✅ デプロイ完了！');
  console.log('📍 Contract Address:', contract.address);
  console.log('🔗 Polygonscan:', `https://polygonscan.com/address/${contract.address}`);

  // 6. デプロイ情報を保存
  const deployInfo = {
    address: contract.address,
    jpycAddress,
    platformFeeRecipient,
    deployedAt: new Date().toISOString(),
    transactionHash: contract.deployTransaction.hash,
    network: 'polygon',
    chainId: 137,
  };

  const deployInfoPath = path.join(__dirname, 'deployed-gasless-gateway.json');
  fs.writeFileSync(deployInfoPath, JSON.stringify(deployInfo, null, 2));
  console.log('\n📄 デプロイ情報を保存:', deployInfoPath);

  // 7. 検証用情報を表示
  console.log('\n📋 Polygonscan検証コマンド:');
  console.log(
    `pnpm hardhat verify --network polygon ${contract.address} "${jpycAddress}" "${platformFeeRecipient}"`
  );

  return contract.address;
}

deployGaslessGateway()
  .then((address) => {
    console.log('\n✅ デプロイ成功:', address);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ デプロイエラー:', error);
    process.exit(1);
  });
