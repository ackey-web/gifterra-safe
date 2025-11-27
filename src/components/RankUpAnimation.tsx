// src/components/RankUpAnimation.tsx
// ランクアップ時の豪華なアニメーション演出コンポーネント

import { useEffect, useState } from 'react';
import { rankUpConfetti } from '../utils/confetti';

interface RankUpAnimationProps {
  show: boolean;
  rankLevel: number;
  rankIcon: string;
  rankLabel: string;
  sbtImageUrl?: string; // SBT画像URL（オプション）
  onComplete?: () => void;
}

export function RankUpAnimation({
  show,
  rankLevel,
  rankIcon,
  rankLabel,
  sbtImageUrl,
  onComplete
}: RankUpAnimationProps) {
  const [sbtProcessMsg, setSbtProcessMsg] = useState('');
  const [mainMessage, setMainMessage] = useState('');

  useEffect(() => {
    if (!show) {
      setMainMessage('');
      setSbtProcessMsg('');
      return;
    }

    // メインのランクアップメッセージ
    setMainMessage(`${rankIcon} ${rankLabel} にランクアップ！ 🎉`);

    // SBT処理の詳細案内
    const sbtMessages = [
      "🔥 旧ランクのSBTをバーン中...",
      "✨ 新ランクのSBTをミント中...",
      "🎊 SBTアップグレード完了！"
    ];

    // 豪華なコンフェッティ演出
    rankUpConfetti(rankLevel).catch(console.warn);

    // 段階的なSBT処理メッセージ表示
    const timer1 = setTimeout(() => setSbtProcessMsg(sbtMessages[0]), 500);  // バーンメッセージ
    const timer2 = setTimeout(() => setSbtProcessMsg(sbtMessages[1]), 1500); // ミントメッセージ
    const timer3 = setTimeout(() => setSbtProcessMsg(sbtMessages[2]), 2500); // 完了メッセージ

    // メッセージクリアと完了コールバック
    const cleanup = setTimeout(() => {
      setMainMessage('');
      setSbtProcessMsg('');
      onComplete?.();
    }, 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(cleanup);
    };
  }, [show, rankLevel, rankIcon, rankLabel, onComplete]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
        gap: 20,
      }}
    >
      {/* SBT画像とランクアップメッセージ */}
      {mainMessage && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* SBT画像 */}
          {sbtImageUrl && (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 20,
                overflow: 'hidden',
                border: '4px solid rgba(255, 215, 0, 0.8)',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.4)',
                animation: 'sbtImagePulse 2s ease-in-out infinite',
              }}
            >
              <img
                src={sbtImageUrl}
                alt={`Rank ${rankLevel} SBT`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  // 画像読み込みエラー時はアイコンにフォールバック
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* メインランクアップメッセージ */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: '#fff',
              textAlign: 'center',
              textShadow: '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.8)',
              padding: '24px 48px',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%)',
              borderRadius: 20,
              border: '3px solid rgba(255, 215, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              animation: 'rankUpPulse 2s ease-in-out infinite',
            }}
          >
            {mainMessage}
          </div>
        </div>
      )}

      {/* SBT処理メッセージ */}
      {sbtProcessMsg && (
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            textAlign: 'center',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)',
            padding: '16px 32px',
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 12,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(8px)',
            animation: 'sbtMessageFade 0.5s ease-in',
          }}
        >
          {sbtProcessMsg}
        </div>
      )}

      {/* アニメーション定義 */}
      <style>
        {`
          @keyframes rankUpPulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.05);
              filter: brightness(1.2);
            }
          }

          @keyframes sbtImagePulse {
            0%, 100% {
              transform: scale(1) rotate(0deg);
              box-shadow: 0 0 30px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.4);
            }
            50% {
              transform: scale(1.1) rotate(5deg);
              box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), 0 0 100px rgba(255, 215, 0, 0.6);
            }
          }

          @keyframes sbtMessageFade {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
}
