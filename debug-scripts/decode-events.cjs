// Decode event topic hashes to find out what events are actually being emitted
const { ethers } = require('ethers');

// Known event signatures to test
const eventSignatures = [
  "Transfer(address,address,uint256)",
  "TipSent(address,uint256)",
  "Tipped(address,uint256)",
  "TipReceived(address,uint256)",
  "NFTMinted(address,uint256)",
  "Tip(address,uint256)",
  "UserTipped(address,uint256)",
  "DonationReceived(address,uint256)",
  "RewardClaimed(address,uint256)",
  "DailyRewardClaimed(address,uint256)",
  "LevelUp(address,uint256)",
  "NFTLevelUp(address,uint256,uint256)",
  "LevelChanged(address,uint256,uint256)",
];

// Mystery topic hashes from Block 28083479
const mysteryTopics = [
  "0x905516bf815c273f240e1d48d78ea7db3f1f0d00b912fc69522caf0ea70450a2",
  "0x3a8a89b59a31c39a36febecb987e0657ab7b7c73b60ebacb44dcb9886d2d5c8a",
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // This is definitely Transfer
];

console.log('🔍 Event Signature Decoder\n');
console.log('Mystery topics from Block 28083479:');
mysteryTopics.forEach((topic, i) => {
  console.log(`  ${i + 1}. ${topic}`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Try to match known signatures
eventSignatures.forEach(sig => {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sig));
  const match = mysteryTopics.find(t => t.toLowerCase() === hash.toLowerCase());

  if (match) {
    console.log(`✅ MATCH FOUND!`);
    console.log(`   Signature: ${sig}`);
    console.log(`   Hash: ${hash}`);
    console.log('');
  }
});

console.log('='.repeat(80) + '\n');

// Show all hashes for reference
console.log('All event signature hashes for reference:\n');
eventSignatures.forEach(sig => {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sig));
  console.log(`${sig.padEnd(40)} => ${hash}`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Specific check: What if the event is Tipped instead of TipSent?
const tippedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Tipped(address,uint256)"));
const tipSentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TipSent(address,uint256)"));

console.log('Comparison:');
console.log('  TipSent(address,uint256)  =>', tipSentHash);
console.log('  Tipped(address,uint256)   =>', tippedHash);
console.log('');

// Try variations with different parameter names (shouldn't matter, but let's check)
const variations = [
  "TipSent(address,uint256)",
  "TipSent(address user,uint256 amount)",
  "Tipped(address,uint256)",
  "Tipped(address from,uint256 amount)",
];

console.log('Event signature variations (parameter names should not affect hash):');
variations.forEach(sig => {
  const normalized = sig.replace(/\w+\s+(\w+)[,)]/g, '$1,').replace(/,$/, ')');
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(normalized));
  console.log(`  ${sig.padEnd(50)} => ${hash}`);
});
