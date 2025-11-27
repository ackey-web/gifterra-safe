// check-nonce.cjs
// JPYCトークンの現在のnonce値を確認

const { ethers } = require('ethers');

async function checkNonce() {
  const owner = '0x3595098A7EC66299641025d7b291ca8f198D765c';
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';

  console.log('📡 Polygon RPCに接続...');
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');

  const tokenContract = new ethers.Contract(
    jpycAddress,
    [
      'function nonces(address owner) view returns (uint256)',
      'function name() view returns (string)',
    ],
    provider
  );

  console.log('🔍 Owner:', owner);
  console.log('🔍 JPYC Token:', jpycAddress);

  const nonce = await tokenContract.nonces(owner);
  const name = await tokenContract.name();

  console.log('\n✅ Token Name:', name);
  console.log('✅ Current Nonce:', nonce.toString());
}

checkNonce()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
