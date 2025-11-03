// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Buffer } from "buffer";
import { PrivyProvider } from "@privy-io/react-auth";
import { ReceivePage } from "./pages/ReceivePage";
import { MypageWithSend } from "./pages/MypageWithSend";

// Polyfill Buffer for browser environment (required for Web3 libraries)
window.Buffer = window.Buffer || Buffer;

// Feature flags
const ENABLE_LEGACY_UI = import.meta.env.VITE_ENABLE_LEGACY_UI !== 'false';

// URL判定
const path = location.pathname;
const wantsLegacy = path.includes("/legacy");
const wantsReceive = path.includes("/receive");
const wantsAdmin = path.includes("/admin");
const wantsMypage = path.includes("/mypage");

// =============================
// ReactDOM ルート作成
// =============================
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

// =============================
// 最小限のアプリ出力（MVP Phase 1）
// =============================
root.render(
  <React.StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || ""}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#02bbd1",
          logo: "/gifterra-logo.png",
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
          noPromptOnSignature: false,
        },
        defaultChain: {
          id: 137,
          name: "Polygon Mainnet",
          network: "polygon",
          nativeCurrency: {
            name: "MATIC",
            symbol: "MATIC",
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: ["https://polygon-rpc.com"],
            },
            public: {
              http: ["https://polygon-rpc.com"],
            },
          },
          blockExplorers: {
            default: {
              name: "PolygonScan",
              url: "https://polygonscan.com",
            },
          },
          testnet: false,
        },
      }}
    >
      {wantsLegacy && ENABLE_LEGACY_UI ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜 Legacy UI</h1>
            <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>
              旧UIは読み取り専用モードで保存されています
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '2rem', opacity: 0.7 }}>
              Phase 1: Isolated /legacy route (Read-only reference)
            </p>
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}>
              <p>旧UIコンポーネントは変更せず、参照用として保持</p>
              <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>
                Mypage.tsx, Dashboard.tsx などはそのまま残存
              </p>
              <p style={{ marginTop: '1rem' }}>
                <a
                  href="/"
                  style={{
                    color: 'white',
                    textDecoration: 'underline',
                    opacity: 0.9
                  }}
                >
                  新UIに戻る →
                </a>
              </p>
            </div>
          </div>
        </div>
      ) : wantsReceive ? (
        <ReceivePage />
      ) : wantsMypage ? (
        <MypageWithSend />
      ) : wantsAdmin ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐 Admin Panel</h1>
            <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>
              管理画面ルーティング準備完了
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '2rem', opacity: 0.7 }}>
              Phase 2e: Admin routing restored
            </p>
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}>
              <p>実際の管理画面コンポーネントは将来のフェーズで統合予定</p>
              <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>
                Dashboard.tsx, VendingDashboardNew.tsx など
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁 GIFTERRA</h1>
            <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>
              Phase 1 MVP Foundation - Build in Progress
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '2rem', opacity: 0.7 }}>
              温存＋段階統合方式で再構築中
            </p>
          </div>
        </div>
      )}
    </PrivyProvider>
  </React.StrictMode>
);