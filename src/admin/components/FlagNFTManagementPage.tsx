// src/admin/components/FlagNFTManagementPage.tsx
import React from 'react';

export default function FlagNFTManagementPage() {
  return (
    <div
      style={{
        padding: 24,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ textAlign: "center", paddingTop: 60, paddingBottom: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚩</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#ea580c" }}>
          フラグNFT管理
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>
          この機能は現在開発中です
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "rgba(234, 88, 12, 0.1)",
            border: "1px solid rgba(234, 88, 12, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          💡 フラグ付きNFTの発行・管理機能を実装予定
        </div>
      </div>
    </div>
  );
}
