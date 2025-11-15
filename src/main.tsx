// src/main.tsx
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Buffer } from "buffer";
import { PrivyProvider } from "@privy-io/react-auth";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { initGifterraStatusBar } from "./utils/statusBar";
import { initGifterraKeyboard } from "./utils/keyboard";

// =============================
// コード分割: React.lazy によるルートベース遅延読み込み
// =============================
const ReceivePage = lazy(() => import("./pages/ReceivePage").then(m => ({ default: m.ReceivePage })));
const MypagePage = lazy(() => import("./pages/Mypage").then(m => ({ default: m.MypagePage })));
const LoginPage = lazy(() => import("./pages/Login").then(m => ({ default: m.LoginPage })));
const RewardApp = lazy(() => import("./reward-ui/App"));
const TipApp = lazy(() => import("./tip-ui/App"));
const VendingApp = lazy(() => import("./vending-ui/App"));
const AdminDashboard = lazy(() => import("./admin/Dashboard"));
const SuperAdminPage = lazy(() => import("./pages/SuperAdmin").then(m => ({ default: m.SuperAdminPage })));
const TenantProvider = lazy(() => import("./admin/contexts/TenantContext").then(m => ({ default: m.TenantProvider })));
const PaymentTerminal = lazy(() => import("./admin/components/PaymentTerminal").then(m => ({ default: m.PaymentTerminal })));
const PaymentTerminalMobile = lazy(() => import("./admin/components/PaymentTerminalMobile").then(m => ({ default: m.PaymentTerminalMobile })));
const AppWrapper = lazy(() => import("./components/AppWrapper").then(m => ({ default: m.AppWrapper })));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicyPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));

// ローディングコンポーネント
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #018a9a 0%, #01525e 100%)',
    color: 'white',
    fontSize: '18px',
    fontWeight: 600,
  }}>
    読み込み中...
  </div>
);

// Polyfill Buffer for browser environment (required for Web3 libraries)
window.Buffer = window.Buffer || Buffer;

// =============================
// Capacitor ネイティブアプリ初期化
// =============================
if (Capacitor.isNativePlatform()) {
  // ステータスバー初期化（GIFTERRAテーマカラー適用）
  initGifterraStatusBar().catch(err => {
    console.warn('StatusBar initialization failed:', err);
  });

  // キーボード初期化（リサイズモード、スクロールアシスト）
  initGifterraKeyboard().catch(err => {
    console.warn('Keyboard initialization failed:', err);
  });
}

// =============================
// グローバルエラーハンドラー（本番環境用 - デバッグUI無効化）
// =============================

// QRスキャナーのstopエラーを抑制（ユーザーに影響なし）
window.onerror = (message, source, lineno, colno, error) => {
  // QRスキャナーのstopエラーは無視
  if (message && message.includes('Cannot stop, scanner is not running')) {
    return true; // エラーを抑制
  }

  // その他のエラーはコンソールにのみ記録
  console.error('エラー:', { message, source, lineno, colno, error });
  return false;
};

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
const wantsSuperAdmin = path.includes("/super-admin") || path.includes("/superadmin") || uiParam === "super-admin" || uiParam === "superadmin";
const wantsAdmin = (path.includes("/admin") && !path.includes("/super-admin") && !path.includes("/superadmin")) || uiParam === "admin";
const wantsTerminal = path.includes("/terminal") || uiParam === "terminal";
const wantsLegacy = path.includes("/legacy");
const wantsLogin = path.includes("/login") || uiParam === "login";
const wantsMypage = path.includes("/mypage") || uiParam === "mypage";
const wantsTerms = path.includes("/terms");
const wantsPrivacy = path.includes("/privacy");
const wantsProfile = path.includes("/profile") || uiParam === "profile";

// =============================
// デバイス判別（モバイル vs タブレット/デスクトップ）
// =============================
const isMobileDevice = window.innerWidth < 768 || /iPhone|iPod|Android/i.test(navigator.userAgent);

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
      <Suspense fallback={<LoadingFallback />}>
        <TermsOfServicePage />
      </Suspense>
    </React.StrictMode>
  );
} else if (wantsPrivacy) {
  // プライバシーポリシーページ（認証不要）
  root.render(
    <React.StrictMode>
      <Suspense fallback={<LoadingFallback />}>
        <PrivacyPolicyPage />
      </Suspense>
    </React.StrictMode>
  );
} else if (wantsReceive) {
  // 受け取りページ（認証不要）
  root.render(
    <React.StrictMode>
      <Suspense fallback={<LoadingFallback />}>
        <ReceivePage />
      </Suspense>
    </React.StrictMode>
  );
} else if (wantsSuperAdmin) {
// Super Admin用の独立したレンダリング（Thirdwebのみ使用）
  root.render(
    <React.StrictMode>
      <Suspense fallback={<LoadingFallback />}>
        <QueryClientProvider client={queryClient}>
          <ThirdwebProvider
            activeChain={polygonChain}
            clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
          >
            <SuperAdminPage />
          </ThirdwebProvider>
        </QueryClientProvider>
      </Suspense>
    </React.StrictMode>
  );
} else if (wantsTerminal) {
  // 受取ターミナルUI（デバイス判別：モバイル/タブレット）
  root.render(
    <React.StrictMode>
      <Suspense fallback={<LoadingFallback />}>
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
              {isMobileDevice ? <PaymentTerminalMobile /> : <PaymentTerminal />}
            </PrivyProvider>
          </ThirdwebProvider>
        </QueryClientProvider>
      </Suspense>
    </React.StrictMode>
  );
} else if (wantsAdmin) {
  // Admin用の独立したレンダリング（Privy + Thirdweb）
  root.render(
    <React.StrictMode>
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    </React.StrictMode>
  );
} else {
  // その他のページはPrivy + Thirdweb経由
  root.render(
    <React.StrictMode>
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    </React.StrictMode>
  );
}