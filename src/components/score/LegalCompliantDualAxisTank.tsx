/**
 * @file 法務対応版：2軸スコア表示コンポーネント（立体液体タンクデザイン）
 * @description 💸 JPYC（金銭的貢献） / ⚡ 応援熱量（NHT非金銭） 2軸スコアを視覚的に表示
 * @legal NHTは金銭的価値を持たないユーティリティトークンとして明確に分離表示
 */

import React from 'react';

export interface LegalCompliantDualAxisTankProps {
  // 💸 JPYC軸（金銭的貢献）
  jpycAmount: number;           // JPYC総額（JPYC単位で表示）
  jpycTipCount: number;          // JPYCチップ回数
  jpycLevel: number;             // レベル（0-100%）
  jpycDisplayLevel: number;      // 表示用レベル数値
  jpycRank: string;              // ランク名
  jpycColor: string;             // ランクカラー

  // ⚡ 応援熱量軸（NHT非金銭）
  supportCount: number;          // 応援回数（NHTチップ回数）※金額ではない
  streakDays: number;            // 連続応援日数
  engagementScore: number;       // 総合エンゲージメントスコア
  resonanceLevel: number;        // レベル（0-100%）
  resonanceDisplayLevel: number; // 表示用レベル数値
  resonanceRank: string;         // ランク名
  resonanceColor: string;        // ランクカラー

  // オプション
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * スコアをフォーマット（k, M単位）
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

export const LegalCompliantDualAxisTank: React.FC<LegalCompliantDualAxisTankProps> = ({
  jpycAmount,
  jpycTipCount,
  jpycLevel,
  jpycDisplayLevel,
  jpycRank,
  jpycColor,
  supportCount,
  streakDays,
  engagementScore,
  resonanceLevel,
  resonanceDisplayLevel,
  resonanceRank,
  resonanceColor,
  showDetails = true,
  size = 'medium',
  className = '',
}) => {
  // サイズ設定
  const sizeConfig = React.useMemo(() => {
    switch (size) {
      case 'small':
        return { tankHeight: 240, tankWidth: 120, fontSize: 12, gap: 20 };
      case 'large':
        return { tankHeight: 380, tankWidth: 180, fontSize: 18, gap: 36 };
      default:
        return { tankHeight: 300, tankWidth: 150, fontSize: 14, gap: 28 };
    }
  }, [size]);

  return (
    <div
      className={`legal-dual-axis-tank-wrapper ${className}`}
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 24,
        padding: '32px 40px 40px 40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景装飾 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(74, 158, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255, 126, 51, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* タイトル */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 24,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: sizeConfig.fontSize + 8,
            fontWeight: 900,
            color: 'transparent',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span style={{
            background: 'linear-gradient(135deg, #4a9eff 0%, #ff7e33 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'inline-block',
            position: 'relative',
            zIndex: 3,
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 20px rgba(74, 158, 255, 0.6))',
          }}>
            kodomi TANK
          </span>
        </h2>
      </div>

      <div
        className="legal-dual-axis-tank-container"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: sizeConfig.gap,
          position: 'relative',
        }}
      >
      {/* 💸 JPYC軸タンク */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {/* タンク本体 */}
        <div
          style={{
            position: 'relative',
            width: sizeConfig.tankWidth,
            height: sizeConfig.tankHeight,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
            borderRadius: 12,
            border: '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: 'inset 0 4px 16px rgba(0, 0, 0, 0.4), 0 6px 24px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* レベル表示 */}
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'rgba(0, 0, 0, 0.65)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 10,
              fontSize: sizeConfig.fontSize - 2,
              fontWeight: 'bold',
              zIndex: 10,
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            Lv.{jpycDisplayLevel}
          </div>

          {/* 絵文字アイコン */}
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              fontSize: sizeConfig.fontSize + 6,
              zIndex: 10,
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))',
            }}
          >
            💸
          </div>

          {/* 液体（青系JPYC） */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: `${jpycLevel}%`,
              background: 'linear-gradient(180deg, #4a9eff 0%, #2d7dd2 50%, #1e5fa8 100%)',
              transition: 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: '0 0 10px 10px',
              boxShadow: 'inset 0 -8px 24px rgba(255, 255, 255, 0.3), 0 -3px 15px rgba(45, 125, 210, 0.6)',
            }}
          >
            {/* 波エフェクト（2層） */}
            <div
              style={{
                position: 'absolute',
                top: -6,
                left: 0,
                width: '100%',
                height: 12,
                background: 'radial-gradient(ellipse at center, rgba(74, 158, 255, 0.9) 0%, transparent 70%)',
                animation: 'wave 3s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -4,
                left: '20%',
                width: '60%',
                height: 8,
                background: 'radial-gradient(ellipse at center, rgba(157, 204, 255, 0.7) 0%, transparent 60%)',
                animation: 'wave 3s ease-in-out infinite 0.5s',
              }}
            />
            {/* 光沢エフェクト（左側） */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '8%',
                width: '25%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                borderRadius: 6,
                animation: 'shine 4s ease-in-out infinite',
              }}
            />
            {/* 気泡エフェクト */}
            <div
              style={{
                position: 'absolute',
                bottom: '10%',
                left: '30%',
                width: 3,
                height: 3,
                background: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '50%',
                animation: 'bubble1 4s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '5%',
                left: '70%',
                width: 2,
                height: 2,
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '50%',
                animation: 'bubble2 5s ease-in-out infinite 1s',
              }}
            />
          </div>

          {/* グラデーションオーバーレイ */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)',
              borderRadius: 10,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* JPYC詳細情報 */}
        {showDetails && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)', width: sizeConfig.tankWidth + 30 }}>
            <div style={{ fontSize: sizeConfig.fontSize + 1, fontWeight: 'bold', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <img src="/JPYC-logo.png" alt="JPYC" style={{ width: sizeConfig.fontSize + 8, height: sizeConfig.fontSize + 8, filter: 'drop-shadow(0 2px 6px rgba(74, 158, 255, 0.6))' }} />
              <span>JPYC貢献</span>
            </div>
            <div style={{ fontSize: sizeConfig.fontSize + 4, fontWeight: 800, color: '#4a9eff', textShadow: '0 0 10px rgba(74, 158, 255, 0.5)' }}>
              {formatNumber(jpycAmount)} JPYC
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '3px 10px',
                background: 'rgba(74, 158, 255, 0.15)',
                borderRadius: 10,
                fontSize: sizeConfig.fontSize - 1,
                fontWeight: 'bold',
                border: '1px solid rgba(74, 158, 255, 0.3)',
              }}
            >
              🏆 {jpycRank}
            </div>
          </div>
        )}
      </div>

      {/* ⚡ 応援熱量軸タンク */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {/* タンク本体 */}
        <div
          style={{
            position: 'relative',
            width: sizeConfig.tankWidth,
            height: sizeConfig.tankHeight,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
            borderRadius: 12,
            border: '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: 'inset 0 4px 16px rgba(0, 0, 0, 0.4), 0 6px 24px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* レベル表示 */}
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'rgba(0, 0, 0, 0.65)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: 10,
              fontSize: sizeConfig.fontSize - 2,
              fontWeight: 'bold',
              zIndex: 10,
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            Lv.{resonanceDisplayLevel}
          </div>

          {/* 絵文字アイコン */}
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              fontSize: sizeConfig.fontSize + 6,
              zIndex: 10,
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))',
            }}
          >
            ⚡
          </div>

          {/* 液体（オレンジ系応援熱量） */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: `${resonanceLevel}%`,
              background: 'linear-gradient(180deg, #ff9f55 0%, #ff7e33 50%, #ff5722 100%)',
              transition: 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: '0 0 10px 10px',
              boxShadow: 'inset 0 -8px 24px rgba(255, 255, 255, 0.3), 0 -3px 15px rgba(255, 126, 51, 0.6)',
            }}
          >
            {/* 波エフェクト（2層） */}
            <div
              style={{
                position: 'absolute',
                top: -6,
                left: 0,
                width: '100%',
                height: 12,
                background: 'radial-gradient(ellipse at center, rgba(255, 159, 85, 0.9) 0%, transparent 70%)',
                animation: 'wave 2.8s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -4,
                left: '20%',
                width: '60%',
                height: 8,
                background: 'radial-gradient(ellipse at center, rgba(255, 183, 107, 0.7) 0%, transparent 60%)',
                animation: 'wave 2.8s ease-in-out infinite 0.4s',
              }}
            />
            {/* 光沢エフェクト（右側） */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: '8%',
                width: '25%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                borderRadius: 6,
                animation: 'shine 3.5s ease-in-out infinite',
              }}
            />
            {/* 気泡エフェクト */}
            <div
              style={{
                position: 'absolute',
                bottom: '15%',
                left: '25%',
                width: 3,
                height: 3,
                background: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '50%',
                animation: 'bubble1 4.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '8%',
                left: '65%',
                width: 2,
                height: 2,
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '50%',
                animation: 'bubble2 5.5s ease-in-out infinite 0.8s',
              }}
            />
          </div>

          {/* グラデーションオーバーレイ */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)',
              borderRadius: 10,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* 応援熱量詳細情報 */}
        {showDetails && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)', width: sizeConfig.tankWidth + 30 }}>
            <div style={{ fontSize: sizeConfig.fontSize + 1, fontWeight: 'bold', marginBottom: 3 }}>
              ⚡ 応援熱量
            </div>
            <div style={{ fontSize: sizeConfig.fontSize + 4, fontWeight: 800, color: resonanceColor, textShadow: `0 0 8px ${resonanceColor}66` }}>
              {formatNumber(engagementScore)}pt
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '3px 10px',
                background: streakDays >= 7 ? 'linear-gradient(90deg, #ff6b6b, #ff8e53)' : 'rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                fontSize: sizeConfig.fontSize - 1,
                fontWeight: 'bold',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                animation: streakDays >= 7 ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
            >
              🔥 {resonanceRank}
            </div>
            <div
              style={{
                fontSize: sizeConfig.fontSize - 2,
                opacity: 0.45,
                marginTop: 4,
                fontStyle: 'italic',
              }}
            >
              ※非金銭的な応援ポイント
            </div>
          </div>
        )}
      </div>
      </div>

      {/* 注釈 */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: sizeConfig.fontSize - 3,
          color: 'rgba(255, 255, 255, 0.4)',
          fontStyle: 'italic',
          position: 'relative',
          zIndex: 10,
        }}
      >
        ※評価判定テスト中のため、kodomi値・レベルが変更される場合があります
      </div>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes shine {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }

        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scale(1) translateX(-50%); }
          25% { opacity: 0.8; transform: scale(1.05) translateX(-50%); }
          50% { opacity: 0.9; transform: scale(1.1) translateX(-50%); }
          75% { opacity: 0.85; transform: scale(1.05) translateX(-50%); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        @keyframes bubble1 {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-40px) scale(1.1); opacity: 0.4; }
          100% { transform: translateY(-80px) scale(0.8); opacity: 0; }
        }

        @keyframes bubble2 {
          0% { transform: translateY(0) scale(1); opacity: 0.5; }
          50% { transform: translateY(-50px) scale(1.2); opacity: 0.3; }
          100% { transform: translateY(-100px) scale(0.7); opacity: 0; }
        }

        @media (max-width: 640px) {
          .legal-dual-axis-tank-container {
            gap: 10px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LegalCompliantDualAxisTank;
