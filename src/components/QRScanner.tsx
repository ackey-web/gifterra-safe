// src/components/QRScanner.tsx
// QRコードスキャナーコンポーネント（プラットフォーム検出付き）

import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export function QRScanner({ onScan, onClose, placeholder = 'ウォレットアドレスを入力' }: QRScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // ネイティブアプリでのQRスキャン
  const startNativeScan = async () => {
    try {
      setIsScanning(true);
      setError(null);

      // カメラ権限をチェック
      const status = await BarcodeScanner.checkPermission({ force: true });

      if (!status.granted) {
        setError('カメラへのアクセスが許可されていません');
        setIsScanning(false);
        return;
      }

      // 背景を透明にしてカメラビューを表示
      document.body.classList.add('qr-scanner-active');
      document.body.style.background = 'transparent';

      // スキャン開始
      const result = await BarcodeScanner.startScan();

      // スキャン完了後の処理
      document.body.classList.remove('qr-scanner-active');
      document.body.style.background = '';

      if (result.hasContent) {
        onScan(result.content);
        onClose();
      }
    } catch (err) {
      console.error('QRスキャンエラー:', err);
      setError('QRコードの読み取りに失敗しました');
      document.body.classList.remove('qr-scanner-active');
      document.body.style.background = '';
    } finally {
      setIsScanning(false);
    }
  };

  // スキャンを停止
  const stopScan = async () => {
    try {
      await BarcodeScanner.stopScan();
      document.body.classList.remove('qr-scanner-active');
      document.body.style.background = '';
      setIsScanning(false);
    } catch (err) {
      console.error('スキャン停止エラー:', err);
    }
  };

  // 手動入力の送信
  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isScanning ? 'transparent' : 'rgba(0,0,0,0.8)',
      backdropFilter: isScanning ? 'none' : 'blur(4px)',
    }}>
      {isScanning ? (
        // スキャン中の表示
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          textAlign: 'center',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            padding: '24px 32px',
            borderRadius: 12,
            color: '#fff',
          }}>
            <div style={{ fontSize: 18, marginBottom: 16 }}>
              QRコードをカメラに映してください
            </div>
            <button
              onClick={stopScan}
              style={{
                padding: '12px 24px',
                background: '#ff4444',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        // 入力モーダル
        <div style={{
          background: '#1a1a1f',
          borderRadius: 16,
          padding: 24,
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 20,
            color: '#EAF2FF',
          }}>
            {isNative ? 'QRコード読み取り' : 'アドレス入力'}
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#ff6b6b',
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {isNative ? (
            // ネイティブアプリ：カメラスキャンボタン
            <>
              <button
                onClick={startNativeScan}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                📷 カメラでスキャン
              </button>

              <div style={{
                textAlign: 'center',
                color: '#888',
                fontSize: 14,
                marginBottom: 16,
              }}>
                または
              </div>
            </>
          ) : (
            // Webアプリ：カメラ機能は後日実装の案内
            <div style={{
              background: 'rgba(102, 126, 234, 0.1)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#667EEA',
              fontSize: 13,
            }}>
              💡 カメラスキャン機能はアプリ版で利用可能になります
            </div>
          )}

          {/* 手動入力フォーム */}
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: 14,
              marginBottom: 16,
              fontFamily: 'monospace',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleManualSubmit();
              }
            }}
          />

          <div style={{
            display: 'flex',
            gap: 12,
          }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleManualSubmit}
              disabled={!manualInput.trim()}
              style={{
                flex: 1,
                padding: '12px',
                background: manualInput.trim()
                  ? 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: 8,
                color: manualInput.trim() ? '#fff' : '#666',
                fontSize: 14,
                fontWeight: 600,
                cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              確定
            </button>
          </div>

          {isNative && (
            <div style={{
              marginTop: 16,
              fontSize: 12,
              color: '#666',
              textAlign: 'center',
            }}>
              カメラスキャンには権限の許可が必要です
            </div>
          )}
        </div>
      )}
    </div>
  );
}
