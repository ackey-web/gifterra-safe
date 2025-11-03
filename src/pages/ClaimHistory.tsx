// src/pages/ClaimHistory.tsx
// ユーザーの特典受け取り履歴ページ

import { useState, useEffect } from 'react';
import { ConnectWallet, useAddress } from '@thirdweb-dev/react';
import { formatUnits } from 'viem';
import { TOKEN } from '../contract';

interface Claim {
  purchaseId: string;
  productId: string;
  productName: string;
  productDescription: string;
  productImage: string;
  txHash: string;
  amountWei: string;
  claimedAt: string;
  status: 'completed' | 'expired' | 'available' | 'pending' | 'failed';
  statusLabel: string;
  hasValidToken: boolean;
  tokenExpiresAt: string | null;
  downloadUrl: string | null;
}

interface ClaimHistoryResponse {
  success: boolean;
  walletAddress: string;
  claims: Claim[];
  totalClaims: number;
}

export default function ClaimHistory() {
  const address = useAddress();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 受け取り履歴を取得
  useEffect(() => {
    if (!address) {
      setClaims([]);
      return;
    }

    fetchClaimHistory();
  }, [address]);

  const fetchClaimHistory = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/claim-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ APIエラー詳細:', errorData);

        const errorMessage = errorData.error || `API Error: ${response.status}`;
        const errorDetails = errorData.details || errorData.code;

        throw new Error(errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage);
      }

      const data: ClaimHistoryResponse = await response.json();

      setClaims(data.claims);
    } catch (err) {
      console.error('❌ 受け取り履歴取得エラー:', err);
      setError(err instanceof Error ? err.message : '受け取り履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // トークン再発行（ギフティに案内）
  const handleReissue = (txHash: string) => {
    // ギフティのチャットを開いて、トランザクションハッシュを伝える
    alert(`トランザクションハッシュをコピーしました：\n${txHash}\n\nギフティに話しかけて、このハッシュを伝えてください。新しいダウンロードリンクを発行します。`);
    navigator.clipboard.writeText(txHash);
  };

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 残り時間表示
  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;

    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return '期限切れ';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `残り ${hours}時間${minutes}分`;
    return `残り ${minutes}分`;
  };

  // ページネーション計算
  const totalPages = Math.ceil(claims.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClaims = claims.slice(startIndex, endIndex);

  // ページ変更時にトップにスクロール
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* ヘッダー */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
            特典受け取り履歴
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            あなたがGIFT HUBで受け取った特典の履歴を確認できます
          </p>
        </div>

        {/* ウォレット接続ボタン */}
        {!address && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center'
          }}>
            <p style={{ fontSize: 16, color: '#fff', marginBottom: 20 }}>
              受け取り履歴を表示するには、ウォレットを接続してください
            </p>
            <ConnectWallet theme="dark" />
          </div>
        )}

        {/* ローディング */}
        {address && isLoading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#fff' }}>
            <div style={{ fontSize: 18, marginBottom: 10 }}>📊 履歴を読み込み中...</div>
            <div style={{ fontSize: 14, opacity: 0.6 }}>少々お待ちください</div>
          </div>
        )}

        {/* エラー */}
        {address && error && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: 16,
            padding: 20,
            color: '#fff'
          }}>
            ❌ {error}
          </div>
        )}

        {/* 受け取り履歴一覧 */}
        {address && !isLoading && !error && (
          <>
            {claims.length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: 60,
                textAlign: 'center',
                color: '#fff'
              }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>📦</div>
                <div style={{ fontSize: 18, marginBottom: 10 }}>まだ特典を受け取っていません</div>
                <div style={{ fontSize: 14, opacity: 0.6 }}>GIFT HUBから特典を受け取ると、ここに履歴が表示されます</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20, color: '#fff', fontSize: 14, opacity: 0.8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>合計 {claims.length} 件の受け取り</div>
                  {totalPages > 1 && (
                    <div style={{ fontSize: 13 }}>
                      ページ {currentPage} / {totalPages}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {currentClaims.map((claim) => {
                    const amountInTokens = formatUnits(BigInt(claim.amountWei), TOKEN.DECIMALS);

                    return (
                      <div
                        key={claim.purchaseId}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 16,
                          padding: 24,
                          display: 'flex',
                          gap: 20
                        }}
                      >
                        {/* 特典画像 */}
                        {claim.productImage && (
                          <img
                            src={claim.productImage}
                            alt={claim.productName}
                            style={{
                              width: 120,
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 12,
                              flexShrink: 0
                            }}
                          />
                        )}

                        {/* 特典情報 */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                            <div>
                              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                                {claim.productName}
                              </h3>
                              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                                {formatDate(claim.claimedAt)} に受け取り
                              </div>
                            </div>
                            <div
                              style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                background: claim.status === 'completed' ? 'rgba(16, 185, 129, 0.2)'
                                  : claim.status === 'available' ? 'rgba(59, 130, 246, 0.2)'
                                  : claim.status === 'expired' ? 'rgba(245, 158, 11, 0.2)'
                                  : claim.status === 'failed' ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(107, 114, 128, 0.2)',
                                color: claim.status === 'completed' ? '#10b981'
                                  : claim.status === 'available' ? '#3b82f6'
                                  : claim.status === 'expired' ? '#f59e0b'
                                  : claim.status === 'failed' ? '#ef4444'
                                  : '#6b7280'
                              }}
                            >
                              {claim.statusLabel}
                            </div>
                          </div>

                          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
                            チップ額: <strong>{Math.floor(Number(amountInTokens))} tNHT</strong>
                          </div>

                          {/* トランザクションハッシュ（コピー機能付き） */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                              トランザクションハッシュ
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="text"
                                value={claim.txHash}
                                readOnly
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  fontSize: 11,
                                  color: 'rgba(255,255,255,0.8)',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 6,
                                  fontFamily: 'monospace',
                                  outline: 'none'
                                }}
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(claim.txHash);
                                  // 簡易フィードバック
                                  const btn = document.activeElement as HTMLButtonElement;
                                  if (btn) {
                                    const originalText = btn.textContent;
                                    btn.textContent = '✓';
                                    setTimeout(() => {
                                      btn.textContent = originalText;
                                    }, 1000);
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#fff',
                                  background: 'rgba(59, 130, 246, 0.8)',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
                                }}
                              >
                                コピー
                              </button>
                            </div>
                          </div>

                          {/* アクション */}
                          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                            {claim.status === 'available' && claim.downloadUrl && (
                              <>
                                <a
                                  href={claim.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    display: 'inline-block'
                                  }}
                                >
                                  🔗 ダウンロード
                                </a>
                                {claim.tokenExpiresAt && (
                                  <div style={{
                                    padding: '10px 16px',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    color: '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}>
                                    ⏰ {getTimeRemaining(claim.tokenExpiresAt)}
                                  </div>
                                )}
                              </>
                            )}

                            {claim.status === 'expired' && (
                              <button
                                onClick={() => handleReissue(claim.txHash)}
                                style={{
                                  padding: '10px 20px',
                                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 8,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🔄 再発行を依頼
                              </button>
                            )}

                            {claim.status === 'completed' && (
                              <div style={{
                                padding: '10px 16px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                borderRadius: 8,
                                fontSize: 13,
                                color: '#10b981'
                              }}>
                                ダウンロード完了済み
                              </div>
                            )}

                            {claim.status === 'failed' && (
                              <div style={{
                                padding: '10px 16px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: 8,
                                fontSize: 13,
                                color: '#ef4444',
                                lineHeight: 1.5
                              }}>
                                トランザクションが失敗しました。<br />
                                ギフティにお問い合わせください。
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ページネーション */}
                {totalPages > 1 && (
                  <div style={{
                    marginTop: 32,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: '10px 20px',
                        background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.8)',
                        color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
                        }
                      }}
                    >
                      ← 前へ
                    </button>

                    <div style={{
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      minWidth: 80,
                      textAlign: 'center'
                    }}>
                      {currentPage} / {totalPages}
                    </div>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '10px 20px',
                        background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.8)',
                        color: currentPage === totalPages ? 'rgba(255,255,255,0.3)' : '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
                        }
                      }}
                    >
                      次へ →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
