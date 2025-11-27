// verify-v28-signature.cjs
// v=28の署名を検証

const { ethers } = require('ethers');

async function verifyV28Signature() {
  // 失敗したトランザクションのパラメータ
  const requestId = '0xc7b1d0d11822d8122bc0d0bcd59c964bc203a3a35520b83b4a45015ca2f57056';
  const merchant = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';
  const amount = '1000000000000000000';
  const deadline = 1764238874;
  const v = 28;
  const r = '0x81f942dddaa7816a9e3ca1e15f4c7e9cf71583f3b3876fd887e6b4dce3f7ff57';
  const s = '0x7410d840f824c9d5e5d344bb81f06a131661e097a728144f24a7c30d5d5abcbb';

  const owner = '0x3595098A7EC66299641025d7b291ca8f198D765c';
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';
  const paymentGatewayAddress = '0x9e9a065637323CDfC7c7C8185425fCE248854c9E';

  console.log('📋 v=28署名検証');
  console.log('Owner (expected):', owner);
  console.log('Spender (PaymentGateway):', paymentGatewayAddress);
  console.log('v:', v);

  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
  const tokenContract = new ethers.Contract(
    jpycAddress,
    ['function nonces(address owner) view returns (uint256)', 'function name() view returns (string)'],
    provider
  );

  const nonce = await tokenContract.nonces(owner);
  const tokenName = await tokenContract.name();

  console.log('\nNonce:', nonce.toString());
  console.log('Token Name:', tokenName);

  // EIP-712
  const domain = {
    name: tokenName,
    version: '1',
    chainId: 137,
    verifyingContract: jpycAddress,
  };

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const value = {
    owner: owner,
    spender: paymentGatewayAddress,
    value: amount,
    nonce: nonce.toNumber(),
    deadline: deadline,
  };

  const digest = ethers.utils._TypedDataEncoder.hash(domain, types, value);
  console.log('\nDigest:', digest);

  // v=28で署名復元
  const signature28 = ethers.utils.joinSignature({ v: 28, r, s });
  const recovered28 = ethers.utils.recoverAddress(digest, signature28);

  console.log('\n🔍 v=28:');
  console.log('  Recovered:', recovered28);
  console.log('  Expected:', owner);
  console.log('  Match?:', recovered28.toLowerCase() === owner.toLowerCase() ? '✅ YES' : '❌ NO');

  // v=27でも試す
  const signature27 = ethers.utils.joinSignature({ v: 27, r, s });
  const recovered27 = ethers.utils.recoverAddress(digest, signature27);

  console.log('\n🔍 v=27:');
  console.log('  Recovered:', recovered27);
  console.log('  Expected:', owner);
  console.log('  Match?:', recovered27.toLowerCase() === owner.toLowerCase() ? '✅ YES' : '❌ NO');
}

verifyV28Signature()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
