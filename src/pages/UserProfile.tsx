// src/pages/UserProfile.tsx
// ユーザープロフィールページ - モバイルファーストのレスポンシブデザイン

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAddress } from '@thirdweb-dev/react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUserKodomi } from '../hooks/useUserKodomi';
import { useMetaTags } from '../hooks/useMetaTags';
import { getRankColor, getRankBadge, shortenAddress, formatRelativeTime, generateTwitterShareText } from '../utils/userProfile';
import type { UserProfile } from '../types/user';
import { ContributionGauge } from '../components/ContributionGauge';

export function UserProfile({ address: propsAddress, mockProfile, mockActivities }: {
  address?: string;
  mockProfile?: UserProfile | null;
  mockActivities?: any[];
} = {}) {
  const { user } = usePrivy();
  const thirdwebAddress = useAddress(); // Thirdwebウォレット（MetaMaskなど）

  // ウォレットアドレスを取得（Privy埋め込みウォレット優先、なければThirdweb）
  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const myAddress = privyEmbeddedWalletAddress || thirdwebAddress || '';

  const path = window.location.pathname;

  // /user/:address または /profile/:address のパターンに対応
  const addressFromUrl = path.split('/user/')[1] || path.split('/profile/')[1] || '';

  // 表示するウォレットアドレス（propsAddress優先、次にURL、最後に自分のアドレス）
  const targetAddress = propsAddress || addressFromUrl || myAddress;

  // 他のユーザーのプロフィールを閲覧しているかチェック
  const isViewingOtherProfile = addressFromUrl && addressFromUrl.length > 0 && myAddress && addressFromUrl.toLowerCase() !== myAddress.toLowerCase();

  // レスポンシブ対応：画面幅を検知
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { profile: realProfile, activities: realActivities, isLoading, isError } = useUserProfile(
    mockProfile ? undefined : targetAddress
  );

  // 対象ユーザーへの自分のkodomi値を取得
  const userKodomi = useUserKodomi(targetAddress);

  const profile = mockProfile || realProfile;
  const activities = mockActivities || realActivities || [];

  // プロフィールページのOGP設定
  useMetaTags({
    title: profile?.username
      ? `${profile.username} (@${shortenAddress(targetAddress)}) - GIFTERRA`
      : `${shortenAddress(targetAddress)} - GIFTERRA Profile`,
    description: profile?.username
      ? `${profile.username}のGIFTERRAプロフィール - ランク: ${profile.rank}, コドミポイント: ${profile.kodomiPoints?.toLocaleString() || 0}`
      : `GIFTERRAユーザープロフィール`,
    imageUrl: 'https://gifterra-safe.vercel.app/someneGIFTERRA.png', // 常にデフォルト画像を使用
    url: `https://gifterra-safe.vercel.app/receive/${targetAddress}`,
    type: 'profile',
  });

  if (!mockProfile && isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 18 }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!mockProfile && (isError || !profile)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 700 }}>プロフィールが見つかりません</h2>
        </div>
      </div>
    );
  }

  const rankColor = getRankColor(profile.rank.name);
  const rankBadge = getRankBadge(profile.rank.name);

  const formatBigIntSafe = (value: bigint | number): string => {
    try {
      if (typeof value === 'bigint') {
        const divisor = BigInt(10 ** 18);
        const integerPart = Number(value / divisor);
        return integerPart.toLocaleString();
      }
      return value.toLocaleString();
    } catch (e) {
      return '0';
    }
  };

  const tipSentPercentage = Math.min(100, (profile.stats.tipSentCount / 50) * 100);
  const tipReceivedPercentage = Math.min(100, (profile.stats.tipReceivedCount / 50) * 100);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#EAF2FF',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 前景オーバーレイ（背景画像との統合用） */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12, 16, 28, 0.44)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* グリッド背景 */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(234, 242, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(234, 242, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        opacity: 0.5,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* グラデーションアクセント */}
      <div style={{
        position: 'fixed',
        top: '-50%',
        right: '-10%',
        width: '60%',
        height: '100%',
        background: 'radial-gradient(circle, rgba(102, 126, 234, 0.15), transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: isMobile ? '100%' : 1600,
        margin: '0 auto',
        padding: isMobile ? '24px 16px' : '80px 40px',
      }}>
        {/* ヘッダー - シームレス */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: isMobile ? 24 : 60,
          marginBottom: isMobile ? 48 : 120,
          paddingBottom: isMobile ? 24 : 60,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* プロフィールアイコン */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: isMobile ? 100 : 180,
              height: isMobile ? 100 : 180,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${rankColor}, ${rankColor}dd)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 48 : 80,
              position: 'relative',
            }}>
              {rankBadge}
            </div>
            {/* ランクバッジ */}
            <div style={{
              position: 'absolute',
              bottom: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: isMobile ? '6px 16px' : '8px 24px',
              background: rankColor,
              borderRadius: 999,
              fontSize: isMobile ? 12 : 14,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}>
              {profile.rank.name}
            </div>
          </div>

          {/* ユーザー情報 */}
          <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left', width: isMobile ? '100%' : 'auto' }}>
            {profile.ensName && (
              <h1 style={{
                margin: 0,
                fontSize: isMobile ? 28 : 56,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                marginBottom: isMobile ? 8 : 16,
              }}>
                {profile.ensName}
              </h1>
            )}
            <div style={{
              fontSize: isMobile ? 14 : 18,
              fontFamily: 'monospace',
              opacity: 0.5,
              marginBottom: isMobile ? 16 : 32,
            }}>
              {shortenAddress(profile.address, isMobile ? 6 : 10)}
            </div>

            {/* 貢献度 */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: isMobile ? 8 : 12,
            }}>
              <span style={{ fontSize: isMobile ? 14 : 18, opacity: 0.6 }}>貢献度</span>
              <span style={{
                fontSize: isMobile ? 36 : 64,
                fontWeight: 900,
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}>
                {profile.rank.points.toLocaleString()}
              </span>
              <span style={{ fontSize: isMobile ? 16 : 24, opacity: 0.6 }}>pt</span>
            </div>
          </div>

          {/* アクション */}
          <div style={{ display: 'flex', gap: isMobile ? 8 : 16, width: isMobile ? '100%' : 'auto' }}>
            <button
              onClick={() => {
                const text = generateTwitterShareText(
                  profile.address,
                  profile.rank.name,
                  profile.rank.points,
                  profile.sbts.length
                );
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              style={{
                padding: isMobile ? '12px 24px' : '16px 32px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: isMobile ? 8 : 12,
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                flex: isMobile ? 1 : 'none',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              シェア
            </button>
          </div>
        </div>

        {/* このユーザーへの自分のkodomi（2軸ゲージ） - 他のユーザーのプロフィールを見ている場合のみ表示 */}
        {isViewingOtherProfile && !userKodomi.loading && !userKodomi.error && (
          <div style={{ marginBottom: isMobile ? 48 : 80 }}>
            <h2 style={{
              fontSize: isMobile ? 20 : 28,
              fontWeight: 700,
              marginBottom: isMobile ? 24 : 32,
              opacity: 0.9,
              textAlign: 'center',
            }}>
              このユーザーへのあなたの kodomi
            </h2>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 16 : 20,
              maxWidth: 600,
              margin: '0 auto',
            }}>
              {/* 💸 JPYC貢献ゲージ */}
              <div>
                <div style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span>💸</span>
                  <span>JPYC貢献</span>
                  <span style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>
                    （{userKodomi.jpyc.totalAmount.toLocaleString()} JPYC · {userKodomi.jpyc.tipCount}回）
                  </span>
                </div>
                <ContributionGaugeCustom
                  kodomi={Math.round(userKodomi.jpyc.totalAmount)}
                  label="JPYC"
                  icon="💸"
                  isMobile={isMobile}
                />
              </div>

              {/* ⚡ NHT応援熱量ゲージ */}
              <div>
                <div style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span>⚡</span>
                  <span>応援熱量</span>
                  <span style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6 }}>
                    （{userKodomi.resonance.supportCount}回 · {userKodomi.resonance.streakDays}日連続）
                  </span>
                </div>
                <ContributionGaugeCustom
                  kodomi={userKodomi.resonance.engagementScore}
                  label="NHT"
                  icon="⚡"
                  isMobile={isMobile}
                />
                <div style={{
                  fontSize: isMobile ? 10 : 11,
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: 6,
                  textAlign: 'center',
                  fontStyle: 'italic',
                }}>
                  ※非金銭的な応援ポイント
                </div>
              </div>
            </div>
          </div>
        )}

        {/* メイン：タンク（主役） */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 40 : 80,
          marginBottom: isMobile ? 48 : 120,
        }}>
          {/* Tip送信タンク */}
          <TankVisual
            label="Tip 送信"
            value={formatBigIntSafe(profile.stats.totalTipsSent)}
            count={profile.stats.tipSentCount}
            percentage={tipSentPercentage}
            color="#667eea"
            isMobile={isMobile}
          />

          {/* Tip受取タンク */}
          <TankVisual
            label="Tip 受取"
            value={formatBigIntSafe(profile.stats.totalTipsReceived)}
            count={profile.stats.tipReceivedCount}
            percentage={tipReceivedPercentage}
            color="#764ba2"
            isMobile={isMobile}
          />
        </div>

        {/* 統計 - シンプル */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
          gap: isMobile ? 24 : 80,
          marginBottom: isMobile ? 48 : 120,
          paddingBottom: isMobile ? 32 : 80,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <StatItem icon="🎁" label="特典受取" value={profile.stats.purchaseCount} isMobile={isMobile} />
          <StatItem icon="🎉" label="Reward" value={profile.stats.rewardClaimedCount} isMobile={isMobile} />
          <StatItem icon="🖼️" label="SBT" value={profile.sbts.length} isMobile={isMobile} />
        </div>

        {/* アクティビティ */}
        {activities.length > 0 && (
          <div>
            <h2 style={{
              fontSize: isMobile ? 20 : 28,
              fontWeight: 700,
              marginBottom: isMobile ? 24 : 40,
              opacity: 0.9,
            }}>
              最近のアクティビティ
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 16 }}>
              {activities.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 12 : 24,
                    padding: isMobile ? '16px 0' : '20px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ fontSize: isMobile ? 20 : 28, opacity: 0.8 }}>
                    {activity.type === 'tip_sent' ? '💸' :
                     activity.type === 'tip_received' ? '💰' :
                     activity.type === 'purchase' ? '🎁' :
                     activity.type === 'reward_claimed' ? '🎉' : '📝'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, marginBottom: 4 }}>
                      {activity.type === 'tip_sent' ? 'Tip送信' :
                       activity.type === 'tip_received' ? 'Tip受取' :
                       activity.type === 'purchase' ? '特典受取' :
                       activity.type === 'reward_claimed' ? 'Reward受取' : activity.type}
                    </div>
                    <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.5 }}>
                      {formatRelativeTime(activity.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// タンクビジュアル（主役）
function TankVisual({ label, value, count, percentage, color, isMobile }: {
  label: string;
  value: string;
  count: number;
  percentage: number;
  color: string;
  isMobile: boolean;
}) {
  return (
    <div style={{
      position: 'relative',
      height: isMobile ? 360 : 520,
    }}>
      {/* CSSアニメーション定義 - 静かで有機的 */}
      <style>{`
        @keyframes liquidWave {
          0%, 100% {
            transform: translateX(-50%) translateY(0px);
            border-radius: 45%;
          }
          50% {
            transform: translateX(-50%) translateY(-1.5px);
            border-radius: 46%;
          }
        }
        @keyframes breatheGlow {
          0%, 100% {
            opacity: 0.00;
          }
          50% {
            opacity: 0.06;
          }
        }
        @keyframes subtleBubbleRise {
          0% {
            bottom: 0;
            opacity: 0;
            transform: translateX(0);
          }
          10% {
            opacity: 0.2;
          }
          90% {
            opacity: 0.2;
          }
          100% {
            bottom: 100%;
            opacity: 0;
            transform: translateX(8px);
          }
        }

        /* モーション軽減設定に従う */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* ラベル */}
      <div style={{
        fontSize: isMobile ? 12 : 14,
        fontWeight: 600,
        opacity: 0.5,
        marginBottom: isMobile ? 16 : 24,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {label}
      </div>

      {/* タンク本体 - 円筒形デザイン */}
      <div style={{
        position: 'relative',
        height: isMobile ? 280 : 400,
        perspective: 1000,
      }}>
        {/* タンクコンテナ（ガラス瓶のような形状） */}
        <div style={{
          position: 'relative',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: '50% 50% 40% 40% / 10% 10% 40% 40%',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4), 0 10px 40px rgba(0,0,0,0.5)',
        }}>
          {/* タンク上部の楕円（蓋） */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: 40,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)',
            zIndex: 2,
          }} />

          {/* 液体コンテナ */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${percentage}%`,
            transition: 'height 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            {/* 液体本体 */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to top, ${color} 0%, ${color}dd 50%, ${color}aa 100%)`,
              overflow: 'hidden',
            }}>
              {/* 波打つ液体表面（2層・穏やか） */}
              <div style={{
                position: 'absolute',
                top: -20,
                left: '50%',
                width: '200%',
                height: 40,
                background: `radial-gradient(ellipse at center, ${color} 0%, ${color}ee 50%, transparent 70%)`,
                animation: 'liquidWave 10s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute',
                top: -15,
                left: '50%',
                width: '200%',
                height: 40,
                background: `radial-gradient(ellipse at center, ${color}aa 0%, ${color}66 50%, transparent 70%)`,
                animation: 'liquidWave 12s ease-in-out infinite reverse',
              }} />

              {/* 微細なバブル1 */}
              <div style={{
                position: 'absolute',
                left: '35%',
                width: 5,
                height: 5,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                animation: 'subtleBubbleRise 14s ease-in-out infinite',
                animationDelay: '0s',
              }} />

              {/* 微細なバブル2 */}
              <div style={{
                position: 'absolute',
                left: '65%',
                width: 4,
                height: 4,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '50%',
                animation: 'subtleBubbleRise 16s ease-in-out infinite',
                animationDelay: '7s',
              }} />

              {/* 呼吸発光オーバーレイ */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(ellipse at center, ${color}ff 0%, transparent 70%)`,
                animation: 'breatheGlow 12s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* 数値（中央） */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}>
            <div style={{
              fontSize: isMobile ? 48 : 72,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              marginBottom: isMobile ? 4 : 8,
              textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.6)',
              background: 'linear-gradient(180deg, #ffffff 0%, #ffffffdd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {value}
            </div>
            <div style={{
              fontSize: isMobile ? 14 : 20,
              opacity: 0.8,
              fontWeight: 600,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>
              JPYC
            </div>
          </div>

          {/* ガラス反射エフェクト（前面） */}
          <div style={{
            position: 'absolute',
            top: '15%',
            left: '8%',
            width: '30%',
            height: '40%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 4,
          }} />
        </div>
      </div>

      {/* メタ情報 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: isMobile ? 12 : 20,
        fontSize: isMobile ? 12 : 14,
      }}>
        <span style={{ opacity: 0.5 }}>{count} 回</span>
        <span style={{
          fontWeight: 700,
          color,
          textShadow: `0 0 10px ${color}66`,
        }}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// 統計アイテム
function StatItem({ icon, label, value, isMobile }: {
  icon: string;
  label: string;
  value: number;
  isMobile: boolean;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: isMobile ? 24 : 32,
        marginBottom: isMobile ? 8 : 12,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: isMobile ? 28 : 48,
        fontWeight: 900,
        marginBottom: isMobile ? 4 : 8,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: isMobile ? 11 : 14,
        opacity: 0.5,
      }}>
        {label}
      </div>
    </div>
  );
}

// カスタマイズ可能なContributionGauge（JPYC/NHT用）
function ContributionGaugeCustom({ kodomi, label, icon, isMobile }: {
  kodomi: number;
  label: string;
  icon: string;
  isMobile: boolean;
}) {
  // レベル計算（ContributionGaugeと同じロジック）
  function calculateLevel(k: number): { level: number; progress: number; nextLevelThreshold: number } {
    const thresholds = [0, 100, 300, 600, 1000];

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (k >= thresholds[i]) {
        const level = i + 1;
        const currentThreshold = thresholds[i];
        const nextThreshold = i < thresholds.length - 1 ? thresholds[i + 1] : thresholds[i] + 500;
        const progressInLevel = k - currentThreshold;
        const levelRange = nextThreshold - currentThreshold;
        const progress = Math.min(100, (progressInLevel / levelRange) * 100);

        return { level, progress, nextLevelThreshold: nextThreshold };
      }
    }

    return { level: 1, progress: 0, nextLevelThreshold: 100 };
  }

  const { level, progress, nextLevelThreshold } = calculateLevel(kodomi);

  // レベルに応じた色を決定
  const getLevelColor = (lvl: number) => {
    switch (lvl) {
      case 1: return '#94a3b8'; // Gray
      case 2: return '#3b82f6'; // Blue
      case 3: return '#8b5cf6'; // Purple
      case 4: return '#f59e0b'; // Orange
      case 5: return '#ef4444'; // Red
      default: return '#94a3b8';
    }
  };

  const levelColor = getLevelColor(level);
  const remaining = nextLevelThreshold - kodomi;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '10px' : '14px',
        padding: isMobile ? '10px 16px' : '12px 20px',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 100%)',
        borderRadius: 12,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* アイコン */}
      <span
        style={{
          fontSize: isMobile ? 22 : 26,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
        }}
      >
        {icon}
      </span>

      {/* ラベル */}
      <div
        style={{
          fontSize: isMobile ? 10 : 11,
          fontWeight: 800,
          color: 'rgba(255, 255, 255, 0.6)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
          minWidth: isMobile ? 40 : 50,
        }}
      >
        {label}
      </div>

      {/* レベル表示とプログレスバー */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700,
            color: levelColor,
            letterSpacing: '0.5px',
            textShadow: `0 0 8px ${levelColor}80, 0 2px 4px rgba(0, 0, 0, 0.5)`,
          }}
        >
          Lv.{level}
        </div>

        {/* プログレスバー */}
        <div
          style={{
            width: '100%',
            height: isMobile ? 10 : 12,
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: 6,
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(0, 0, 0, 0.3)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(180deg, ${levelColor} 0%, ${levelColor}cc 50%, ${levelColor}99 100%)`,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 12px ${levelColor}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
              position: 'relative',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '40%',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%)',
                borderRadius: '4px 4px 0 0',
              }}
            />
          </div>
        </div>
      </div>

      {/* スコア表示 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: isMobile ? 13 : 15,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            letterSpacing: '0.3px',
          }}
        >
          {kodomi}pt
        </div>

        {level < 5 && (
          <div
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.6,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            次まで {remaining}pt
          </div>
        )}

        {level >= 5 && (
          <div
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.7,
              color: '#fbbf24',
              textShadow: '0 0 6px rgba(251, 191, 36, 0.5), 0 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            ✨ MAX
          </div>
        )}
      </div>
    </div>
  );
}
