// src/pages/PrivacyPolicy.tsx
// プライバシーポリシーページ

export function PrivacyPolicyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
      color: '#EAF2FF',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: '40px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          GIFTERRA プライバシーポリシー
        </h1>

        <p style={{
          fontSize: 14,
          opacity: 0.7,
          textAlign: 'center',
          marginBottom: 40,
        }}>
          最終更新日：2025年11月
        </p>

        <div style={{
          fontSize: 14,
          lineHeight: 1.8,
          opacity: 0.9,
        }}>
          <p>
            METATRON.（以下「当運営」）は、GIFTERRA（以下「本サービス」）の利用に際して取得する利用者の個人情報等を、以下の方針に基づき適切に管理します。
            本サービスを利用することにより、ユーザーは本ポリシーに同意したものとみなされます。
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第1条（基本方針）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>当運営は、ユーザーのプライバシーを尊重し、個人情報の保護を最優先に運営します。</li>
            <li>本サービスで収集する情報は、投げ銭（任意の応援行為）および特典配布（感謝の表現）に関する機能提供に必要な範囲に限ります。</li>
            <li>取得した情報は、目的外利用を行わず、法令および本ポリシーに従い適正に取り扱います。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第2条（収集する情報）
          </h2>
          <p>本サービスでは、以下の情報を取得・記録することがあります。</p>
          <ol style={{ paddingLeft: 24 }}>
            <li>Googleアカウント情報（メールアドレス、表示名、プロフィール画像等）</li>
            <li>ウォレットアドレスおよびトランザクション情報（ブロックチェーン上の公開情報）</li>
            <li>投げ銭データ（投げ銭の日時、金額、メッセージ内容、対象テナント）</li>
            <li>特典配布データ（配布履歴、特典種別、NFTメタデータ）</li>
            <li>AI感情解析データ（メッセージ内容に基づく感情スコア「kodomi値」など）</li>
            <li>アクセスログ、端末情報、クッキー、IPアドレス等の通信情報</li>
            <li>エラー情報、利用履歴、その他サービス運営上必要な技術情報</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第3条（利用目的）
          </h2>
          <p>当運営は、収集した情報を以下の目的で利用します。</p>
          <ol style={{ paddingLeft: 24 }}>
            <li>投げ銭機能および特典配布機能の提供・履歴管理</li>
            <li>ユーザー体験の最適化、及び感情解析に基づく貢献スコアリングの実施</li>
            <li>不正利用・スパム・権利侵害等の防止および対応</li>
            <li>サービス改善、新機能開発、運用状況の分析</li>
            <li>法令遵守および問い合わせ対応のための本人確認</li>
            <li>統計的データの作成および匿名加工情報の研究利用</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第4条（情報の第三者提供）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>当運営は、以下の場合を除き、ユーザー情報を第三者に提供しません。
              <ol style={{ paddingLeft: 24, marginTop: 8 }}>
                <li>ユーザー本人の同意がある場合</li>
                <li>法令に基づく場合</li>
                <li>人の生命・財産保護のために必要であり、本人同意が困難な場合</li>
                <li>業務委託先（例：Supabase、ブロックチェーンノード提供事業者、AI解析API提供元等）へ運営上必要な範囲で提供する場合</li>
              </ol>
            </li>
            <li>提供先には適切な守秘義務契約を課し、個人情報保護を徹底します。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第5条（情報の管理）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>当運営は、取得した情報の漏洩・改ざん・不正アクセスを防止するため、暗号化通信・アクセス制御などの安全管理措置を講じます。</li>
            <li>Supabase等の外部ストレージに保存されるデータについても、アクセス権限を制限し、監査ログを保持します。</li>
            <li>ブロックチェーン上の情報は特性上、削除・改変が不可能であることをユーザーは理解し、同意するものとします。</li>
            <li>本サービスにおけるJPYC送受信（x402ベース／互換・独自実装）機能の利用に伴い、トランザクションハッシュ、ブロックチェーン上の公開データ等が記録されます。これらのデータは、ブロックチェーンの特性上、不可逆的に記録され、削除・改変が技術的に不可能であることをユーザーは理解し、同意するものとします。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第6条（ユーザーによる情報の確認・削除）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>ユーザーは、自身の登録情報の閲覧・修正・削除を求めることができます。</li>
            <li>ただし、ブロックチェーン上で記録済みの取引履歴やトランザクション情報については、技術的に削除・改変ができません。</li>
            <li>削除の申請は、当運営のサポート窓口または公式フォームを通じて行うことができます。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第7条（Cookie等の使用）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>本サービスでは、アクセス解析やセキュリティ向上のため、Cookieや類似技術を利用します。</li>
            <li>Cookie情報は個人を特定する目的では利用せず、ユーザーはブラウザ設定により拒否することができます。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第8条（AI解析に関する補足）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>本サービスにおけるAI解析は、投げ銭メッセージや利用履歴等を元に感情スコア（kodomi値等）を算出するものであり、人格評価や信用スコアリングを目的とするものではありません。</li>
            <li>AI解析結果は特典配布や応援の可視化にのみ使用され、第三者による商用利用や外部公開は行いません。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第9条（免責事項）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>当運営は、ユーザー自身のウォレット・秘密鍵・端末管理の不備によって生じた損害について一切の責任を負いません。</li>
            <li>ブロックチェーン技術の特性上、トランザクションの取り消しや履歴削除はできません。</li>
            <li>外部リンク・外部サービス利用中に発生した情報漏洩等について、当運営は責任を負いません。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第10条（改定）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>当運営は、本ポリシーを必要に応じて改定することがあります。</li>
            <li>改定後は、ウェブ上での掲載をもって効力を生じるものとします。</li>
            <li>重要な変更がある場合は、ログイン時または公式告知にて通知します。</li>
          </ol>

          <div style={{
            marginTop: 60,
            paddingTop: 24,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            fontSize: 12,
            opacity: 0.6,
          }}>
            <p>© 2025 METATRON. / GIFTERRA. All rights reserved.</p>
            <p>Patent Pending (特願2025-120883)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
