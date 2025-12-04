// check-jpyc-domain.cjs
// JPYCコントラクトのDOMAIN_SEPARATORを確認

const { ethers } = require('ethers');

const JPYC_ADDRESS = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';
const RPC_URL = 'https://polygon-rpc.com';

const JPYC_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
];

async function checkDomain() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const jpyc = new ethers.Contract(JPYC_ADDRESS, JPYC_ABI, provider);

  console.log('📋 JPYCコントラクト情報:');
  console.log('Address:', JPYC_ADDRESS);

  try {
    const name = await jpyc.name();
    const symbol = await jpyc.symbol();
    const decimals = await jpyc.decimals();

    console.log('\n✅ コントラクト情報:');
    console.log('name:', name);
    console.log('symbol:', symbol);
    console.log('decimals:', decimals);

    // Test nonce check
    const testAddress = '0x3595098a7ec66299641025d7b291ca8f198d765c';
    const testNonce = '0x50623bd3b9f0d109c45c47ecb5785978e6103d20deaf619b4b0eae9c94135beb';
    const isUsed = await jpyc.authorizationState(testAddress, testNonce);
    console.log(`\n🔍 Nonce ${testNonce.substring(0, 10)}... already used:`, isUsed);

    // 正しいEIP-712 Domainを推測
    console.log('\n📝 推奨されるEIP-712 Domain:');
    console.log(JSON.stringify({
      name: name,
      version: '2', // JPYCはv2
      chainId: 137,
      verifyingContract: JPYC_ADDRESS
    }, null, 2));

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error);
  }
}

checkDomain();
