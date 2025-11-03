// src/components/QRScannerSimple.tsx
// シンプルなアドレス入力コンポーネント（Web対応）

import { useState } from 'react';

interface QRScannerSimpleProps {
  onScan: (data: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export function QRScannerSimple({ onScan, onClose, placeholder = 'ウォレットアドレスを入力' }: QRScannerSimpleProps) {
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // アドレスのバリデーション
  const validateAddress = (address: string): boolean => {
    // 0xで始まる42文字の16進数文字列
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // 手動入力の送信
  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();
    
    if (!trimmed) {
      setError('アドレスを入力してください');
      return;
    }

    if (!validateAddress(trimmed)) {
      setError('無効なウォレットアドレスです');
      return;
    }

    onScan(trimmed);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#1a1a1a',
          marginBottom: 16,
          textAlign: 'center',
        }}>
          送金先アドレス入力
        </h2>

        <p style={{
          fontSize: 14,
          color: '#4a5568',
          marginBottom: 24,
          textAlign: 'center',
        }}>
          {placeholder}
        </p>

        <input
          type="text"
          value={manualInput}
          onChange={(e) => {
            setManualInput(e.target.value);
            setError(null);
          }}
          placeholder="0x..."
          style={{
            width: '100%',
            padding: '16px',
            fontSize: 14,
            fontFamily: 'monospace',
            border: error ? '2px solid #e53e3e' : '2px solid #e2e8f0',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s',
            marginBottom: error ? 8 : 16,
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleManualSubmit();
            }
          }}
        />

        {error && (
          <p style={{
            fontSize: 12,
            color: '#e53e3e',
            marginBottom: 16,
          }}>
            {error}
          </p>
        )}

        <div style={{
          display: 'flex',
          gap: 12,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '8px',
              color: '#2d3748',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleManualSubmit}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
