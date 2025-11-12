// src/components/QRScannerCamera.tsx
// カメラベースのQRコードスキャナー（PayPay風）

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerCameraProps {
  onScan: (data: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export function QRScannerCamera({ onScan, onClose, placeholder = 'X402決済コードまたはウォレットアドレスを入力' }: QRScannerCameraProps) {
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);

  // X402形式かウォレットアドレスかを判定してバリデーション
  const validateAndProcessScan = (data: string): { isValid: boolean; error?: string } => {
    console.log('🔎 QRScannerCamera - バリデーション開始:', data);

    // まずX402形式のJSONかどうかを確認
    try {
      const parsed = JSON.parse(data);
      console.log('📋 JSONパース成功:', parsed);
      // X402形式の必須フィールドをチェック
      if (parsed.to && parsed.token && parsed.amount) {
        console.log('✅ X402形式として認識');
        return { isValid: true };
      }
      console.log('⚠️ X402必須フィールドが不足');
    } catch (e) {
      console.log('⚠️ JSONパースエラー - ウォレットアドレスかチェック');
      // JSONパースエラー - ウォレットアドレスかもしれない
    }

    // ウォレットアドレス形式をチェック (0xで始まる42文字の16進数)
    if (/^0x[a-fA-F0-9]{40}$/.test(data)) {
      console.log('✅ ウォレットアドレスとして認識');
      return { isValid: true };
    }

    console.log('❌ バリデーション失敗');
    return { isValid: false, error: '無効なQRコードです。X402決済コードまたはウォレットアドレスを使用してください。' };
  };

  // カメラスキャナーの初期化
  useEffect(() => {
    isMounted.current = true;

    const initScanner = async () => {
      try {
        const scannerId = 'qr-reader';
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        // カメラの起動
        await scanner.start(
          { facingMode: 'environment' }, // 背面カメラを使用
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // QRコード読み取り成功
            console.log('📷 QRコード読み取り成功:', decodedText);

            // デバッグ: 読み取り成功をアラート表示
            alert(`QRコード読み取り成功: ${decodedText.substring(0, 50)}...`);

            if (isMounted.current) {
              scanner.stop().then(() => {
                console.log('📷 カメラ停止完了 - バリデーション開始');

                // デバッグ: バリデーション開始をアラート
                alert('バリデーション開始');

                const validation = validateAndProcessScan(decodedText);
                if (validation.isValid) {
                  console.log('✅ バリデーション成功 - onScan呼び出し');

                  // デバッグ: onScan呼び出しをアラート
                  alert('onScan呼び出し - X402PaymentSectionへ');

                  onScan(decodedText);
                  onClose();
                } else {
                  console.log('❌ バリデーション失敗:', validation.error);
                  alert(`バリデーション失敗: ${validation.error}`);
                  setCameraError(validation.error || '無効なQRコードです');
                  setIsScanning(false);
                  setShowManualInput(true);
                }
              }).catch((err) => {
                console.error('❌ カメラ停止エラー:', err);
                alert(`カメラ停止エラー: ${err}`);
              });
            }
          },
          (errorMessage) => {
            // スキャンエラー（無視 - 読み取り中は頻繁に発生）
          }
        );
      } catch (err) {
        if (isMounted.current) {
          setCameraError('カメラの起動に失敗しました。手動入力をご利用ください。');
          setIsScanning(false);
          setShowManualInput(true);
        }
      }
    };

    initScanner();

    return () => {
      isMounted.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // 手動入力の送信
  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();

    if (!trimmed) {
      setError('X402決済コードまたはアドレスを入力してください');
      return;
    }

    const validation = validateAndProcessScan(trimmed);
    if (!validation.isValid) {
      setError(validation.error || '無効な入力です');
      return;
    }

    onScan(trimmed);
    onClose();
  };

  // 手動入力モードに切り替え
  const switchToManualInput = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
    setIsScanning(false);
    setShowManualInput(true);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.95)',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#1a1a1a',
            margin: 0,
          }}>
            {isScanning ? 'QRコードをスキャン' : '送金先アドレス入力'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              color: '#666',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {cameraError && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 14,
            color: '#856404',
          }}>
            {cameraError}
          </div>
        )}

        {/* カメラスキャナー */}
        {isScanning && (
          <>
            <div
              id="qr-reader"
              style={{
                width: '100%',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 16,
              }}
            />
            <p style={{
              fontSize: 14,
              color: '#4a5568',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              QRコードをカメラにかざしてください
            </p>
            <button
              onClick={switchToManualInput}
              style={{
                width: '100%',
                padding: '12px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                color: '#2d3748',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              手動入力に切り替え
            </button>
          </>
        )}

        {/* 手動入力フォーム */}
        {showManualInput && (
          <>
            <p style={{
              fontSize: 14,
              color: '#4a5568',
              marginBottom: 16,
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
              placeholder="X402 JSONまたは0x..."
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
                boxSizing: 'border-box',
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
          </>
        )}
      </div>
    </div>
  );
}
