// decode-tx-data.cjs
// トランザクションデータをデコード

const { ethers } = require('ethers');

const txData = '0x18ba468daa75f4c35832360a0a99cc9314a686cb7f9276232118b4e20a9917f9ebd7f1e400000000000000000000000066f1274ad5d042b7571c2efa943370dbcd3459ab0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000692821d2000000000000000000000000000000000000000000000000000000000000001ce757909f2996e073e6412a17e07cb0b4900ba67d08b05a7c8f35d51f513612650d487ad231620e1747eef19f9f348efad05218e833fb04bf2ee58a79f7bbddc2';

const iface = new ethers.utils.Interface([
  'function executePaymentWithPermit(bytes32 requestId, address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
]);

try {
  const decoded = iface.decodeFunctionData('executePaymentWithPermit', txData);

  console.log('📋 デコード結果:');
  console.log('requestId:', decoded.requestId);
  console.log('merchant:', decoded.merchant);
  console.log('amount:', decoded.amount.toString());
  console.log('deadline:', decoded.deadline.toString());
  console.log('v:', decoded.v);
  console.log('r:', decoded.r);
  console.log('s:', decoded.s);
} catch (error) {
  console.error('❌ デコードエラー:', error.message);
}
