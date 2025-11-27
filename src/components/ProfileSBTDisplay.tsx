// src/components/ProfileSBTDisplay.tsx
// ユーザーのプロフィールSBT獲得状況を表示

import { useMyProfileSBTs } from '../hooks/useProfileSBTMints';

interface ProfileSBTDisplayProps {
  tenantId: string;
  rankLabels?: Record<number, { icon: string; label: string }>;
  isMobile?: boolean;
}

export function ProfileSBTDisplay({ tenantId, rankLabels = {}, isMobile = false }: ProfileSBTDisplayProps) {
  const { sbts, loading } = useMyProfileSBTs(tenantId);

  if (loading) {
    return (
      <div style={{
        padding: isMobile ? '16px' : '20px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(59, 130, 246, 0.3)',
      }}>
        <div style={{ fontSize: 14, opacity: 0.7, textAlign: 'center' }}>
          SBT情報を読み込み中...
        </div>
      </div>
    );
  }

  if (sbts.length === 0) {
    return (
      <div style={{
        padding: isMobile ? '16px' : '20px',
        background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.1) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(107, 114, 128, 0.3)',
      }}>
        <div style={{
          fontSize: isMobile ? 13 : 14,
          opacity: 0.7,
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          まだプロフィールSBTを獲得していません<br />
          <span style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>
            kodomi値を貯めてSBTを獲得しましょう！
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: isMobile ? '16px' : '20px',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
      borderRadius: 12,
      border: '1px solid rgba(59, 130, 246, 0.3)',
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: isMobile ? 16 : 18,
        fontWeight: 700,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>🎭</span>
        <span>獲得済みプロフィールSBT</span>
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {sbts.map((sbt) => {
          const rankInfo = rankLabels[sbt.rank_level] || {
            icon: '⭐',
            label: `Rank ${sbt.rank_level}`,
          };

          return (
            <div
              key={sbt.id}
              style={{
                padding: 12,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 24 }}>{rankInfo.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                  }}>
                    {rankInfo.label}
                  </div>
                  <div style={{
                    fontSize: 11,
                    opacity: 0.6,
                    marginTop: 2,
                  }}>
                    Rank {sbt.rank_level}
                  </div>
                </div>
              </div>

              <div style={{
                padding: '6px 10px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 6,
                fontSize: 11,
              }}>
                <div style={{ opacity: 0.7 }}>獲得時kodomi</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginTop: 2 }}>
                  {sbt.kodomi_at_mint} pt
                </div>
              </div>

              <div style={{
                fontSize: 10,
                opacity: 0.5,
                textAlign: 'center',
              }}>
                {new Date(sbt.minted_at).toLocaleDateString('ja-JP')} 獲得
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 16,
        padding: 12,
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 8,
        fontSize: isMobile ? 11 : 12,
        lineHeight: 1.6,
        opacity: 0.8,
      }}>
        <strong>💡 プロフィールSBTとは？</strong><br />
        このクリエイターへの貢献度（kodomi値）に応じて自動的に獲得できる証明NFTです。<br />
        一度獲得したSBTは永久に保持され、あなたの貢献の証となります。
      </div>
    </div>
  );
}
