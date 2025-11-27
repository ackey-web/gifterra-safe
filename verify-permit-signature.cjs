// verify-permit-signature.cjs
// Permit署名の検証スクリプト

const { ethers } = require('ethers');

async function verifyPermitSignature() {
  // 実際のトランザクションパラメータ
  const merchant = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  const amount = '1000000000000000000'; // 1 JPYC
  const deadline = 1764086547; // 0x6927cf13
  const v = 28; // 0x1c
  const r = '0xf65d9136fe581622d6cb56cb70886f76bc841ee6751df0c8c22542a3682ceddb';
  const s = '0x62dab745be33da09195b5df66be1d62215c12a4813d967af685341f3c80d0021';

  const owner = '0x3595098A7EC66299641025d7b291ca8f198D765c';
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';
  const paymentGatewayAddress = '0x9e9a065637323CDfC7c7C8185425fCE248854c9E';

  console.log('📋 Permit署名検証');
  console.log('Owner:', owner);
  console.log('Spender (PaymentGateway):', paymentGatewayAddress);
  console.log('Amount:', amount);
  console.log('Deadline:', deadline);
  console.log('Signature:', { v, r, s });

  // EIP-712 Domain
  const domain = {
    name: 'JPY Coin',
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

  // Permit Value (nonce = 0 と仮定)
  const value = {
    owner: owner,
    spender: paymentGatewayAddress,
    value: amount,
    nonce: 0,
    deadline: deadline,
  };

  console.log('\n📝 EIP-712 Message:');
  console.log('Domain:', domain);
  console.log('Types:', types);
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
}

verifyPermitSignature()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
