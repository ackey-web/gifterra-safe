// src/admin/revenue/RevenueManagement.tsx
// PaymentSplitter収益管理UI

import { useEffect, useState, useMemo } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { createWalletClient, custom } from 'viem';
import { polygonAmoy } from 'viem/chains';
import {
  fetchDonationEvents,
  calculateRevenueSummary,
  calculateProductRevenue,
  withdrawRevenue,
  type DonationEvent,
  type RevenueSummary,
  type ProductRevenue,
} from '../../lib/paymentSplitter';
import { useTenant } from '../contexts/TenantContext';
import { getAvailableTokens } from '../../config/tokens';

export default function RevenueManagement() {
  const address = useAddress();
  const { tenant } = useTenant();

  // 状態管理
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>(''); // 選択中のトークンアドレス
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [productRevenues, setProductRevenues] = useState<ProductRevenue[]>([]);

  // PaymentSplitterアドレス
  const paymentSplitterAddress = tenant?.contracts?.paymentSplitter;

  // 利用可能なトークン一覧
  const availableTokens = useMemo(() => getAvailableTokens(true), []);

  // イベントログを取得
  const loadRevenueData = async () => {
    if (!paymentSplitterAddress || paymentSplitterAddress === '0x0000000000000000000000000000000000000000') {
      alert('⚠️ PaymentSplitterが設定されていません');
      return;
    }

    setIsLoading(true);
    try {
      // 過去30日分のブロックを取得（約30日 = 約120万ブロック）
      const toBlock = 'latest';
      const fromBlock = 0n; // TODO: 効率化のため最近のブロックのみ取得

      const donationEvents = await fetchDonationEvents(
        paymentSplitterAddress,
        fromBlock,
        toBlock
      );

      setEvents(donationEvents);

      // デフォルトで最初のトークンを選択
      if (donationEvents.length > 0 && !selectedToken) {
        setSelectedToken(donationEvents[0].token);
      }
    } catch (error) {
      console.error('Failed to load revenue data:', error);
      alert('収益データの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // イベントデータから集計
  useEffect(() => {
    if (events.length === 0) return;

    const revenueSummary = calculateRevenueSummary(events, selectedToken || undefined);
    const productRev = calculateProductRevenue(events, selectedToken || undefined);

    setSummary(revenueSummary);
    setProductRevenues(productRev);
  }, [events, selectedToken]);

  // 初回読み込み
  useEffect(() => {
    if (paymentSplitterAddress && paymentSplitterAddress !== '0x0000000000000000000000000000000000000000') {
      loadRevenueData();
    }
  }, [paymentSplitterAddress]);

  // 出金処理
  const handleWithdraw = async () => {
    if (!address) {
      alert('⚠️ ウォレットを接続してください');
      return;
    }

    if (!paymentSplitterAddress || !selectedToken) {
      alert('⚠️ PaymentSplitterまたはトークンが選択されていません');
      return;
    }

    const confirmed = window.confirm(
      `収益を出金しますか？\n\nトークン: ${summary?.tokenSymbol}\n総額: ${summary?.totalDonationsFormatted} ${summary?.tokenSymbol}\n\n※ 配分比率に応じて各受取人のウォレットに自動振り分けされます`
    );

    if (!confirmed) return;

    try {
      // WalletClientを作成
      const walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain: polygonAmoy,
        transport: custom((window as any).ethereum),
      });

      const txHash = await withdrawRevenue(
        paymentSplitterAddress,
        selectedToken,
        walletClient
      );

      alert(`✅ 出金トランザクションを送信しました\n\nTx: ${txHash}\n\n確認後、収益データを再読み込みしてください。`);

      // データ再読み込み
      setTimeout(() => loadRevenueData(), 3000);
    } catch (error: any) {
      console.error('Withdraw failed:', error);
      alert(`❌ 出金に失敗しました\n\n${error?.message || error}`);
    }
  };

  // トークン選択変更
  const handleTokenChange = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 800 }}>
          💰 収益管理
        </h1>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
          PaymentSplitterの収益確認・出金
        </p>
      </div>

      {/* PaymentSplitter未設定の場合 */}
      {(!paymentSplitterAddress || paymentSplitterAddress === '0x0000000000000000000000000000000000000000') && (
        <div
          style={{
            padding: 24,
            background: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: '#ff9800' }}>⚠️ PaymentSplitter未設定</h3>
          <p style={{ margin: 0, fontSize: 14 }}>
            テナント設定でPaymentSplitterアドレスを設定してください。
          </p>
        </div>
      )}

      {/* トークン選択 */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            トークン選択
          </label>
          <select
            value={selectedToken}
            onChange={(e) => handleTokenChange(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px solid #ddd',
              fontSize: 14,
              minWidth: 200,
            }}
            disabled={events.length === 0}
          >
            <option value="">全トークン</option>
            {Array.from(new Set(events.map(e => e.token))).map(tokenAddr => {
              const token = availableTokens.find(t => t.currentAddress.toLowerCase() === tokenAddr.toLowerCase());
              return (
                <option key={tokenAddr} value={tokenAddr}>
                  {token?.symbol || tokenAddr.slice(0, 10)}
                </option>
              );
            })}
          </select>
        </div>

        <button
          onClick={loadRevenueData}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            marginTop: 'auto',
          }}
        >
          {isLoading ? '読み込み中...' : '🔄 データ更新'}
        </button>
      </div>

      {/* サマリーカード */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {/* 総収益 */}
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>総収益</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {summary.totalDonationsFormatted} {summary.tokenSymbol}
            </div>
          </div>

          {/* 販売数 */}
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>販売数</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.donationCount}件</div>
          </div>

          {/* 商品数 */}
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>販売商品数</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.uniqueProducts}商品</div>
          </div>
        </div>
      )}

      {/* 出金ボタン */}
      {summary && summary.totalDonations > 0n && (
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <button
            onClick={handleWithdraw}
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
            }}
          >
            💸 収益を出金する
          </button>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, opacity: 0.7 }}>
            ※ 配分比率に応じて各受取人のウォレットに自動振り分けされます
          </p>
        </div>
      )}

      {/* 商品別収益テーブル */}
      {productRevenues.length > 0 && (
        <div>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700 }}>
            📊 商品別収益
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#fff',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: 16, textAlign: 'left', fontWeight: 600 }}>商品SKU</th>
                  <th style={{ padding: 16, textAlign: 'right', fontWeight: 600 }}>販売数</th>
                  <th style={{ padding: 16, textAlign: 'right', fontWeight: 600 }}>売上</th>
                </tr>
              </thead>
              <tbody>
                {productRevenues.map((rev, idx) => (
                  <tr
                    key={rev.sku}
                    style={{
                      borderTop: idx === 0 ? 'none' : '1px solid #e5e7eb',
                    }}
                  >
                    <td style={{ padding: 16, fontFamily: 'monospace' }}>{rev.sku}</td>
                    <td style={{ padding: 16, textAlign: 'right' }}>{rev.salesCount}件</td>
                    <td style={{ padding: 16, textAlign: 'right', fontWeight: 600 }}>
                      {rev.totalAmountFormatted} {rev.tokenSymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* データなし */}
      {events.length === 0 && !isLoading && paymentSplitterAddress && paymentSplitterAddress !== '0x0000000000000000000000000000000000000000' && (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px dashed #cbd5e1',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
            収益データがありません
          </h3>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
            商品が購入されると、ここに収益データが表示されます。
          </p>
        </div>
      )}
    </div>
  );
}
