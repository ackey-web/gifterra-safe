// Test script to check what events were emitted at Block 28083479
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC";
const TARGET_BLOCK = 28083479;
const PUBLIC_RPC = "https://rpc-amoy.polygon.technology";

// Calculate topic hash for TipSent(address,uint256)
const TOPIC_TIPSENT = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("TipSent(address,uint256)")
);

console.log('🔍 Diagnostic Test for Tip Events\n');
console.log('Contract:', CONTRACT_ADDRESS);
console.log('Target Block:', TARGET_BLOCK);
console.log('TipSent Topic Hash:', TOPIC_TIPSENT);
console.log('');

async function testRPC() {
  // Test 1: Get ALL events from the target block
  console.log('📋 Test 1: Get ALL events from block', TARGET_BLOCK);
  const allEventsRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getLogs",
    params: [{
      address: CONTRACT_ADDRESS,
      fromBlock: "0x" + TARGET_BLOCK.toString(16),
      toBlock: "0x" + TARGET_BLOCK.toString(16),
    }]
  };

  try {
    const res1 = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(allEventsRequest),
    });
    const json1 = await res1.json();

    if (json1.error) {
      console.error('❌ Error:', json1.error);
    } else {
      console.log(`✅ Found ${json1.result.length} total events from contract`);
      json1.result.forEach((log, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log('  Topics:', log.topics);
        console.log('  Data:', log.data);
        console.log('  Block:', parseInt(log.blockNumber, 16));
        console.log('  TxHash:', log.transactionHash);
      });
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 2: Filter specifically for TipSent events
  console.log('📋 Test 2: Filter for TipSent events');
  const tipSentRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "eth_getLogs",
    params: [{
      address: CONTRACT_ADDRESS,
      fromBlock: "0x" + TARGET_BLOCK.toString(16),
      toBlock: "0x" + TARGET_BLOCK.toString(16),
      topics: [TOPIC_TIPSENT]
    }]
  };

  try {
    const res2 = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tipSentRequest),
    });
    const json2 = await res2.json();

    if (json2.error) {
      console.error('❌ Error:', json2.error);
    } else {
      console.log(`✅ Found ${json2.result.length} TipSent events`);
      json2.result.forEach((log, i) => {
        console.log(`\nTipSent Event ${i + 1}:`);
        console.log('  User (indexed):', log.topics[1]);
        console.log('  Amount:', log.data);
        console.log('  TxHash:', log.transactionHash);
      });
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 3: Check a wider block range (28083470 - 28083490)
  console.log('📋 Test 3: Check wider range (28083470 - 28083490)');
  const widerRangeRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "eth_getLogs",
    params: [{
      address: CONTRACT_ADDRESS,
      fromBlock: "0x" + (TARGET_BLOCK - 10).toString(16),
      toBlock: "0x" + (TARGET_BLOCK + 10).toString(16),
      topics: [TOPIC_TIPSENT]
    }]
  };

  try {
    const res3 = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(widerRangeRequest),
    });
    const json3 = await res3.json();

    if (json3.error) {
      console.error('❌ Error:', json3.error);
    } else {
      console.log(`✅ Found ${json3.result.length} TipSent events in range`);
      json3.result.forEach((log, i) => {
        const block = parseInt(log.blockNumber, 16);
        console.log(`\nTipSent Event ${i + 1} at block ${block}:`);
        console.log('  TxHash:', log.transactionHash);
      });
    }
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
}

testRPC().catch(console.error);
