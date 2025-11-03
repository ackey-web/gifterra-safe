// src/admin/components/AdminLayout.tsx
import React, { useState, useEffect } from 'react';
import AdminSidebar, { type PageType } from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { RequireOwner } from '../contexts/TenantContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  emergencyStop: boolean;
  onEmergencyToggle: () => void;
}

export default function AdminLayout({
  children,
  currentPage,
  onPageChange,
  emergencyStop,
  onEmergencyToggle
}: AdminLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // レスポンシブ対応：画面幅を監視
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // モバイルの場合は初期状態で折りたたむ
      if (mobile && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <RequireOwner>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          background: "#0b1620",
          color: "#fff",
        }}
      >
        {/* ヘッダー */}
        <AdminHeader
          emergencyStop={emergencyStop}
          onEmergencyToggle={onEmergencyToggle}
        />

        {/* サイドバー＋メインコンテンツ */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* サイドバー */}
          <AdminSidebar
            currentPage={currentPage}
            onPageChange={onPageChange}
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          {/* メインコンテンツエリア */}
          <main
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              background: "#0b1620",
              position: "relative",
            }}
          >
            <div
              style={{
                maxWidth: 1400,
                margin: "0 auto",
                padding: isMobile ? 16 : 24,
              }}
            >
              {children}
            </div>

            {/* フッター */}
            <footer
              style={{
                textAlign: "center",
                opacity: 0.6,
                fontSize: 12,
                padding: "16px 0",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                marginTop: 32,
              }}
            >
              Presented by <strong>METATRON.</strong>
            </footer>
          </main>
        </div>

        {/* モバイル用オーバーレイ（サイドバーが開いている時） */}
        {isMobile && !isSidebarCollapsed && (
          <div
            onClick={() => setIsSidebarCollapsed(true)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
          />
        )}
      </div>
    </RequireOwner>
  );
}
