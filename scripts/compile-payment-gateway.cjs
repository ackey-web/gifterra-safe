// scripts/compile-payment-gateway.cjs
// PaymentGatewayWithPermit専用コンパイルスクリプト

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔨 PaymentGatewayWithPermit コンパイル開始...\n");

  try {
    // Hardhatのコンパイル
    await hre.run("compile");

    console.log("✅ コンパイル成功！\n");

    // アーティファクトの確認
    const artifactPath = path.join(
      __dirname,
      "../artifacts/contracts/PaymentGatewayWithPermit.sol/PaymentGatewayWithPermit.json"
    );

    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      console.log("📦 PaymentGatewayWithPermit アーティファクト:");
      console.log("  - Contract Name:", artifact.contractName);
      console.log("  - Bytecode Size:", artifact.bytecode.length / 2 - 1, "bytes");
      console.log("  - ABI Functions:", artifact.abi.filter(x => x.type === 'function').length);
      console.log();
    } else {
      console.warn("⚠️ アーティファクトが見つかりません");
    }

    console.log("🎉 完了！");
  } catch (error) {
    console.error("❌ コンパイルエラー:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
