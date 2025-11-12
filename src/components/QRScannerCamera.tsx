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
  const isStoppingRef = useRef(false); // 停止処理中フラグ

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
            // 永続的なデバッグログ（localStorage + DOM）
            const log = (message: string) => {
              const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
              const logEntry = `[${timestamp}] ${message}`;

              // localStorageに追記
              const existingLogs = localStorage.getItem('qr_scan_debug_log') || '';
              localStorage.setItem('qr_scan_debug_log', existingLogs + '\n' + logEntry);

              // DOM要素に反映（React非依存）
              const debugDiv = document.getElementById('qr-scan-persistent-debug');
              if (debugDiv) {
                const allLogs = (existingLogs + '\n' + logEntry)
                  .split('\n')
                  .filter(l => l.trim());

                // 最新30行を表示（増やした）
                debugDiv.innerHTML = allLogs.slice(-30).join('<br/>');

                // 自動スクロール（最下部へ）
                debugDiv.scrollTop = debugDiv.scrollHeight;
              }

              console.log(logEntry);
            };

            log('📷 QR読取成功: ' + decodedText.substring(0, 30) + '...');

            // 二重呼び出し防止
            if (isStoppingRef.current) {
              log('⚠️ 停止処理中のためスキップ');
              return;
            }

            if (isMounted.current) {
              isStoppingRef.current = true;
              log('🔒 停止フラグON');

              // バリデーション処理
              log('🔎 バリデーション開始');
              const validation = validateAndProcessScan(decodedText);

              if (validation.isValid) {
                log('✅ バリデーションOK');

                // scanner.stop()を完全にスキップ！
                log('⚠️ scanner.stop()をスキップ（呼び出さない）');

                // コールバック実行
                log('📞 onScan()呼び出し前');
                try {
                  onScan(decodedText);
                  log('✅ onScan()完了');
                } catch (e: any) {
                  log('❌ onScan()エラー: ' + e.message);
                }

                log('📞 onClose()呼び出し前');
                try {
                  onClose();
                  log('✅ onClose()完了');
                } catch (e: any) {
                  log('❌ onClose()エラー: ' + e.message);
                }

                log('🎉 スキャン処理完了');
              } else {
                log('❌ バリデーション失敗: ' + (validation.error || 'unknown'));
                setCameraError(validation.error || '無効なQRコードです');
                setIsScanning(false);
                setShowManualInput(true);
                isStoppingRef.current = false;
              }
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
