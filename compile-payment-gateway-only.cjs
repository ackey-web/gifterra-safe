// Compile only PaymentGatewayWithPermit.sol
// Bypasses errors in other contracts

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🔨 PaymentGatewayWithPermit コンパイル開始...\n');

  const contractsDir = path.join(__dirname, 'contracts');
  const backupDir = path.join(__dirname, 'contracts_backup_temp');
  const targetContract = 'PaymentGatewayWithPermit.sol';

  try {
    // 1. バックアップディレクトリ作成
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 2. PaymentGatewayWithPermit.sol 以外のコントラクトを一時移動
    console.log('📦 他のコントラクトを一時的に移動中...');
    const allFiles = fs.readdirSync(contractsDir);
    let movedCount = 0;

    for (const file of allFiles) {
      if (file !== targetContract && file.endsWith('.sol')) {
        const srcPath = path.join(contractsDir, file);
        const destPath = path.join(backupDir, file);
        fs.renameSync(srcPath, destPath);
        movedCount++;
      }
    }

    console.log(`✓ ${movedCount}個のコントラクトを一時移動しました\n`);

    // 3. PaymentGatewayWithPermit.sol のみをコンパイル
    console.log('🔨 PaymentGatewayWithPermit.sol をコンパイル中...');
    execSync('npx hardhat compile', { stdio: 'inherit' });

    console.log('\n✅ コンパイル成功！\n');

    // 4. アーティファクト確認
    const artifactPath = path.join(__dirname, 'artifacts/contracts/PaymentGatewayWithPermit.sol/PaymentGatewayWithPermit.json');

    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      console.log('📦 コントラクト情報:');
      console.log('  - Contract Name:', artifact.contractName);
      console.log('  - Bytecode Size:', (artifact.bytecode.length / 2 - 1).toLocaleString(), 'bytes');
      console.log('  - ABI Functions:', artifact.abi.filter(x => x.type === 'function').length);
      console.log();
    }

  } catch (error) {
    console.error('\n❌ コンパイルエラー:', error.message);
    process.exit(1);
  } finally {
    // 5. 移動したコントラクトを戻す
    console.log('📦 移動したコントラクトを元に戻しています...');
    const backedUpFiles = fs.readdirSync(backupDir);

    for (const file of backedUpFiles) {
      const srcPath = path.join(backupDir, file);
      const destPath = path.join(contractsDir, file);
      fs.renameSync(srcPath, destPath);
    }

    // バックアップディレクトリ削除
    fs.rmdirSync(backupDir);
    console.log('✓ 完了\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 コンパイル完了！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('次のステップ:');
  console.log('  node deploy-gateway-direct.cjs\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
