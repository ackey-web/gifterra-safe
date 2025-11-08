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
import { SuperAdminPage } from "./pages/SuperAdmin";
import { TenantProvider } from "./admin/contexts/TenantContext";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppWrapper } from "./components/AppWrapper";
import { TermsOfServicePage } from "./pages/TermsOfService";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicy";
import { ProfilePage } from "./pages/ProfilePage";

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

// デバッグログ
console.log('🚀 main.tsx loading...', {
  pathname: location.pathname,
  search: location.search,
});

// URL判定
const path = location.pathname;
const uiParam = new URLSearchParams(location.search).get("ui");

console.log('🔍 Route detection:', {
  path,
  uiParam,
  wantsReceive: path.includes("/receive"),
  wantsReward: path.includes("/reward") || uiParam === "reward",
  wantsTip: path.includes("/tip") || uiParam === "tip",
  wantsVending: path.includes("/vending") || path.includes("/content") || uiParam === "vending" || uiParam === "content",
  wantsAdmin: path.includes("/admin") || uiParam === "admin",
  wantsSuperAdmin: path.includes("/super-admin") || uiParam === "super-admin",
  wantsLegacy: path.includes("/legacy"),
  wantsLogin: path.includes("/login") || uiParam === "login",
  wantsMypage: path.includes("/mypage") || uiParam === "mypage",
});

const wantsReceive = path.includes("/receive");
const wantsReward = path.includes("/reward") || uiParam === "reward";
const wantsTip = path.includes("/tip") || uiParam === "tip";
const wantsVending = path.includes("/vending") || path.includes("/content") || uiParam === "vending" || uiParam === "content";
const wantsAdmin = path.includes("/admin") || uiParam === "admin";
const wantsSuperAdmin = path.includes("/super-admin") || uiParam === "super-admin";
const wantsLegacy = path.includes("/legacy");
const wantsLogin = path.includes("/login") || uiParam === "login";
const wantsMypage = path.includes("/mypage") || uiParam === "mypage";
const wantsTerms = path.includes("/terms");
const wantsPrivacy = path.includes("/privacy");
const wantsProfile = path.includes("/profile") || uiParam === "profile";

// =============================
// ReactDOM ルート作成
// =============================
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

// =============================
// 最小限のアプリ出力（MVP Phase 1）
// =============================

// 利用規約ページ（認証不要）
if (wantsTerms) {
  root.render(
    <React.StrictMode>
      <TermsOfServicePage />
    </React.StrictMode>
  );
} else if (wantsPrivacy) {
  // プライバシーポリシーページ（認証不要）
  root.render(
    <React.StrictMode>
      <PrivacyPolicyPage />
    </React.StrictMode>
  );
} else if (wantsReceive) {
  // 受け取りページ（認証不要）
  root.render(
    <React.StrictMode>
      <ReceivePage />
    </React.StrictMode>
  );
} else if (wantsSuperAdmin) {
// Super Admin用の独立したレンダリング（Thirdwebのみ使用）
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider
          activeChain={polygonChain}
          clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
        >
          <SuperAdminPage />
        </ThirdwebProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
} else if (wantsAdmin) {
  // Admin用の独立したレンダリング（Privy + Thirdweb）
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
            <TenantProvider>
              <AdminDashboard />
            </TenantProvider>
          </PrivyProvider>
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
            <AppWrapper>
              {wantsLogin ? (
                <LoginPage />
              ) : wantsMypage ? (
                <MypagePage />
              ) : wantsProfile ? (
                <ProfilePage />
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
            </AppWrapper>
          </PrivyProvider>
        </ThirdwebProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}