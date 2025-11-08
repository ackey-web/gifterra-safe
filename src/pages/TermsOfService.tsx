// src/pages/TermsOfService.tsx
// 利用規約ページ

export function TermsOfServicePage() {
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
          GIFTERRA 利用規約
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
            本利用規約（以下「本規約」）は、METATRON.（以下「当運営」）が提供する
            「GIFTERRA」（以下「本サービス」）の利用条件を定めるものです。
            本サービスを利用する全ての利用者（以下「ユーザー」）は、本規約に同意したものとみなされます。
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第1条（定義）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>「本サービス」とは、GIFTERRA STUDIO、GIFTERRA FLOW、GIFT HUBその他関連機能を含む、デジタルギフト配信・トークン送受信・AI解析・NFT自動配布などの一連の機能を指します。</li>
            <li>「METATRON.」は、本サービスの運営主体を指します。</li>
            <li>「GIFTERRA」は、特許出願済み（特願2025-120883）の技術を有するシステムであり、METATRON.に技術ライセンスを提供する事業体を指します。</li>
            <li>「投げ銭」とは、ユーザーが任意の意思に基づいて他者を応援・支援するために行う送金行為をいい、経済的対価を目的とした支払いではありません。</li>
            <li>「特典配布」とは、投げ銭行為に対する感謝または応援の可視化として行われるデジタル特典・NFT等の提供をいい、有償提供や報酬には該当しません。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第2条（適用）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>本規約は、ユーザーと当運営との間の一切の関係に適用されます。</li>
            <li>当運営は、必要に応じて本規約を改訂できるものとし、改訂後はウェブ上に掲示した時点で効力を生じます。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第3条（利用登録）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>本サービスの利用には、Google認証またはウォレット接続による登録が必要です。</li>
            <li>ユーザーは、自己の責任において正確な情報を登録し、虚偽の登録を行ってはなりません。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第4条（知的財産権）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>本サービスのシステム、デザイン、名称、プログラム、AI解析手法、及びNFT配布アルゴリズム等は、GIFTERRAが保有する知的財産に基づきます。</li>
            <li>GIFTERRAの技術は特許出願中（Patent Pending）であり、許可なく模倣、再配布、改変することを禁じます。</li>
            <li>ユーザーが本サービス上で生成・配布するデジタル特典の著作権は、当該ユーザーまたはクリエイター本人に帰属します。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第5条（禁止事項）
          </h2>
          <p>ユーザーは、以下の行為を行ってはなりません。</p>
          <ol style={{ paddingLeft: 24 }}>
            <li>法令または公序良俗に違反する行為</li>
            <li>不正アクセス、ハッキング、または他者のウォレット情報の不正利用</li>
            <li>AI解析結果（kodomi値等）の改ざんや虚偽送信</li>
            <li>Bot等による不正な投げ銭・自動操作行為</li>
            <li>当運営または他者の知的財産権を侵害する行為</li>
            <li>JPYCその他のトークンを投資や資産運用目的で誤解させる行為</li>
            <li>サービス運営を妨害する行為（スパム行為、攻撃等）</li>
            <li>反社会的勢力との関与、またはその活動を助長する行為</li>
            <li>他者の著作物を無断で利用・転載・頒布・特典として配布する行為</li>
            <li>当運営が不適切と判断するその他の行為</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第6条（作品の取扱いおよび特典配布）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>各テナントオーナーおよびユーザーは、自らが著作権その他の知的財産権を有する、または正当な許諾を得たデジタル作品のみをGIFT HUB等に登録・展示・特典として配布できるものとします。</li>
            <li>本サービスにおける特典配布は、ユーザーからの投げ銭（任意の応援行為）に対する感謝や応援の可視化として行われるものであり、経済的対価を伴う有償提供ではありません。</li>
            <li>特典の配布条件および内容は、テナントオーナーが設定したスマートコントラクトまたは本サービスの仕様に基づいて自動的に実行されます。</li>
            <li>二次的な配布（secondary distribution）を行う場合は、原作者または権利者が明示的に許可している作品に限ります。</li>
            <li>当運営は、権利侵害の疑いがある作品を発見または通報を受けた場合、事前通知なく当該作品の削除・配布停止を行うことができます。</li>
            <li>ユーザーは、第三者との権利紛争が生じた場合、自己の責任と費用においてこれを解決し、当運営に一切の損害を与えないものとします。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第7条（免責事項）
          </h2>
          <ol style={{ paddingLeft: 24 }}>
            <li>当運営は、本サービスの利用により生じた損害について、一切の責任を負いません。</li>
            <li>ブロックチェーン上のデータは不可逆的であり、送金・配布後の取り消しはできません。</li>
            <li>当運営は、NFTや特典の内容・継続性について保証を行いません。</li>
            <li>ユーザー自身のウォレット・秘密鍵管理の不備に起因する損害について、当運営は責任を負いません。</li>
          </ol>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第8条（サービスの中断・変更・終了）
          </h2>
          <p>
            当運営は、システム保守、障害、法令改正その他やむを得ない事情により、
            事前通知なく本サービスの一部または全部を中断・変更・終了できるものとします。
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 16 }}>
            第9条（準拠法・管轄裁判所）
          </h2>
          <p>
            本規約は日本法に準拠します。
            本サービスに関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>

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
