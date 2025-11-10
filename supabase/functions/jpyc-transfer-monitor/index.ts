// supabase/functions/jpyc-transfer-monitor/index.ts
// JPYC Transfer イベントを監視し、受信通知を生成する Edge Function
// 定期的に実行され、最新のブロックをチェックして新しい送金を検知する

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const JPYC_TOKEN_ADDRESS = '0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c'; // Polygon JPYC
const POLYGON_RPC_URL = 'https://polygon-rpc.com';

// ERC20 Transfer イベントのシグネチャ
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

interface TransferEvent {
  blockNumber: string;
  transactionHash: string;
  from: string;
  to: string;
  value: string;
}

serve(async (req) => {
  try {
    console.log('🔍 JPYC Transfer Monitor started');

    // Supabase クライアントを初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 最後に処理したブロック番号を取得（または初期値）
    const { data: lastProcessedData } = await supabase
      .from('jpyc_monitor_state')
      .select('last_block_number')
      .single();

    // 最新ブロック番号を取得
    const latestBlockResponse = await fetch(POLYGON_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });
    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);

    const fromBlock = lastProcessedData?.last_block_number
      ? lastProcessedData.last_block_number + 1
      : latestBlock - 100; // 初回は100ブロック前から

    console.log(`📊 Scanning blocks ${fromBlock} to ${latestBlock}`);

    // Transfer イベントログを取得
    const logsResponse = await fetch(POLYGON_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [
          {
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${latestBlock.toString(16)}`,
            address: JPYC_TOKEN_ADDRESS,
            topics: [TRANSFER_EVENT_SIGNATURE],
          },
        ],
        id: 1,
      }),
    });

    const logsData = await logsResponse.json();
    const logs = logsData.result || [];

    console.log(`📝 Found ${logs.length} transfer events`);

    let notificationsCreated = 0;

    // 各 Transfer イベントを処理
    for (const log of logs) {
      const from = `0x${log.topics[1].slice(26)}`.toLowerCase();
      const to = `0x${log.topics[2].slice(26)}`.toLowerCase();
      const value = BigInt(log.data);
      const amount = (Number(value) / 1e18).toFixed(2); // 18 decimals

      console.log(`💴 Transfer: ${from} -> ${to}, Amount: ${amount} JPYC`);

      // 受信者（to）に通知を送信
      // ゼロアドレス（ミント）や自分自身への送金は除外
      if (
        to !== '0x0000000000000000000000000000000000000000' &&
        from !== to
      ) {
        // 重複チェック: 同じトランザクションハッシュの通知が既に存在するか
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('tx_hash', log.transactionHash)
          .eq('user_address', to)
          .single();

        if (!existingNotification) {
          // 通知を作成
          const { error: insertError } = await supabase
            .from('notifications')
            .insert({
              user_address: to,
              type: 'jpyc_received',
              title: 'JPYC を受け取りました',
              message: `${amount} JPYC が送金されました`,
              amount: amount,
              token_symbol: 'JPYC',
              from_address: from,
              tx_hash: log.transactionHash,
              metadata: {
                block_number: parseInt(log.blockNumber, 16),
              },
            });

          if (insertError) {
            console.error('❌ Failed to insert notification:', insertError);
          } else {
            console.log(`✅ Notification created for ${to}`);
            notificationsCreated++;
          }
        } else {
          console.log(`⏭️  Notification already exists for tx ${log.transactionHash}`);
        }
      }
    }

    // 最後に処理したブロック番号を更新
    await supabase
      .from('jpyc_monitor_state')
      .upsert({
        id: 1,
        last_block_number: latestBlock,
        updated_at: new Date().toISOString(),
      });

    console.log(`✅ Monitor completed: ${notificationsCreated} notifications created`);

    return new Response(
      JSON.stringify({
        success: true,
        blocksScanned: latestBlock - fromBlock + 1,
        eventsFound: logs.length,
        notificationsCreated,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in JPYC Transfer Monitor:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
