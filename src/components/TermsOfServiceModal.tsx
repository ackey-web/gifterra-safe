// src/components/TermsOfServiceModal.tsx
// 利用規約同意モーダル（初回ログイン時のみ表示）

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface TermsOfServiceModalProps {
  onAccept: () => void;
  isMobile: boolean;
}

export function TermsOfServiceModal({ onAccept, isMobile }: TermsOfServiceModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
          borderRadius: isMobile ? 16 : 24,
          maxWidth: isMobile ? '100%' : 600,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? 20 : 32,
            paddingBottom: isMobile ? 16 : 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 20 : 24,
              fontWeight: 700,
              color: '#EAF2FF',
              textAlign: 'center',
            }}
          >
            GIFTERRA 利用規約への同意
          </h2>
          <p
            style={{
              margin: '12px 0 0 0',
              fontSize: isMobile ? 13 : 14,
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
            }}
          >
            GIFTERRAをご利用いただくには、以下の規約への同意が必要です
          </p>
        </div>

        {/* スクロール可能なコンテンツ */}
        <div
          onClick={() => isMobile && setIsExpanded(!isExpanded)}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? 20 : 32,
            cursor: isMobile ? 'pointer' : 'default',
            position: 'relative',
          }}
        >
          {/* タップで拡大表示ヒント（スマホのみ） */}
          {isMobile && !isExpanded && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                textAlign: 'center',
                fontSize: 12,
                color: '#60a5fa',
                fontWeight: 600,
              }}
            >
              👆 タップすると文字が拡大表示されます
            </div>
          )}

          {/* 重要な注意事項 */}
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 24,
            }}
          >
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? (isExpanded ? 18 : 15) : 16,
                fontWeight: 700,
                color: '#ef4444',
                transition: 'font-size 0.2s',
              }}
            >
              重要な免責事項
            </h3>
            <ul
              style={{
                margin: 0,
                padding: '0 0 0 20px',
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: 1.6,
                transition: 'font-size 0.2s',
              }}
            >
              <li>送金は不可逆的であり、誤送金の場合も返金できません</li>
              <li>秘密鍵を紛失した場合、資産を復元することはできません</li>
              <li>スマートコントラクトのバグや脆弱性のリスクが存在します</li>
              <li>ブロックチェーン技術の特性上、取引の取り消しはできません</li>
            </ul>
          </div>

          {/* 利用規約リンク */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 16,
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? (isExpanded ? 17 : 14) : 15,
                fontWeight: 600,
                color: '#EAF2FF',
                transition: 'font-size 0.2s',
              }}
            >
              📜 利用規約
            </h4>
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: 1.6,
                transition: 'font-size 0.2s',
              }}
            >
              サービスの利用条件、禁止事項、知的財産権等について定めています。
            </p>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                fontWeight: 600,
                transition: 'font-size 0.2s',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              利用規約を読む →
            </a>
          </div>

          {/* プライバシーポリシーリンク */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 16,
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? (isExpanded ? 17 : 14) : 15,
                fontWeight: 600,
                color: '#EAF2FF',
                transition: 'font-size 0.2s',
              }}
            >
              🔒 プライバシーポリシー
            </h4>
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: 1.6,
                transition: 'font-size 0.2s',
              }}
            >
              個人情報の収集・利用目的、第三者提供について定めています。
            </p>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                fontWeight: 600,
                transition: 'font-size 0.2s',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              プライバシーポリシーを読む →
            </a>
          </div>

          {/* JPYC免責事項 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 16,
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? (isExpanded ? 17 : 14) : 15,
                fontWeight: 600,
                color: '#EAF2FF',
                transition: 'font-size 0.2s',
              }}
            >
              💴 JPYCについて
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: 1.6,
                transition: 'font-size 0.2s',
              }}
            >
              本サービス（コンテンツ・作品等）はJPYC株式会社による公式コンテンツではありません。「JPYC」はJPYC株式会社の提供するステーブルコインです。JPYC及びJPYCロゴは、JPYC株式会社の登録商標です。
            </p>
          </div>

          {/* 特許情報 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
            }}
          >
            <h4
              style={{
                margin: '0 0 8px 0',
                fontSize: isMobile ? (isExpanded ? 17 : 14) : 15,
                fontWeight: 600,
                color: '#EAF2FF',
                transition: 'font-size 0.2s',
              }}
            >
              💡 知的財産権について
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? (isExpanded ? 15 : 12) : 13,
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: 1.6,
                transition: 'font-size 0.2s',
              }}
            >
              本サービスで使用されている技術は特許出願中です。無断での複製・転用を禁止します。
            </p>
          </div>
        </div>

        {/* フッター（同意チェックボックスとボタン） */}
        <div
          style={{
            padding: isMobile ? 20 : 32,
            paddingTop: isMobile ? 16 : 24,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* 同意チェックボックス */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              cursor: 'pointer',
              marginBottom: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{
                width: 20,
                height: 20,
                marginTop: 2,
                cursor: 'pointer',
                accentColor: '#3b82f6',
              }}
            />
            <span
              style={{
                fontSize: isMobile ? (isExpanded ? 16 : 13) : 14,
                color: '#EAF2FF',
                lineHeight: 1.5,
                transition: 'font-size 0.2s',
              }}
            >
              上記の利用規約、プライバシーポリシー、免責事項を読み、理解し、同意します
            </span>
          </label>

          {/* 同意ボタン */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
            }}
            disabled={!agreed}
            style={{
              width: '100%',
              padding: isMobile ? 14 : 16,
              background: agreed
                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                : '#cccccc',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: isMobile ? (isExpanded ? 18 : 15) : 16,
              fontWeight: 700,
              cursor: agreed ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: agreed ? '0 4px 16px rgba(59, 130, 246, 0.4)' : 'none',
              opacity: agreed ? 1 : 0.6,
            }}
            onMouseOver={(e) => {
              if (agreed) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = agreed
                ? '0 4px 16px rgba(59, 130, 246, 0.4)'
                : 'none';
            }}
          >
            同意してGIFTERRAを利用する
          </button>

          <p
            style={{
              margin: '12px 0 0 0',
              fontSize: isMobile ? (isExpanded ? 14 : 11) : 12,
              color: 'rgba(255, 255, 255, 0.5)',
              textAlign: 'center',
              transition: 'font-size 0.2s',
            }}
          >
            同意しない場合はサービスをご利用いただけません
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
