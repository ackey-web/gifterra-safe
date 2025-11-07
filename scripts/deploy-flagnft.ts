/**
 * FlagNFT デプロイスクリプト
 *
 * 使い方:
 * npx thirdweb deploy
 * または
 * npx ts-node scripts/deploy-flagnft.ts
 */

import { ethers } from "hardhat";

async function main() {
  console.log("🚀 FlagNFT をデプロイ中...\n");

  const [deployer] = await ethers.getSigners();
  console.log("デプロイアドレス:", deployer.address);

  // デプロイパラメータ
  const NAME = "Gifterra Flag NFT";
  const SYMBOL = "GFLAG";
  const BASE_URI = "https://your-metadata-api.com/flagnft/"; // TODO: 実際のメタデータAPIに変更
  const OWNER = deployer.address;
  const MAX_SUPPLY = 0; // 0 = 無制限

  // FlagNFT コントラクトをデプロイ
  const FlagNFT = await ethers.getContractFactory("FlagNFT");
  const flagNFT = await FlagNFT.deploy(
    NAME,
    SYMBOL,
    BASE_URI,
    OWNER,
    MAX_SUPPLY
  );

  await flagNFT.deployed();

  console.log("\n✅ FlagNFT デプロイ完了!");
  console.log("コントラクトアドレス:", flagNFT.address);
  console.log("オーナーアドレス:", OWNER);
  console.log("\n");

  // 初期カテゴリ設定の例
  console.log("📝 初期カテゴリ設定を実行中...\n");

  // カテゴリ定義（Solidityのenumと対応）
  const Category = {
    BENEFIT: 0,
    MEMBERSHIP: 1,
    ACHIEVEMENT: 2,
    CAMPAIGN: 3,
    ACCESS_PASS: 4,
    COLLECTIBLE: 5,
  };

  // BENEFIT カテゴリの設定
  await flagNFT.configureCategory(
    Category.BENEFIT,
    10, // usageLimit: 10回まで
    Math.floor(Date.now() / 1000), // validFrom: 現在時刻
    0, // validUntil: 無期限
    true, // isTransferable: 譲渡可能
    "https://your-metadata-api.com/flagnft/benefit" // metadataURI
  );
  console.log("✅ BENEFIT カテゴリ設定完了");

  // MEMBERSHIP カテゴリの設定
  await flagNFT.configureCategory(
    Category.MEMBERSHIP,
    255, // usageLimit: 無制限（255は特殊値）
    Math.floor(Date.now() / 1000), // validFrom: 現在時刻
    Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // validUntil: 1年後
    false, // isTransferable: 譲渡不可
    "https://your-metadata-api.com/flagnft/membership" // metadataURI
  );
  console.log("✅ MEMBERSHIP カテゴリ設定完了");

  // ACHIEVEMENT カテゴリの設定
  await flagNFT.configureCategory(
    Category.ACHIEVEMENT,
    0, // usageLimit: 表示のみ
    Math.floor(Date.now() / 1000), // validFrom: 現在時刻
    0, // validUntil: 無期限
    false, // isTransferable: 譲渡不可（ソウルバウンド的）
    "https://your-metadata-api.com/flagnft/achievement" // metadataURI
  );
  console.log("✅ ACHIEVEMENT カテゴリ設定完了");

  // CAMPAIGN カテゴリの設定
  await flagNFT.configureCategory(
    Category.CAMPAIGN,
    1, // usageLimit: 1回のみ
    Math.floor(Date.now() / 1000), // validFrom: 現在時刻
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // validUntil: 30日後
    true, // isTransferable: 譲渡可能
    "https://your-metadata-api.com/flagnft/campaign" // metadataURI
  );
  console.log("✅ CAMPAIGN カテゴリ設定完了");

  // ACCESS_PASS カテゴリの設定
  await flagNFT.configureCategory(
    Category.ACCESS_PASS,
    255, // usageLimit: 無制限
    Math.floor(Date.now() / 1000), // validFrom: 現在時刻
    0, // validUntil: 無期限
    false, // isTransferable: 譲渡不可
    "https://your-metadata-api.com/flagnft/access_pass" // metadataURI
  );
  console.log("✅ ACCESS_PASS カテゴリ設定完了");

  // COLLECTIBLE カテゴリの設定
  await flagNFT.configureCategory(
    Category.COLLECTIBLE,
    0, // usageLimit: 表示のみ
    Math.floor(Date.now() / 1000), // validFrom: 現在時刻
    0, // validUntil: 無期限
    true, // isTransferable: 譲渡可能
    "https://your-metadata-api.com/flagnft/collectible" // metadataURI
  );
  console.log("✅ COLLECTIBLE カテゴリ設定完了");

  console.log("\n🎉 すべてのセットアップが完了しました!\n");
  console.log("次のステップ:");
  console.log("1. BASE_URIを実際のメタデータAPIエンドポイントに変更");
  console.log("2. Supabaseのflag_nftsテーブルとコントラクトを連携");
  console.log("3. フロントエンドからmintWithCategory()を呼び出してNFT発行");
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
