// check-deploy-tx.cjs
const { ethers } = require('ethers');

async function checkDeployTx() {
  const txHash = '0xce10501d72db60923ccc1de55cdeb94bc175cd2b90f6efc213fdff140a9ee97d';
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');

  console.log('🔍 Deploy Transaction:', txHash);
  console.log('🔗 Polygonscan:', `https://polygonscan.com/tx/${txHash}`);

  const tx = await provider.getTransaction(txHash);

  if (!tx) {
    console.log('❌ トランザクションが見つかりません（まだpending pool）');
    return;
  }

  console.log('\n✅ Transaction found:');
  console.log('  From:', tx.from);
  console.log('  Block:', tx.blockNumber || 'Pending...');
  console.log('  Gas Price:', ethers.utils.formatUnits(tx.gasPrice || tx.maxFeePerGas, 'gwei'), 'Gwei');

  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    console.log('\n⏳ まだ確認されていません（Pending）');
    return;
  }

  console.log('\n✅ Transaction confirmed!');
  console.log('  Status:', receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED');
  console.log('  Block:', receipt.blockNumber);
  console.log('  Gas Used:', receipt.gasUsed.toString());
  console.log('  Contract Address:', receipt.contractAddress || 'N/A');
}

checkDeployTx()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
