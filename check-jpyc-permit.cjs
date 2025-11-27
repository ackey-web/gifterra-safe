// check-jpyc-permit.cjs
// JPYCトークンのPermit実装を確認

const { ethers } = require('ethers');

async function checkJPYC() {
  const jpycAddress = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');

  const jpycContract = new ethers.Contract(
    jpycAddress,
    [
      'function name() view returns (string)',
      'function version() view returns (string)',
      'function DOMAIN_SEPARATOR() view returns (bytes32)',
      'function nonces(address owner) view returns (uint256)',
      'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
    ],
    provider
  );

  console.log('📋 JPYC Permit情報確認:');
  console.log('アドレス:', jpycAddress);

  try {
    const name = await jpycContract.name();
    console.log('✅ name:', name);
  } catch (e) {
    console.log('❌ name:', e.message);
  }

  try {
    const version = await jpycContract.version();
    console.log('✅ version:', version);
  } catch (e) {
    console.log('❌ version:', e.message);
  }

  try {
    const domainSeparator = await jpycContract.DOMAIN_SEPARATOR();
    console.log('✅ DOMAIN_SEPARATOR:', domainSeparator);
  } catch (e) {
    console.log('❌ DOMAIN_SEPARATOR:', e.message);
  }

  // テストアドレスでnonceを確認
  const testAddress = '0x3595098A7EC66299641025d7b291ca8f198D765c';
  try {
    const nonce = await jpycContract.nonces(testAddress);
    console.log('✅ nonces(' + testAddress + '):', nonce.toString());
  } catch (e) {
    console.log('❌ nonces:', e.message);
  }

  // permit関数の存在確認
  try {
    const permitFunction = jpycContract.interface.getFunction('permit');
    console.log('✅ permit関数:', permitFunction.format());
  } catch (e) {
    console.log('❌ permit関数:', e.message);
  }
}

checkJPYC()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
