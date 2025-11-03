/**
 * @file トークン軸設定ページ
 * @description Admin用：トークンをEconomic/Resonance軸に分類管理
 */

import React, { useState, useEffect } from 'react';

// ========================================
// 型定義
// ========================================

interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  isEconomic: boolean;
  decimals: number;
  lastUpdated: string;
}

// ========================================
// メインコンポーネント
// ========================================

export const TokenAxisPage: React.FC = () => {
  const [tokens, setTokens] = useState<TokenConfig[]>([]);
  const [newToken, setNewToken] = useState({
    address: '',
    symbol: '',
    name: '',
    decimals: 18,
    isEconomic: true,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // トークンリスト取得
  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      // TODO: 実際のAPIエンドポイントから取得
      // モックデータ
      setTokens([
        {
          address: '0x6ae...jpyc',
          symbol: 'JPYC',
          name: 'JPY Coin',
          isEconomic: true,
          decimals: 18,
          lastUpdated: new Date().toISOString(),
        },
        {
          address: '0xdB7...nht',
          symbol: 'NHT',
          name: 'Non-Economic Heat Token',
          isEconomic: false,
          decimals: 18,
          lastUpdated: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    }
  };

  const handleToggleAxis = async (token: TokenConfig) => {
    try {
      const response = await fetch('/api/admin/token-axis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ADMIN_API_KEY || '',
        },
        body: JSON.stringify({
          token: token.address,
          isEconomic: !token.isEconomic,
        }),
      });

      if (response.ok) {
        setTokens(
          tokens.map((t) =>
            t.address === token.address ? { ...t, isEconomic: !t.isEconomic } : t
          )
        );
        alert('✅ トークン軸を変更しました');
      } else {
        throw new Error('Failed to update token axis');
      }
    } catch (error) {
      console.error('Toggle error:', error);
      alert('❌ 変更に失敗しました');
    }
  };

  const handleAddToken = async () => {
    if (!newToken.address || !newToken.symbol) {
      alert('❌ アドレスとシンボルは必須です');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/token-axis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ADMIN_API_KEY || '',
        },
        body: JSON.stringify({
          token: newToken.address,
          isEconomic: newToken.isEconomic,
        }),
      });

      if (response.ok) {
        await fetchTokens();
        setNewToken({
          address: '',
          symbol: '',
          name: '',
          decimals: 18,
          isEconomic: true,
        });
        setIsAdding(false);
        alert('✅ トークンを追加しました');
      } else {
        throw new Error('Failed to add token');
      }
    } catch (error) {
      console.error('Add error:', error);
      alert('❌ 追加に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="token-axis-page">
      <style jsx>{`
        .token-axis-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        /* ヘッダー */
        .page-header {
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 28px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .page-description {
          font-size: 14px;
          color: #718096;
        }

        /* カード */
        .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-bottom: 24px;
        }

        .card-title {
          font-size: 20px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* 統計 */
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          padding: 20px;
          background: linear-gradient(135deg, #667eea22, #764ba222);
          border-radius: 12px;
          text-align: center;
        }

        .stat-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
        }

        /* トークンリスト */
        .token-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .token-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .token-item:hover {
          background: #edf2f7;
        }

        .token-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          color: white;
          flex-shrink: 0;
        }

        .token-info {
          flex: 1;
          min-width: 0;
        }

        .token-symbol {
          font-size: 18px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .token-name {
          font-size: 14px;
          color: #718096;
        }

        .token-address {
          font-size: 12px;
          color: #a0aec0;
          font-family: monospace;
          margin-top: 4px;
        }

        /* 軸バッジ */
        .axis-badge {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .axis-badge.economic {
          background: linear-gradient(135deg, #3498db, #2980b9);
          color: white;
        }

        .axis-badge.resonance {
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
        }

        .axis-badge:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        /* 追加フォーム */
        .add-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: #f7fafc;
          border-radius: 12px;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
        }

        .form-input {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .axis-toggle {
          display: flex;
          gap: 12px;
        }

        .toggle-option {
          flex: 1;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toggle-option:hover {
          border-color: #cbd5e0;
        }

        .toggle-option.active {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea11, #764ba211);
        }

        /* ボタン */
        .button-group {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .button-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .button-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .button-secondary {
          background: white;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .button-secondary:hover {
          background: #f7fafc;
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* 空状態 */
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #718096;
        }

        .empty-emoji {
          font-size: 64px;
          margin-bottom: 16px;
        }

        /* モバイル対応 */
        @media (max-width: 768px) {
          .stats {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .token-item {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>

      {/* ヘッダー */}
      <div className="page-header">
        <h1 className="page-title">🔧 トークン軸設定</h1>
        <p className="page-description">
          各トークンをEconomic（金銭的）またはResonance（熱量的）軸に分類します
        </p>
      </div>

      {/* 統計 */}
      <div className="stats">
        <div className="stat-card">
          <div className="stat-label">Total Tokens</div>
          <div className="stat-value">{tokens.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">💸 Economic</div>
          <div className="stat-value">{tokens.filter((t) => t.isEconomic).length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">🔥 Resonance</div>
          <div className="stat-value">{tokens.filter((t) => !t.isEconomic).length}</div>
        </div>
      </div>

      {/* トークンリスト */}
      <div className="card">
        <div className="card-title">
          <span>📋 トークンリスト</span>
          <button
            className="button button-primary"
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? '✕ キャンセル' : '＋ トークン追加'}
          </button>
        </div>

        {/* 追加フォーム */}
        {isAdding && (
          <div className="add-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">トークンアドレス *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0x..."
                  value={newToken.address}
                  onChange={(e) => setNewToken({ ...newToken, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">シンボル *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="JPYC"
                  value={newToken.symbol}
                  onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">トークン名</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="JPY Coin"
                  value={newToken.name}
                  onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Decimals</label>
                <input
                  type="number"
                  className="form-input"
                  value={newToken.decimals}
                  onChange={(e) =>
                    setNewToken({ ...newToken, decimals: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">トークン軸</label>
              <div className="axis-toggle">
                <div
                  className={`toggle-option ${newToken.isEconomic ? 'active' : ''}`}
                  onClick={() => setNewToken({ ...newToken, isEconomic: true })}
                >
                  💸 Economic<br />
                  <small>金銭的貢献</small>
                </div>
                <div
                  className={`toggle-option ${!newToken.isEconomic ? 'active' : ''}`}
                  onClick={() => setNewToken({ ...newToken, isEconomic: false })}
                >
                  🔥 Resonance<br />
                  <small>継続的熱量</small>
                </div>
              </div>
            </div>

            <div className="button-group">
              <button className="button button-secondary" onClick={() => setIsAdding(false)}>
                キャンセル
              </button>
              <button
                className="button button-primary"
                onClick={handleAddToken}
                disabled={isSaving}
              >
                {isSaving ? '追加中...' : '💾 追加する'}
              </button>
            </div>
          </div>
        )}

        {/* トークンリスト */}
        <div className="token-list">
          {tokens.length === 0 ? (
            <div className="empty-state">
              <div className="empty-emoji">🪙</div>
              <div>まだトークンが登録されていません</div>
            </div>
          ) : (
            tokens.map((token) => (
              <div key={token.address} className="token-item">
                <div className="token-icon">{token.symbol.charAt(0)}</div>

                <div className="token-info">
                  <div className="token-symbol">{token.symbol}</div>
                  <div className="token-name">{token.name}</div>
                  <div className="token-address">{token.address}</div>
                </div>

                <div
                  className={`axis-badge ${token.isEconomic ? 'economic' : 'resonance'}`}
                  onClick={() => handleToggleAxis(token)}
                  title="クリックで切り替え"
                >
                  {token.isEconomic ? '💸 Economic' : '🔥 Resonance'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenAxisPage;
