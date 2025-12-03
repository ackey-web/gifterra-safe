// src/pages/TenantIntroduction.tsx
// テナント機能の紹介ページ - テナントを所有するメリットを説明

import flowImage from '../assets/flow.png';

interface TenantIntroductionProps {
  isMobile?: boolean;
}

export function TenantIntroduction({ isMobile = false }: TenantIntroductionProps) {
  const navigate = (path: string) => {
    window.location.href = path;
  };

  const features = [
    {
      icon: '🎁',
      title: 'GIFT HUB管理',
      description: '自販機型UIのGIFT HUBで、NFTを含むデジタル特典を自動配布できます',
      details: [
        'MP3・画像・動画・3Dデータなど幅広い特典に対応',
        'プランに応じて複数のHUBを作成',
        '各HUBで最大3つの特典を自動配布し、NFT/SBTもまとめて管理',
      ],
    },
    {
      icon: '🏅',
      title: 'SBTランクシステム',
      description: '貢献熱量（KODOMI）に応じて、ファンのサポーターランクSBTを自動発行します',
      details: [
        'プランに応じて最大10段階のランク設計が可能',
        'Burn & Mint方式でランクを自動更新',
        'ランク到達でクーポンや特別コンテンツ用のフラグNFTも自動配布',
      ],
    },
    {
      icon: '🚩',
      title: 'フラグNFT発行',
      description: '特定の条件達成時に、特典アクセス用のフラグNFTを自動発行できます',
      details: [
        '到達証明や限定コンテンツのアクセス権として利用可能',
        'メタデータを自由にカスタマイズ',
        'イベント参加証やクーポン解放など、コミュニティ運営に活用',
      ],
    },
    {
      icon: '📊',
      title: '詳細な分析機能',
      description: '上位プランで高度な分析機能が利用可能',
      details: [
        'ユーザーエンゲージメント分析',
        'チップ配布統計',
        'ランク分布の可視化',
      ],
    },
    {
      icon: '🔌',
      title: 'API連携（拡張予定）',
      description: '外部サービスとの連携も予定',
      details: [
        'REST API経由でのデータ取得',
        'Webhook通知',
        '外部システムとの統合',
      ],
    },
    {
      icon: '🎯',
      title: '優先サポート',
      description: '上位プランでは優先的なサポートを受けられます',
      details: [
        '専用サポートチャンネル',
        '優先的な問い合わせ対応',
        '新機能の先行利用',
      ],
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      padding: isMobile ? '24px 16px' : '40px 24px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {/* ヘッダー */}
        <div style={{
          textAlign: 'center',
          marginBottom: 48,
        }}>
          <img
            src={flowImage}
            alt="GIFTERRA"
            style={{
              height: isMobile ? 60 : 80,
              marginBottom: 24,
            }}
          />
          <h1 style={{
            fontSize: isMobile ? 28 : 42,
            fontWeight: 700,
            marginBottom: 16,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            GIFTERRA STUDIO
          </h1>
          <p style={{
            fontSize: isMobile ? 16 : 20,
            opacity: 0.9,
            marginBottom: 8,
            lineHeight: 1.6,
          }}>
            デジタル特典配布プラットフォーム
          </p>
          <p style={{
            fontSize: isMobile ? 14 : 16,
            opacity: 0.7,
            lineHeight: 1.6,
          }}>
            テナントを取得して、あなた専用のGIFT HUBを運用しましょう
          </p>
        </div>

        {/* 主要機能 */}
        <div style={{
          marginBottom: 48,
        }}>
          <h2 style={{
            fontSize: isMobile ? 22 : 28,
            fontWeight: 700,
            marginBottom: 32,
            textAlign: 'center',
          }}>
            テナントで実現できること
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: isMobile ? 20 : 28,
            maxWidth: 1400,
            margin: '0 auto',
          }}>
            {features.map((feature, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: isMobile ? 24 : 32,
                  transition: 'all 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: isMobile ? 'auto' : 320,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>{feature.icon}</div>
                <h3 style={{
                  fontSize: isMobile ? 19 : 21,
                  fontWeight: 700,
                  marginBottom: 14,
                  lineHeight: 1.3,
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: isMobile ? 14 : 15,
                  opacity: 0.85,
                  marginBottom: 18,
                  lineHeight: 1.7,
                  flex: '0 0 auto',
                }}>
                  {feature.description}
                </p>
                <ul style={{
                  fontSize: isMobile ? 13 : 14,
                  opacity: 0.75,
                  paddingLeft: 20,
                  margin: 0,
                  lineHeight: 1.9,
                  flex: '1 1 auto',
                }}>
                  {feature.details.map((detail, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>{detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* 料金プラン概要 */}
        <div style={{
          background: 'rgba(102, 126, 234, 0.1)',
          border: '1px solid rgba(102, 126, 234, 0.3)',
          borderRadius: 24,
          padding: isMobile ? 24 : 40,
          marginBottom: 48,
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: isMobile ? 22 : 28,
            fontWeight: 700,
            marginBottom: 16,
          }}>
            柔軟な料金プラン
          </h2>
          <p style={{
            fontSize: isMobile ? 14 : 16,
            opacity: 0.8,
            marginBottom: 24,
            lineHeight: 1.6,
          }}>
            規模に応じて最適なプランを選択可能
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}>
            <div style={{
              background: 'rgba(102, 126, 234, 0.1)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: 12,
              padding: 16,
              opacity: 0.7,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🌊</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>FLOW</div>
              <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.7 }}>無料</div>
              <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.5, marginTop: 4 }}>（テナントなし）</div>
            </div>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎨</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>STUDIO</div>
              <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.7 }}>¥1,500/月〜</div>
            </div>
            <div style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>STUDIO PRO</div>
              <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.7 }}>¥3,800/月〜</div>
            </div>
            <div style={{
              background: 'rgba(251, 146, 60, 0.1)',
              border: '1px solid rgba(251, 146, 60, 0.3)',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🚀</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>STUDIO PRO MAX</div>
              <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.7 }}>¥9,800/月〜</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <button
            onClick={() => navigate('/tenant/plan-selection')}
            style={{
              padding: isMobile ? '16px 40px' : '20px 60px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 16,
              color: '#fff',
              fontSize: isMobile ? 16 : 20,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
            }}
          >
            🚀 プランを選択してテナント申請
          </button>
          <p style={{
            fontSize: isMobile ? 12 : 14,
            opacity: 0.6,
            marginTop: 16,
          }}>
            ※ 申請後、管理者による承認が必要です（通常1-2営業日）
          </p>
        </div>

        {/* 戻るボタン */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/mypage')}
            style={{
              padding: isMobile ? '12px 24px' : '14px 32px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 12,
              color: '#fff',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            マイページに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
