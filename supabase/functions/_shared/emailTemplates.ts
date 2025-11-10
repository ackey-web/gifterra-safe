// supabase/functions/_shared/emailTemplates.ts
// メール通知のHTMLテンプレート

export interface JPYCReceivedEmailData {
  amount: string;
  tokenSymbol: string;
  fromAddress: string;
  txHash: string;
  recipientAddress: string;
}

export function generateJPYCReceivedEmail(data: JPYCReceivedEmailData): string {
  const { amount, tokenSymbol, fromAddress, txHash, recipientAddress } = data;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JPYC を受け取りました</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                💴 JPYC を受け取りました
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                あなたのウォレットに <strong style="color: #667eea; font-size: 20px;">${amount} ${tokenSymbol}</strong> が送金されました。
              </p>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="font-size: 14px; color: #666666; width: 100px;">受取アドレス:</td>
                        <td style="font-size: 14px; color: #333333; font-family: monospace; word-break: break-all;">
                          ${recipientAddress}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666666;">送信元:</td>
                        <td style="font-size: 14px; color: #333333; font-family: monospace; word-break: break-all;">
                          ${fromAddress}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666666;">金額:</td>
                        <td style="font-size: 18px; color: #667eea; font-weight: 600;">
                          ${amount} ${tokenSymbol}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://polygonscan.com/tx/${txHash}"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      トランザクションを確認
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                GIFTERRA マイページから残高を確認できます。
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                このメールは GIFTERRA の通知システムから自動送信されています。
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                通知設定はマイページから変更できます。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateEmailSubject(notificationType: string, data: any): string {
  switch (notificationType) {
    case 'jpyc_received':
      return `【GIFTERRA】${data.amount} JPYC を受け取りました`;
    case 'rank_up':
      return `【GIFTERRA】ランクアップしました！`;
    case 'gift_received':
      return `【GIFTERRA】ギフトが届きました`;
    default:
      return '【GIFTERRA】新しい通知があります';
  }
}
