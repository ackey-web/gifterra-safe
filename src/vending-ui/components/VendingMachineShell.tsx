// src/vending-ui/components/VendingMachineShell.tsx
import type { ReactNode } from "react";

interface VendingMachineShellProps {
  primaryColor: string;
  secondaryColor: string;
  headerTitle: string;
  backgroundImage?: string;
  children: ReactNode;
}

/**
 * GIFT HUBの筐体フレーム（中身＝children を差し替え）
 * - 外周グローは index.css の @keyframes glowPulse / glowPulse2 を使用
 * - 背景グローは pointer-events-none で操作を邪魔しない
 */
export default function VendingMachineShell({
  primaryColor,
  secondaryColor,
  headerTitle,
  backgroundImage,
  children,
}: VendingMachineShellProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-white">
      {/* === 背景画像 ====================================== */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url(${backgroundImage})`,
          }}
        />
      )}

      {/* === 背景グロー（アニメ + フラッシュ）====================================== */}
      <div className="pointer-events-none absolute inset-0">
        {/* フラッシュするオーラ（筐体の背後） - テーマカラー適用 */}
        <div
          className="absolute -top-24 left-1/2 h-[1400px] w-[1400px] -translate-x-1/2 rounded-full blur-[80px] animate-[neonFlash_4s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${primaryColor}50, transparent 60%)`,
          }}
        />
        <div
          className="absolute -top-24 left-1/2 h-[1400px] w-[1400px] -translate-x-1/2 rounded-full blur-[64px] opacity-60 animate-[glowPulse_7s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${primaryColor}50, transparent 60%)`,
          }}
        />
        <div
          className="absolute bottom-[-10%] left-1/2 h-[1200px] w-[1200px] -translate-x-1/2 rounded-full blur-[72px] opacity-30 [mix-blend:screen] animate-[glowPulse2_11s_ease-in-out_infinite]"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%, ${secondaryColor}40, transparent, ${primaryColor}40, transparent, ${secondaryColor}40)`,
          }}
        />
      </div>

      {/* === 筐体本体 =============================================== */}
      <div className="relative z-10 flex min-h-[100svh] items-center justify-center p-4">
        {/* 外枠（ベゼル光） */}
        <div className="relative w-[420px] max-w-[92vw]">
          {/* ネオン輪郭（静的） - テーマカラー適用 */}
          <div
            className="absolute -inset-[3px] rounded-[28px] blur-lg opacity-70"
            style={{
              background: `conic-gradient(from 90deg at 50% 50%, ${primaryColor}, ${secondaryColor}, ${primaryColor})`,
              filter: "saturate(1.2)",
            }}
          />

          {/* 側面のリムライト */}
          <div className="absolute -left-2 top-1/4 h-1/2 w-1 rounded-full bg-white/10 blur-md" />
          <div className="absolute -right-2 top-1/4 h-1/2 w-1 rounded-full bg-white/10 blur-md" />

          {/* パネル（金属筐体の面） - 固定色（ダークメタル） */}
          <div
            className="relative overflow-hidden rounded-[24px]"
            style={{
              background: "linear-gradient(145deg, #1a1f2e, #0f1419)",
              boxShadow: `
                0 25px 60px rgba(0,0,0,0.7),
                inset 0 1px 0 rgba(255,255,255,0.08),
                inset 0 -1px 3px rgba(0,0,0,0.5),
                inset -2px 0 4px rgba(0,0,0,0.3),
                inset 2px 0 4px rgba(255,255,255,0.03)
              `,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* 金属反射レイヤー */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  linear-gradient(165deg,
                    transparent 0%,
                    rgba(255,255,255,0.03) 20%,
                    transparent 40%,
                    rgba(255,255,255,0.02) 60%,
                    transparent 80%
                  )
                `,
              }}
            />

            {/* 内側の背景 */}
            <div className="relative">
              {/* ヘッダー（金属インセット） - スクロールテキスト */}
              <div
                className="py-4 overflow-hidden"
                style={{
                  background: "linear-gradient(180deg, #0a0e14, #12171f)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <div className="whitespace-nowrap">
                  <div
                    className="inline-block"
                    style={{
                      animation: "scrollText 10s linear infinite",
                      paddingRight: "100%",
                    }}
                  >
                    <span className="text-base font-bold text-white/90 tracking-wider">
                      {headerTitle}
                      <span className="mx-8 text-white/50">●</span>
                      {headerTitle}
                    </span>
                  </div>
                </div>
              </div>

              {/* ディスプレイ/ボタン/取り出し口など（親から注入） */}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}