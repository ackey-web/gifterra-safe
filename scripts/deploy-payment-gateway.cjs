// scripts/deploy-payment-gateway.cjs
// PaymentGatewayWithPermit デプロイスクリプト

const hre = require("hardhat");

async function main() {
  console.log("🚀 PaymentGatewayWithPermit デプロイ開始...\n");

  // デプロイヤーアドレス取得
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 デプロイヤーアドレス:", deployer.address);

  // 残高確認
  const balance = await deployer.getBalance();
  console.log("💰 デプロイヤー残高:", hre.ethers.utils.formatEther(balance), "MATIC\n");

  // JPYC アドレス（Polygon Mainnet）
  const JPYC_ADDRESS = process.env.JPYC_MAINNET_ADDRESS || "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29";

  // プラットフォーム手数料受取アドレス（デフォルト: deployer）
  const PLATFORM_FEE_RECIPIENT = process.env.PLATFORM_FEE_RECIPIENT || deployer.address;

  console.log("📦 デプロイパラメータ:");
  console.log("  JPYC Address:", JPYC_ADDRESS);
  console.log("  Platform Fee Recipient:", PLATFORM_FEE_RECIPIENT);
  console.log();

  // PaymentGatewayWithPermit をデプロイ
  console.log("⏳ PaymentGatewayWithPermit デプロイ中...");
  const PaymentGateway = await hre.ethers.getContractFactory("PaymentGatewayWithPermit");
  const gateway = await PaymentGateway.deploy(JPYC_ADDRESS, PLATFORM_FEE_RECIPIENT);

  await gateway.deployed();

  console.log("✅ PaymentGatewayWithPermit デプロイ完了!");
  console.log("📍 コントラクトアドレス:", gateway.address);
  console.log();

  // デプロイ情報を保存
  const deploymentInfo = {
    network: hre.network.name,
    contractName: "PaymentGatewayWithPermit",
    address: gateway.address,
    jpycAddress: JPYC_ADDRESS,
    platformFeeRecipient: PLATFORM_FEE_RECIPIENT,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: gateway.deployTransaction.blockNumber,
    transactionHash: gateway.deployTransaction.hash,
  };

  console.log("📄 デプロイ情報:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log();

  // 検証用情報
  console.log("🔍 Polygonscan 検証コマンド:");
  console.log(`npx hardhat verify --network polygon ${gateway.address} "${JPYC_ADDRESS}" "${PLATFORM_FEE_RECIPIENT}"`);
  console.log();

  // .env 更新用
  console.log("📝 .env に追加:");
  console.log(`VITE_PAYMENT_GATEWAY_ADDRESS=${gateway.address}`);
  console.log();

  console.log("🎉 デプロイ完了！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ デプロイエラー:", error);
    process.exit(1);
  });
