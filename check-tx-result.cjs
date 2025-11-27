// check-tx-result.cjs
// トランザクション結果を確認

const { ethers } = require('ethers');

async function checkTxResult() {
  const txHash = '0x95598297ecf6b1a7b01d713563142c3c55bfbdd94396847022fdbdd045d68bc5';

  console.log('📡 Polygon RPCに接続...');
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');

  console.log('🔍 Transaction Hash:', txHash);
  console.log('🔗 Polygonscan:', `https://polygonscan.com/tx/${txHash}`);

  console.log('\n⏳ トランザクション取得中...');
  const tx = await provider.getTransaction(txHash);

  if (!tx) {
    console.log('❌ トランザクションが見つかりません');
    return;
  }

  console.log('✅ トランザクション情報:');
  console.log('  From:', tx.from);
  console.log('  To:', tx.to);
  console.log('  Gas Limit:', tx.gasLimit.toString());
  console.log('  Gas Price:', ethers.utils.formatUnits(tx.gasPrice, 'gwei'), 'Gwei');
  console.log('  Block Number:', tx.blockNumber || 'Pending...');

  console.log('\n⏳ Receipt取得中...');
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    console.log('⚠️ まだ確認されていません（Pending状態）');
    return;
  }

  console.log('✅ Receipt:');
  console.log('  Status:', receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED');
  console.log('  Block Number:', receipt.blockNumber);
  console.log('  Gas Used:', receipt.gasUsed.toString());
  console.log('  Cumulative Gas Used:', receipt.cumulativeGasUsed.toString());

  if (receipt.status === 1) {
    console.log('\n🎉 トランザクション成功！');

    // イベントログを確認
    console.log('\n📋 イベントログ:');
    receipt.logs.forEach((log, index) => {
      console.log(`  Log ${index}:`, log.topics[0]);
    });
  } else {
    console.log('\n❌ トランザクション失敗');
  }
}

checkTxResult()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
