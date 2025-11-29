// src/components/score/LevelUpPopup.tsx
// レベルアップ時のポップアップアニメーション

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface LevelUpPopupProps {
  axis: 'jpyc' | 'resonance' | 'overall';
  oldLevel: number;
  newLevel: number;
  rank: string;
  color: string;
  onComplete?: () => void;
}

export function LevelUpPopup({
  axis,
  oldLevel,
  newLevel,
  rank,
  color,
  onComplete,
}: LevelUpPopupProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 3秒後にフェードアウト開始
    const timer = setTimeout(() => {
      setIsVisible(false);
      // フェードアウトアニメーション完了後にコールバック
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const getAxisInfo = () => {
    switch (axis) {
      case 'jpyc':
        return { icon: '💸', label: 'JPYC' };
      case 'resonance':
        return { icon: '⚡', label: '応援熱量' };
      case 'overall':
        return { icon: '🏆', label: '総合KODOMI' };
    }
  };

  const axisInfo = getAxisInfo();

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%)',
          borderRadius: 24,
          padding: '40px 60px',
          border: `3px solid ${color}`,
          boxShadow: `0 0 60px ${color}88, 0 20px 80px rgba(0, 0, 0, 0.8)`,
          textAlign: 'center',
          animation: 'levelUpBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景エフェクト */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            left: -50,
            right: -50,
            bottom: -50,
            background: `radial-gradient(circle at center, ${color}22 0%, transparent 70%)`,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />

        {/* 紙吹雪エフェクト */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 8,
              height: 8,
              background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'][i % 5],
              borderRadius: '50%',
              animation: `confetti${i % 4} 1.5s ease-out forwards`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}

        {/* コンテンツ */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div
            style={{
              fontSize: 72,
              marginBottom: 16,
              animation: 'iconSpin 0.8s ease-out',
            }}
          >
            {axisInfo.icon}
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#ffffff',
              marginBottom: 12,
              textShadow: `0 0 20px ${color}cc, 0 4px 12px rgba(0, 0, 0, 0.8)`,
              letterSpacing: '0.05em',
            }}
          >
            LEVEL UP!
          </div>

          <div
            style={{
              fontSize: 18,
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: 20,
              fontWeight: 600,
            }}
          >
            {axisInfo.label}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              Lv.{oldLevel}
            </div>

            <div
              style={{
                fontSize: 32,
                color: color,
                animation: 'arrowSlide 1s ease-in-out infinite',
              }}
            >
              →
            </div>

            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: color,
                textShadow: `0 0 16px ${color}cc, 0 4px 8px rgba(0, 0, 0, 0.6)`,
                animation: 'levelNumberGlow 1.5s ease-in-out infinite',
              }}
            >
              Lv.{newLevel}
            </div>
          </div>

          <div
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: `linear-gradient(135deg, ${color}dd, ${color}aa)`,
              borderRadius: 20,
              fontSize: 20,
              fontWeight: 800,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
              border: `2px solid ${color}`,
              boxShadow: `0 0 20px ${color}66`,
            }}
          >
            {rank}
          </div>
        </div>

        <style>{`
          @keyframes levelUpBounce {
            0% {
              transform: scale(0.3) rotate(-10deg);
              opacity: 0;
            }
            50% {
              transform: scale(1.1) rotate(5deg);
            }
            70% {
              transform: scale(0.95) rotate(-2deg);
            }
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }

          @keyframes iconSpin {
            0% {
              transform: rotate(0deg) scale(0.5);
              opacity: 0;
            }
            50% {
              transform: rotate(180deg) scale(1.2);
            }
            100% {
              transform: rotate(360deg) scale(1);
              opacity: 1;
            }
          }

          @keyframes levelNumberGlow {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.05);
              filter: brightness(1.3);
            }
          }

          @keyframes arrowSlide {
            0%, 100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(8px);
            }
          }

          @keyframes confetti0 {
            to {
              transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) rotate(${Math.random() * 720}deg);
              opacity: 0;
            }
          }

          @keyframes confetti1 {
            to {
              transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) rotate(${Math.random() * 720}deg);
              opacity: 0;
            }
          }

          @keyframes confetti2 {
            to {
              transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) rotate(${Math.random() * 720}deg);
              opacity: 0;
            }
          }

          @keyframes confetti3 {
            to {
              transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) rotate(${Math.random() * 720}deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
}
