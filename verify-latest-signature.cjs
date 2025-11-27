// verify-latest-signature.cjs
// 最新のPermit署名を検証（18:41:26のログより）

const { ethers } = require('ethers');

async function verifyLatestSignature() {
  // 18:41:26のログから取得
  const requestId = '0x74a149c306124840ac5ce2b3d6659a2aed7b4231a118ddb1784e250e5fc53795';
  const merchant = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  const amount = '1000000000000000000'; // 1 JPYC
  const deadline = 1764238280; // 0x692823c8
  const v = 27;
  const r = '0x100fe5d2b818c69c2ef50f0d9edd3c761ca9412a3e9925c5d1df78e693e7b295';
  const s = '0x66b18e0bb7cb0193c135adf416d855555e5e19429d096b4b50be7fac9591773d';

  const owner = '0x3595098A7EC66299641025d7b291ca8f198D765c';
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';
  const paymentGatewayAddress = '0x9e9a065637323CDfC7c7C8185425fCE248854c9E';

  console.log('📋 最新のPermit署名検証 (18:41:26)');
  console.log('Owner:', owner);
  console.log('Spender (PaymentGateway):', paymentGatewayAddress);
  console.log('Amount:', amount);
  console.log('Deadline:', deadline, '(', new Date(deadline * 1000).toISOString(), ')');
  console.log('Signature:', { v, r, s });

  // RPCプロバイダー接続
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
  const tokenContract = new ethers.Contract(
    jpycAddress,
    [
      'function nonces(address owner) view returns (uint256)',
      'function name() view returns (string)',
    ],
    provider
  );

  const nonce = await tokenContract.nonces(owner);
  const tokenName = await tokenContract.name();

  console.log('\n📡 Chain情報:');
  console.log('Token Name:', tokenName);
  console.log('Current Nonce:', nonce.toString());

  // EIP-712 Domain
  const domain = {
    name: tokenName,
    version: '1',
    chainId: 137,
    verifyingContract: jpycAddress,
  };

  // Permit Type
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  // Permit Value
  const value = {
    owner: owner,
    spender: paymentGatewayAddress,
    value: amount,
    nonce: nonce.toNumber(),
    deadline: deadline,
  };

  console.log('\n📝 EIP-712 Message:');
  console.log('Domain:', domain);
  console.log('Value:', value);

  // EIP-712のhashを計算
  const digest = ethers.utils._TypedDataEncoder.hash(domain, types, value);
  console.log('\n🔐 EIP-712 Digest:', digest);

  // 署名から公開鍵を復元
  const signature = ethers.utils.joinSignature({ v, r, s });
  const recoveredAddress = ethers.utils.recoverAddress(digest, signature);

  console.log('\n✅ Recovered Address:', recoveredAddress);
  console.log('🎯 Expected Owner:', owner);
  console.log('🔍 Match:', recoveredAddress.toLowerCase() === owner.toLowerCase() ? '✅ 一致' : '❌ 不一致');

  // Deadline確認
  const now = Math.floor(Date.now() / 1000);
  console.log('\n⏰ Deadline確認:');
  console.log('現在時刻:', now, '(', new Date(now * 1000).toISOString(), ')');
  console.log('Deadline:', deadline, '(', new Date(deadline * 1000).toISOString(), ')');
  console.log('期限切れ?:', now > deadline ? '❌ YES' : '✅ NO');

  // Contract Callシミュレーション
  console.log('\n🧪 Contract Call シミュレーション:');
  const gatewayInterface = new ethers.utils.Interface([
    'function executePaymentWithPermit(bytes32 requestId, address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  ]);

  const callData = gatewayInterface.encodeFunctionData('executePaymentWithPermit', [
    requestId,
    merchant,
    amount,
    deadline,
    v,
    r,
    s,
  ]);

  try {
    const result = await provider.call({
      from: owner,
      to: paymentGatewayAddress,
      data: callData,
    });
    console.log('結果: ✅ 成功');
    console.log('戻り値:', result);
  } catch (error) {
    console.log('結果: ❌ 失敗');
    console.error('エラー:', error.message);

    // Revert reasonの抽出を試行
    if (error.data) {
      console.log('\nRevert Data:', error.data);
    }
    if (error.error?.data) {
      console.log('Error.error.data:', error.error.data);
    }
  }
}

verifyLatestSignature()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
