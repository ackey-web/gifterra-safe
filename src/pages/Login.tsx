// src/pages/Login.tsx
import React, { useState, useEffect } from "react";
import {
  useAddress,
  useConnectionStatus,
  ConnectWallet,
  useWallet,
} from "@thirdweb-dev/react";
import { usePrivy } from "@privy-io/react-auth";
import { LoginSupportChat } from "../components/LoginSupportChat";
import { MetaMaskPWAWarningModal } from "../components/MetaMaskPWAWarningModal";

export const LoginPage: React.FC = () => {
  const address = useAddress();
  const connectionStatus = useConnectionStatus();
  const wallet = useWallet();
  const { login, authenticated, user } = usePrivy();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMetaMaskWarning, setShowMetaMaskWarning] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // PWA環境検出とMetaMask警告表示（初回のみ）
  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://');

    const hasSeenWarning = localStorage.getItem('metamask_pwa_warning_seen');

    if (isPWA && !hasSeenWarning) {
      // 500msの遅延を入れて、ページ読み込み後にモーダルを表示
      const timer = setTimeout(() => {
        setShowMetaMaskWarning(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  // MetaMask警告モーダルを閉じる処理
  const handleCloseMetaMaskWarning = () => {
    setShowMetaMaskWarning(false);
    localStorage.setItem('metamask_pwa_warning_seen', 'true');
  };

  // Privy認証成功時、マイページにリダイレクト
  useEffect(() => {
    if (authenticated && user) {
      // PrivyユーザーのウォレットアドレスまたはEmailを取得
      const privyAddress = user.wallet?.address || user.email?.address || "privy-user";

      // ローカルストレージに認証情報を保存
      localStorage.setItem("gifterra_auth", JSON.stringify({
        address: privyAddress,
        timestamp: Date.now(),
        walletType: "privy",
        userId: user.id,
      }));

      // マイページにリダイレクト
      window.location.href = "/mypage";
    }
  }, [authenticated, user]);

  // ウォレット接続成功時、マイページにリダイレクト
  useEffect(() => {
    if (address && connectionStatus === "connected") {
      // ローカルストレージに認証情報を保存
      localStorage.setItem("gifterra_auth", JSON.stringify({
        address,
        timestamp: Date.now(),
        walletType: wallet?.walletId || "unknown",
      }));

      // マイページにリダイレクト
      window.location.href = "/mypage";
    }
  }, [address, connectionStatus, wallet]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #018a9a 0%, #017080 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "20px" : "40px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: 24,
          padding: isMobile ? "24px 20px" : "32px 36px",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 8px 16px rgba(0,0,0,0.1), 0 16px 32px rgba(0,0,0,0.15), 0 24px 48px rgba(2, 187, 209, 0.2)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          transform: "translateY(0)",
          transition: "all 0.3s ease",
        }}
      >
        {/* ロゴとキャッチコピー */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="/gifterra-logo.png"
            alt="GIFTERRA"
            style={{
              width: isMobile ? 160 : 200,
              height: "auto",
              margin: "0 auto 16px",
              display: "block",
            }}
          />
          <p
            style={{
              fontSize: isMobile ? 14 : 15,
              color: "#2d3748",
              margin: 0,
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            GIFTERRAにようこそ
            <br />
            まずは無料の送受信から。応援が "循環" する体験へ。
          </p>
        </div>

        {/* 接続状態の表示 */}
        {connectionStatus === "connecting" && (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              background: "#f7fafc",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "inline-block",
                width: 24,
                height: 24,
                border: "3px solid #e2e8f0",
                borderTop: "3px solid #02bbd1",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ marginTop: 12, color: "#4a5568", fontSize: 14 }}>
              接続中...
            </p>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
          </div>
        )}

        {/* 説明セクション */}
        <div
          style={{
            marginBottom: 20,
            padding: 16,
            background: "#f7fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#2d3748",
              margin: "0 0 12px 0",
            }}
          >
            ログイン方法を選択
          </h3>
          <div>
            <p
              style={{
                margin: "0 0 4px 0",
                color: "#4a5568",
                fontSize: 14,
                lineHeight: 1.8,
              }}
            >
              <strong>おすすめ:</strong> Google / SNS またはEmailで簡単ログイン
            </p>
            <p
              style={{
                margin: "0 0 16px 0",
                color: "#718096",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              アカウント認証でウォレットが自動生成されます。
            </p>
            <p
              style={{
                margin: "0 0 16px 0",
                color: "#4a5568",
                fontSize: 14,
                lineHeight: 1.8,
              }}
            >
              <strong>上級者向け:</strong> MetaMaskやCoinbase Walletで接続
            </p>
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  color: "#2d3748",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.6,
                }}
              >
                【推奨ブラウザ】
              </p>
              <p
                style={{
                  margin: 0,
                  color: "#718096",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                本サービスは Safari / Chrome に最適化されています。<br />
                その他ブラウザをご利用の場合、ログイン不可・送信画面が開かない等、<br />
                正常に操作できない事がありますのでご注意ください。
              </p>
            </div>
          </div>
        </div>

        {/* Privyログインボタン（Google/Email） */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => {
              if (typeof login === 'function') {
                try {
                  login();
                } catch (e: any) {
                  console.error('❌ login()エラー:', e);
                  alert(`Privyログインエラー: ${e.message}`);
                }
              } else {
                console.error('❌ login is not a function:', login);
                alert('Privyログイン機能が利用できません。ページをリロードしてください。');
              }
            }}
            style={{
              width: "100%",
              height: 52,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              border: "none",
              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)",
              transition: "all 0.2s",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(16, 185, 129, 0.3)";
            }}
          >
            <span style={{ fontSize: 20 }}>🔐</span>
            Google / SNS でログイン（推奨）
          </button>
        </div>

        {/* 区切り線 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          margin: "20px 0",
        }}>
          <div style={{
            flex: 1,
            height: 1,
            background: "linear-gradient(to right, transparent, #e2e8f0, transparent)",
          }} />
          <span style={{
            padding: "0 12px",
            fontSize: 12,
            color: "#a0aec0",
            fontWeight: 600,
          }}>
            または
          </span>
          <div style={{
            flex: 1,
            height: 1,
            background: "linear-gradient(to left, transparent, #e2e8f0, transparent)",
          }} />
        </div>

        {/* 接続ボタン */}
        <div style={{ marginBottom: 16 }}>
          <ConnectWallet
            theme="dark"
            btnTitle="ログイン / ウォレット接続"
            modalTitle="Gifterraにログイン"
            modalTitleIconUrl=""
            welcomeScreen={{
              title: "Gifterraへようこそ",
              subtitle: "応援が循環するWeb3コミュニティ",
              img: {
                src: "/gifterra-logo.png",
                width: 150,
                height: 150,
              },
            }}
            termsOfServiceUrl="https://example.com/terms"
            privacyPolicyUrl="https://example.com/privacy"
            style={{
              width: "100%",
              height: 52,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)",
              transition: "all 0.2s",
            }}
          />
        </div>

        {/* 手数料の説明 */}
        <div style={{
          marginBottom: 20,
        }}>
          {/* ウォレット接続の注意事項 */}
          <div style={{
            padding: isMobile ? "14px" : "16px",
            background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
            border: "2px solid #f59e0b",
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: isMobile ? 12 : 13,
              fontWeight: 700,
              color: "#92400e",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              ブロックチェーン手数料について
            </div>
            <div style={{ fontSize: isMobile ? 11 : 12, color: "#b45309", lineHeight: 1.6 }}>
              トランザクション（送金・受取など）には少額のガス代が必要です。
              <br />
              <span style={{ fontSize: 10, color: "#78350f" }}>
                （Polygon Mainnet: 約0.01〜0.05円/回）
              </span>
              <br />
              外部サイト:JPYCユーザーガス代支援をご利用いただけます。
            </div>
          </div>
        </div>

        {/* 特徴セクション */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 8,
            marginTop: 0,
          }}
        >
          <div
            style={{
              padding: 12,
              background: "#f0fff4",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>
              セキュア認証
            </div>
          </div>
          <div
            style={{
              padding: 12,
              background: "#fffaf0",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>🎯</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>
              簡単操作
            </div>
          </div>
          <div
            style={{
              padding: 12,
              background: "#fef2f2",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>🌐</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>
              Web3対応
            </div>
          </div>
        </div>

        {/* フッター */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "#718096",
              margin: "0 0 4px 0",
              fontWeight: 500,
            }}
          >
            Powered by GIFTERRA.
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#718096",
              margin: "0 0 12px 0",
              fontWeight: 500,
            }}
          >
            Presented by METATRON.
          </p>
          <p
            style={{
              fontSize: 11,
              color: "#a0aec0",
              margin: 0,
            }}
          >
            特願2025-120883
          </p>
        </div>
      </div>

      {/* ログインサポートチャット */}
      <LoginSupportChat isMobile={isMobile} />

      {/* MetaMask PWA警告モーダル */}
      {showMetaMaskWarning && (
        <MetaMaskPWAWarningModal
          isMobile={isMobile}
          onClose={handleCloseMetaMaskWarning}
        />
      )}
    </div>
  );
};
