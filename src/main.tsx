// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Buffer } from "buffer";
import { PrivyProvider } from "@privy-io/react-auth";
import { ReceivePage } from "./pages/ReceivePage";
import { MypagePage } from "./pages/Mypage";
import { LoginPage } from "./pages/Login";
import RewardApp from "./reward-ui/App";
import TipApp from "./tip-ui/App";
import VendingApp from "./vending-ui/App";
import AdminDashboard from "./admin/Dashboard";
import { TenantProvider } from "./admin/contexts/TenantContext";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Polyfill Buffer for browser environment (required for Web3 libraries)
window.Buffer = window.Buffer || Buffer;

// Polygon Mainnet configuration for ThirdwebProvider
const polygonChain = {
  chainId: 137,
  name: "Polygon",
  chain: "MATIC",
  rpc: ["https://polygon-rpc.com"],
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
  },
  shortName: "matic",
  slug: "polygon",
  testnet: false,
  explorers: [
    {
      name: "PolygonScan",
      url: "https://polygonscan.com",
      standard: "EIP3091",
    },
  ],
};

// Feature flags
const ENABLE_LEGACY_UI = import.meta.env.VITE_ENABLE_LEGACY_UI !== 'false';

// QueryClient for React Query (needed by ThirdwebProvider)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// URL判定
const path = location.pathname;
const uiParam = new URLSearchParams(location.search).get("ui");

const wantsReceive = path.includes("/receive");
const wantsReward = path.includes("/reward") || uiParam === "reward";
const wantsTip = path.includes("/tip") || uiParam === "tip";
const wantsVending = path.includes("/vending") || path.includes("/content") || uiParam === "vending" || uiParam === "content";
const wantsAdmin = path.includes("/admin") || uiParam === "admin";
const wantsLegacy = path.includes("/legacy");
const wantsLogin = path.includes("/login") || uiParam === "login";

// =============================
// ReactDOM ルート作成
// =============================
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

// =============================
// 最小限のアプリ出力（MVP Phase 1）
// =============================

// Admin用の独立したレンダリング（Thirdwebのみ使用）
if (wantsAdmin) {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider
          activeChain={polygonChain}
          clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
        >
          <TenantProvider>
            <AdminDashboard />
          </TenantProvider>
        </ThirdwebProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
} else {
  // その他のページはPrivy + Thirdweb経由
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider
          activeChain={polygonChain}
          clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
        >
          <PrivyProvider
            appId={import.meta.env.VITE_PRIVY_APP_ID || ""}
            config={{
              loginMethods: ["email", "google", "twitter", "discord", "wallet"],
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
        {wantsLogin ? (
          <LoginPage />
        ) : wantsReceive ? (
          <ReceivePage />
        ) : wantsReward ? (
          <RewardApp />
        ) : wantsTip ? (
          <TipApp />
        ) : wantsVending ? (
          <VendingApp />
        ) : wantsLegacy && ENABLE_LEGACY_UI ? (
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
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                <p>
                  <a
                    href="/"
                    style={{
                      color: 'white',
                      textDecoration: 'underline',
                      opacity: 0.9
                    }}
                  >
                    マイページに戻る →
                  </a>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <LoginPage />
        )}
          </PrivyProvider>
        </ThirdwebProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}