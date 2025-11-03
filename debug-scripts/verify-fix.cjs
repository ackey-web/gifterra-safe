// Verify the fix: Query for Tipped events instead of TipSent
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC";
const PUBLIC_RPC = "https://rpc-amoy.polygon.technology";

// ✅ CORRECT event signature (as deployed)
const TOPIC_TIPPED = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("Tipped(address,uint256)")
);

console.log('🔍 Verifying Fix: Searching for Tipped events\n');
console.log('Tipped Topic Hash:', TOPIC_TIPPED);
console.log('');

async function verifyFix() {
  // Test with a wide range to find all Tipped events
  const fromBlock = 28083470;
  const toBlock = 28083490;

  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getLogs",
    params: [{
      address: CONTRACT_ADDRESS,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      topics: [TOPIC_TIPPED]
    }]
  };

  try {
    const res = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const json = await res.json();

    if (json.error) {
      console.error('❌ Error:', json.error);
    } else {
      console.log(`✅ Found ${json.result.length} Tipped events in blocks ${fromBlock}-${toBlock}`);

      if (json.result.length > 0) {
        console.log('\n📊 Tipped Events:');
        json.result.forEach((log, i) => {
          const block = parseInt(log.blockNumber, 16);
          const user = '0x' + log.topics[1].slice(26); // Remove padding from indexed address
          const amount = ethers.BigNumber.from(log.data).toString();
          const amountFormatted = ethers.utils.formatUnits(amount, 18);

          console.log(`\nEvent ${i + 1}:`);
          console.log(`  Block: ${block}`);
          console.log(`  User: ${user}`);
          console.log(`  Amount: ${amountFormatted} tNHT`);
          console.log(`  TxHash: ${log.transactionHash}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

verifyFix().catch(console.error);
