// src/utils/paymentExport.ts
// 決済データのエクスポートと領収書生成ユーティリティ

interface PaymentRecord {
  id: string;
  request_id: string;
  amount: string;
  completed_at: string;
  completed_by: string;
  message?: string;
  tenant_address: string;
}

/**
 * 決済データをCSV形式に変換
 */
export function generateCSV(payments: PaymentRecord[]): string {
  // CSVヘッダー
  const headers = [
    '決済日時',
    '金額（円）',
    '支払者アドレス',
    'リクエストID',
    '備考',
  ];

  // CSVボディ
  const rows = payments.map((payment) => {
    const date = new Date(payment.completed_at).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      date,
      payment.amount,
      payment.completed_by,
      payment.request_id,
      payment.message || '',
    ].map(field => `"${field}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * CSVファイルとしてダウンロード
 */
export function downloadCSV(csvContent: string, filename: string) {
  // BOM付きUTF-8でエンコード（Excel対応）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * デジタル領収書のHTML生成
 */
export function generateReceiptHTML(payment: PaymentRecord, storeName?: string): string {
  const date = new Date(payment.completed_at).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const storeAddress = payment.tenant_address;
  const displayStoreName = storeName || `店舗 ${storeAddress.slice(0, 8)}...${storeAddress.slice(-6)}`;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JPYC送付明細</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .receipt {
      background: white;
      max-width: 480px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header-logo {
      width: 120px;
      height: auto;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 24px;
    }
    .amount-section {
      text-align: center;
      padding: 24px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 12px;
      margin-bottom: 32px;
    }
    .amount-label {
      font-size: 13px;
      color: #059669;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 42px;
      font-weight: 700;
      color: #059669;
      font-family: 'Courier New', monospace;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 14px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-size: 13px;
      color: #6b7280;
      font-weight: 600;
    }
    .detail-value {
      font-size: 13px;
      color: #1f2937;
      font-weight: 500;
      text-align: right;
      max-width: 60%;
      word-break: break-all;
      font-family: 'Courier New', monospace;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 24px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-note {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .footer-brand {
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      font-weight: 600;
    }
    .blockchain-badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
    }
    @media print {
      body {
        background: white;
      }
      .receipt {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>JPYC送付明細</h1>
      <p>JPYC Transfer Details</p>
    </div>

    <div class="content">
      <div class="amount-section">
        <div class="amount-label">お支払い金額</div>
        <div class="amount-value">${parseInt(payment.amount).toLocaleString()} JPYC</div>
        <div class="blockchain-badge">🔐 Blockchain Verified</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">決済日時</div>
        <div class="detail-value">${date}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">店舗</div>
        <div class="detail-value">${displayStoreName}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">店舗アドレス</div>
        <div class="detail-value">${storeAddress}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">送信者アドレス</div>
        <div class="detail-value">${payment.completed_by}</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">リクエストID</div>
        <div class="detail-value">${payment.request_id}</div>
      </div>

      ${payment.message ? `
      <div class="detail-row">
        <div class="detail-label">備考</div>
        <div class="detail-value">${payment.message}</div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <div class="footer-note">
        ※ この記録は、ブロックチェーン上で実行されたJPYCトランザクションの存在を証明するものです。<br>
        ※ トランザクションの詳細はPolygonScan等で上記アドレスを検索して確認できます。<br>
        ※ 返金については当事者間の合意により受領者が別送金で対応する場合があります。
      </div>
      <div class="footer-brand">
        GIFTERRA - JPYC Payment System<br>
        Patent Pending (特願2025-120883)
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 領収書HTMLをファイルとして共有
 */
export async function shareReceipt(payment: PaymentRecord, storeName?: string) {
  const html = generateReceiptHTML(payment, storeName);
  const blob = new Blob([html], { type: 'text/html' });
  const file = new File([blob], `receipt_${payment.request_id}.html`, { type: 'text/html' });

  // Web Share API対応チェック
  if (navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'JPYC送付明細',
        text: `送信金額: ${parseInt(payment.amount).toLocaleString()} JPYC`,
        files: [file],
      });
      return { success: true };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      throw error;
    }
  } else {
    // フォールバック: ダウンロード
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${payment.request_id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true, fallback: true };
  }
}

/**
 * 期間フィルタリング
 */
export function filterPaymentsByPeriod(
  payments: PaymentRecord[],
  period: 'today' | 'week' | 'month' | 'custom',
  customStart?: Date,
  customEnd?: Date
): PaymentRecord[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let startDate: Date;
  let endDate: Date = now;

  switch (period) {
    case 'today':
      startDate = today;
      break;
    case 'week':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
      break;
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom period requires start and end dates');
      }
      startDate = customStart;
      endDate = customEnd;
      break;
  }

  return payments.filter((payment) => {
    const paymentDate = new Date(payment.completed_at);
    return paymentDate >= startDate && paymentDate <= endDate;
  });
}

/**
 * 売上集計
 */
export function calculateSummary(payments: PaymentRecord[]) {
  const total = payments.reduce((sum, payment) => sum + parseInt(payment.amount), 0);
  const count = payments.length;
  const average = count > 0 ? Math.floor(total / count) : 0;

  return {
    total,
    count,
    average,
  };
}
