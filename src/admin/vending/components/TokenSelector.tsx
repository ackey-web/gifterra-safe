// src/admin/vending/components/TokenSelector.tsx
// GIFT HUB設定用トークン選択コンポーネント

import { useState, useEffect } from 'react';
import type { TokenId } from '../../../config/tokens';
import {
  getAvailableTokens,
  formatTokenSymbol,
  getNetworkEnv,
} from '../../../config/tokens';

interface TokenSelectorProps {
  selectedTokens: TokenId[];
  onChange: (tokens: TokenId[]) => void;
  label?: string;
  description?: string;
}

export function TokenSelector({
  selectedTokens,
  onChange,
  label = '受け入れるトークン',
  description = 'このGIFT HUBで利用可能な決済トークンを選択してください',
}: TokenSelectorProps) {
  const [availableTokens, setAvailableTokens] = useState(getAvailableTokens(false));
  const network = getNetworkEnv();

  useEffect(() => {
    // 利用可能なトークンリストを更新
    setAvailableTokens(getAvailableTokens(false));
  }, []);

  const handleToggleToken = (tokenId: TokenId) => {
    if (selectedTokens.includes(tokenId)) {
      // 削除
      onChange(selectedTokens.filter(t => t !== tokenId));
    } else {
      // 追加
      onChange([...selectedTokens, tokenId]);
    }
  };

  const handleSelectAll = () => {
    const configuredTokens = availableTokens
      .filter(token => token.currentAddress !== '0x0000000000000000000000000000000000000000')
      .map(token => token.id);
    onChange(configuredTokens);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSelectAll}
            style={{
              padding: '4px 10px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 4,
              color: '#3B82F6',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            全選択
          </button>
          <button
            onClick={handleClearAll}
            style={{
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 4,
              color: '#EF4444',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            クリア
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
        {description}
      </p>

      {network === 'testnet' && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 6,
          marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#FCD34D' }}>
            ⚠️ テストネットモード: トークンアドレスはテストネット用です
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {availableTokens.map((token) => {
          const isSelected = selectedTokens.includes(token.id);
          const isConfigured = token.currentAddress !== '0x0000000000000000000000000000000000000000';

          return (
            <div
              key={token.id}
              onClick={() => isConfigured && handleToggleToken(token.id)}
              style={{
                padding: '12px 16px',
                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isSelected ? '#3B82F6' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 8,
                cursor: isConfigured ? 'pointer' : 'not-allowed',
                opacity: isConfigured ? 1 : 0.4,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* チェックボックス */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: isSelected ? '#3B82F6' : 'rgba(255,255,255,0.1)',
                border: `2px solid ${isSelected ? '#3B82F6' : 'rgba(255,255,255,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* トークン情報 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {formatTokenSymbol(token.id, true)}
                  </span>
                  {!isConfigured && (
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#EF4444',
                    }}>
                      未設定
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {token.description || token.name}
                </p>
                {isConfigured && (
                  <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                    {token.currentAddress.slice(0, 10)}...{token.currentAddress.slice(-8)}
                  </p>
                )}
              </div>

              {/* トークンアイコン */}
              {token.icon && (
                <img
                  src={token.icon}
                  alt={token.symbol}
                  style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {selectedTokens.length === 0 && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 6,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: '#F87171' }}>
            ⚠️ 少なくとも1つのトークンを選択してください
          </p>
        </div>
      )}

      {selectedTokens.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 6,
        }}>
          <p style={{ margin: '0 0 4px 0', fontSize: 11, fontWeight: 600, color: '#10B981' }}>
            選択中のトークン ({selectedTokens.length}個):
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {selectedTokens.map(id => formatTokenSymbol(id)).join(' / ')}
          </p>
        </div>
      )}
    </div>
  );
}
