// get-revert-reason.cjs
// トランザクションのリバート理由を取得

const { ethers } = require('ethers');

async function getRevertReason() {
  const txHash = '0x95598297ecf6b1a7b01d713563142c3c55bfbdd94396847022fdbdd045d68bc5';

  console.log('📡 Polygon RPCに接続...');
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');

  console.log('🔍 Transaction Hash:', txHash);

  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (receipt.status === 1) {
    console.log('✅ トランザクション成功');
    return;
  }

  console.log('❌ トランザクション失敗');
  console.log('\n🔍 リバート理由を取得中...');

  try {
    // トランザクションを再実行してリバート理由を取得
    const result = await provider.call(tx, tx.blockNumber);
    console.log('Result:', result);
  } catch (error) {
    console.log('\n📋 Error details:');
    console.log('  Message:', error.message);
    console.log('  Code:', error.code);

    if (error.data) {
      console.log('  Data:', error.data);

      // Revert reasonをデコード
      try {
        const reason = ethers.utils.toUtf8String('0x' + error.data.substring(138));
        console.log('\n🔍 Revert Reason:', reason);
      } catch (e) {
        console.log('\n🔍 Revert Reason (hex):', error.data);

        // Error(string)のシグネチャ
        if (error.data.startsWith('0x08c379a0')) {
          const reason = ethers.utils.defaultAbiCoder.decode(
            ['string'],
            '0x' + error.data.substring(10)
          );
          console.log('🔍 Decoded Revert Reason:', reason[0]);
        }
      }
    }

    if (error.reason) {
      console.log('\n🔍 Reason:', error.reason);
    }
  }
}

getRevertReason()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
