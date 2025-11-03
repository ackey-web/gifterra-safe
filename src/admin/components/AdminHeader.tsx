// src/admin/components/AdminHeader.tsx
import React from 'react';
import { ConnectWallet } from "@thirdweb-dev/react";
import { useTenant } from '../contexts/TenantContext';

interface AdminHeaderProps {
  emergencyStop: boolean;
  onEmergencyToggle: () => void;
}

export default function AdminHeader({
  emergencyStop,
  onEmergencyToggle
}: AdminHeaderProps) {
  const { tenant, isOwner, isDevSuperAdmin, ownerStatus, devMode } = useTenant();

  return (
    <header
      style={{
        background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      {/* 左側：テナント情報とステータス */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* 開発モード警告 */}
        {devMode && isDevSuperAdmin && (
          <div
            style={{
              padding: "6px 12px",
              background: "rgba(245, 158, 11, 0.2)",
              border: "2px solid rgba(245, 158, 11, 0.5)",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              animation: "pulse 2s ease-in-out infinite"
            }}
          >
            🔧 DEV MODE
          </div>
        )}

        {/* テナント名 */}
        <div
          style={{
            padding: "6px 12px",
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <span style={{ opacity: 0.7 }}>テナント: </span>
          <strong>{tenant.name}</strong>
        </div>

        {/* 権限表示 */}
        <div
          style={{
            padding: "6px 12px",
            background: isOwner ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${isOwner ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <span style={{ opacity: 0.7 }}>権限: </span>
          <strong>
            {isDevSuperAdmin ? "🔧 デバッグ管理者" : isOwner ? "✅ オーナー" : "❌ 非オーナー"}
          </strong>
        </div>

        {/* コントラクト権限 */}
        {isOwner && (
          <div
            style={{
              padding: "6px 12px",
              background: "rgba(139, 92, 246, 0.1)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            <span style={{ opacity: 0.7 }}>コントラクト: </span>
            {ownerStatus.gifterra && <span title="Gifterra">🎁 </span>}
            {ownerStatus.rewardEngine && <span title="RewardEngine">⚙️ </span>}
            {ownerStatus.flagNFT && <span title="FlagNFT">🚩 </span>}
            {ownerStatus.rewardToken && <span title="RewardToken">🪙 </span>}
            {ownerStatus.tipManager && <span title="TipManager">💝 </span>}
            {ownerStatus.paymentSplitter && <span title="PaymentSplitter">💰 </span>}
          </div>
        )}
      </div>

      {/* 右側：アクション */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* リロードボタン */}
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#0ea5e9",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          🔄 リロード
        </button>

        {/* 緊急停止ボタン */}
        <button
          onClick={onEmergencyToggle}
          style={{
            background: emergencyStop ? "#16a34a" : "#dc2626",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 12,
            minWidth: 100,
          }}
        >
          {emergencyStop ? "🟢 稼働再開" : "🛑 緊急停止"}
        </button>

        {/* ウォレット接続 */}
        <ConnectWallet
          theme="dark"
          btnTitle="Connect"
          modalTitle="管理者ダッシュボード接続"
          modalTitleIconUrl=""
          style={{
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 6,
          }}
        />
      </div>

      {/* 開発モード注意書き */}
      {devMode && isDevSuperAdmin && (
        <div
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px 16px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: 6,
            fontSize: 11,
            textAlign: "center",
            opacity: 0.8,
          }}
        >
          ⚠️ 開発環境モード：全コントラクトへのフルアクセスが許可されています。本番環境では無効化されます。
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </header>
  );
}
