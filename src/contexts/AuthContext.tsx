// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { usePrivy } from "@privy-io/react-auth";

interface AuthState {
  address: string | null;
  timestamp: number;
  walletType: string;
  userId?: string; // Privy user ID
}

interface AuthContextType {
  isAuthenticated: boolean;
  authState: AuthState | null;
  login: (address: string, walletType: string, userId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const address = useAddress();
  const connectionStatus = useConnectionStatus();
  const { authenticated, user, logout: privyLogout } = usePrivy();
  const [authState, setAuthState] = useState<AuthState | null>(null);

  // 初回ロード時にローカルストレージから認証情報を復元
  useEffect(() => {
    const stored = localStorage.getItem("gifterra_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 24時間以内の認証情報のみ有効
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setAuthState(parsed);
        } else {
          localStorage.removeItem("gifterra_auth");
        }
      } catch (e) {
        console.error("Failed to parse auth state:", e);
        localStorage.removeItem("gifterra_auth");
      }
    }
  }, []);

  // Privy認証状態と同期
  useEffect(() => {
    if (authenticated && user) {
      const privyAddress = user.wallet?.address || user.email?.address || "privy-user";
      login(privyAddress, "privy", user.id);
    }
  }, [authenticated, user]);

  // Thirdwebウォレット接続状態と同期
  useEffect(() => {
    if (address && connectionStatus === "connected") {
      const walletType = "connected"; // 実際のウォレットタイプは後で取得可能
      login(address, walletType);
    } else if (connectionStatus === "disconnected" && authState && authState.walletType !== "privy") {
      // Thirdwebウォレット切断時は認証状態をクリア（Privy認証は維持）
      logout();
    }
  }, [address, connectionStatus]);

  const login = (address: string, walletType: string, userId?: string) => {
    const newAuthState: AuthState = {
      address,
      timestamp: Date.now(),
      walletType,
      userId,
    };
    setAuthState(newAuthState);
    localStorage.setItem("gifterra_auth", JSON.stringify(newAuthState));
  };

  const logout = async () => {
    // Privy認証の場合はPrivyからもログアウト
    if (authenticated) {
      await privyLogout();
    }
    setAuthState(null);
    localStorage.removeItem("gifterra_auth");
  };

  // Privy認証またはThirdweb接続のどちらかがあれば認証済み
  const isAuthenticated =
    (authenticated && !!user) || // Privy認証
    (!!authState && !!address && connectionStatus === "connected") || // Thirdweb接続
    !!authState; // ローカルストレージに認証情報がある

  return (
    <AuthContext.Provider value={{ isAuthenticated, authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
