// test-contract-call.cjs
// PaymentGateway契約呼び出しのテスト

const { ethers } = require('ethers');

async function testContractCall() {
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');

  // 実際のパラメータ
  const requestId = '0xaa75f4c35832360a0a99cc9314a686cb7f9276232118b4e20a9917f9ebd7f1e4';
  const merchant = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  const amount = '1000000000000000000'; // 1 JPYC
  const deadline = 1764237522; // 0x692821d2
  const v = 28; // 0x1c
  const r = '0x0e757909f2996e073e6412a17e07cb0b4900ba67d08b05a7c8f35d51f51361265';
  const s = '0x0d487ad231620e1747eef19f9f348efad05218e833fb04bf2ee58a79f7bbddc2';

  const owner = '0x3595098A7EC66299641025d7b291ca8f198D765c';
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';
  const paymentGatewayAddress = '0x9e9a065637323CDfC7c7C8185425fCE248854c9E';

  console.log('📋 テスト開始');
  console.log('RequestId:', requestId);
  console.log('Merchant:', merchant);
  console.log('Amount:', amount);
  console.log('Deadline:', deadline, '(', new Date(deadline * 1000).toISOString(), ')');
  console.log('Signature:', { v, r, s });

  // 1. Deadline確認
  const now = Math.floor(Date.now() / 1000);
  console.log('\n⏰ Deadline確認:');
  console.log('  現在時刻:', now, '(', new Date(now * 1000).toISOString(), ')');
  console.log('  Deadline:', deadline, '(', new Date(deadline * 1000).toISOString(), ')');
  console.log('  期限切れ?:', now > deadline ? '❌ YES (期限切れ)' : '✅ NO (有効)');

  // 2. RequestID確認
  const gateway = new ethers.Contract(
    paymentGatewayAddress,
    [
      'function processedRequests(bytes32) view returns (bool)',
      'function jpyc() view returns (address)',
    ],
    provider
  );

  const isProcessed = await gateway.processedRequests(requestId);
  console.log('\n🔍 RequestID確認:');
  console.log('  処理済み?:', isProcessed ? '❌ YES (既に処理済み)' : '✅ NO (未処理)');

  // 3. 残高確認
  const jpyc = new ethers.Contract(
    jpycAddress,
    [
      'function balanceOf(address) view returns (uint256)',
      'function nonces(address) view returns (uint256)',
      'function name() view returns (string)',
    ],
    provider
  );

  const balance = await jpyc.balanceOf(owner);
  const nonce = await jpyc.nonces(owner);
  const tokenName = await jpyc.name();

  console.log('\n💰 残高確認:');
  console.log('  Owner:', owner);
  console.log('  残高:', ethers.utils.formatEther(balance), 'JPYC');
  console.log('  必要額:', ethers.utils.formatEther(amount), 'JPYC');
  console.log('  足りる?:', balance.gte(amount) ? '✅ YES' : '❌ NO (残高不足)');
  console.log('  Nonce:', nonce.toString());

  // 4. Permit署名検証 (スキップ - 既にverify-permit-signature.cjsで検証済み)
  console.log('\n🔐 Permit署名検証: (スキップ)');

  // 5. コントラクト呼び出しシミュレーション
  console.log('\n🧪 Contract Call シミュレーション:');
  try {
    const gatewayInterface = new ethers.utils.Interface([
      'function executePaymentWithPermit(bytes32 requestId, address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
    ]);

    const data = gatewayInterface.encodeFunctionData('executePaymentWithPermit', [
      requestId,
      merchant,
      amount,
      deadline,
      v,
      r,
      s,
    ]);

    const result = await provider.call({
      from: owner,
      to: paymentGatewayAddress,
      data: data,
    });

    console.log('  結果: ✅ 成功');
    console.log('  戻り値:', result);
  } catch (callError) {
    console.log('  結果: ❌ 失敗');
    console.error('  エラー:', callError.message);
    console.error('  詳細:', callError.reason || callError.error?.message || 'Unknown');

    // Revert reasonを抽出
    if (callError.data) {
      console.log('  Revert data:', callError.data);
      try {
        const reason = ethers.utils.toUtf8String('0x' + callError.data.substring(138));
        console.log('  Revert reason:', reason);
      } catch (e) {
        console.log('  Revert reason: (デコードできず)');
      }
    }
  }

  console.log('\n✅ テスト完了');
}

testContractCall()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
