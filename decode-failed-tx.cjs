// decode-failed-tx.cjs
const { ethers } = require('ethers');

const data = '0x18ba468dc7b1d0d11822d8122bc0d0bcd59c964bc203a3a35520b83b4a45015ca2f5705600000000000000000000000066f1274ad5d042b7571c2efa943370dbcd3459ab0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000006928261a000000000000000000000000000000000000000000000000000000000000001c81f942dddaa7816a9e3ca1e15f4c7e9cf71583f3b3876fd887e6b4dce3f7ff577410d840f824c9d5e5d344bb81f06a131661e097a728144f24a7c30d5d5abcbb';

const iface = new ethers.utils.Interface([
  'function executePaymentWithPermit(bytes32 requestId, address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
]);

const decoded = iface.decodeFunctionData('executePaymentWithPermit', data);

console.log('📋 失敗したトランザクションのパラメータ:');
console.log('requestId:', decoded.requestId);
console.log('merchant:', decoded.merchant);
console.log('amount:', decoded.amount.toString());
console.log('deadline:', decoded.deadline.toString(), '(', new Date(decoded.deadline * 1000).toISOString(), ')');
console.log('v:', decoded.v);
console.log('r:', decoded.r);
console.log('s:', decoded.s);

// 現在時刻と比較
const now = Math.floor(Date.now() / 1000);
console.log('\n⏰ 時刻確認:');
console.log('現在時刻:', now, '(', new Date(now * 1000).toISOString(), ')');
console.log('Deadline:', decoded.deadline.toString(), '(', new Date(decoded.deadline * 1000).toISOString(), ')');
console.log('期限切れ?:', now > decoded.deadline ? '❌ YES (期限切れ)' : '✅ NO (有効)');
