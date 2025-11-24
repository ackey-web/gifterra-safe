// src/components/QRScannerCamera.tsx
// カメラベースのQRコードスキャナー (zxing-js版)

import { useState, useEffect, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

interface QRScannerCameraProps {
  onScan: (data: string, debugLogs?: string[]) => void;
  onClose: () => void;
  placeholder?: string;
}

export function QRScannerCamera({ onScan, onClose, placeholder = 'QRコードをスキャンまたはアドレスを入力' }: QRScannerCameraProps) {
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const isMounted = useRef(true);
  const isStoppingRef = useRef(false); // 停止処理中フラグ
  const debugLogsRef = useRef<string[]>([]); // 最新のログ配列を保持
  const lastProcessedQR = useRef<string>(''); // 最後に処理したQRコード
  const lastProcessedTime = useRef<number>(0); // 最後に処理した時刻

  // デバッグログを追加する関数
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    const newLogs = [logMessage, ...debugLogsRef.current].slice(0, 20);
    debugLogsRef.current = newLogs; // refを更新
    setDebugLogs(newLogs); // 状態も更新（UI用）
  };

  // X402形式、ウォレットQR、または通常のアドレスかを判定してバリデーション
  const validateAndProcessScan = (data: string): { isValid: boolean; error?: string } => {
    console.log('🔎 QRScannerCamera - バリデーション開始:', data);

    // まずJSON形式かどうかを確認
    try {
      const parsed = JSON.parse(data);
      console.log('📋 JSONパース成功:', parsed);

      // ウォレットQR形式（type: 'wallet'）をチェック
      if (parsed.type === 'wallet' && parsed.address && parsed.chainId) {
        console.log('✅ ウォレットQR形式として認識');
        return { isValid: true };
      }

      // X402形式（請求書QR）の必須フィールドをチェック
      if (parsed.to && parsed.token && parsed.amount) {
        console.log('✅ X402形式として認識');
        return { isValid: true };
      }

      console.log('⚠️ 認識できるJSON形式ではない:', parsed);
    } catch (e) {
      console.log('⚠️ JSONパースエラー - ウォレットアドレスかチェック');
      // JSONパースエラー - 通常のウォレットアドレスかもしれない
    }

    // 通常のウォレットアドレス形式をチェック (0xで始まる42文字の16進数)
    if (/^0x[a-fA-F0-9]{40}$/.test(data)) {
      console.log('✅ ウォレットアドレスとして認識');
      return { isValid: true };
    }

    // ethereum: プレフィックス形式もサポート
    if (data.startsWith('ethereum:')) {
      console.log('✅ Ethereum URI形式として認識');
      return { isValid: true };
    }

    console.log('❌ バリデーション失敗');
    return { isValid: false, error: '無効なQRコードです。ウォレットQR、X402決済コード、またはウォレットアドレスを使用してください。' };
  };

  // カメラスキャナーの初期化
  useEffect(() => {
    isMounted.current = true;

    const initScanner = async () => {
      try {
        addDebugLog('📷 ZXing QRスキャナー初期化中...');
        addDebugLog(`🌐 User Agent: ${navigator.userAgent.substring(0, 80)}...`);
        addDebugLog(`📱 Platform: ${navigator.platform}`);

        const codeReader = new BrowserQRCodeReader();
        readerRef.current = codeReader;

        // ビデオデバイスを取得
        const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices();
        addDebugLog(`📷 利用可能なカメラ数: ${videoInputDevices.length}`);

        if (videoInputDevices.length === 0) {
          throw new Error('カメラが見つかりません');
        }

        // 背面カメラを優先的に選択
        const selectedDevice = videoInputDevices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        ) || videoInputDevices[0];

        addDebugLog(`📷 使用するカメラ: ${selectedDevice.label}`);

        // QRコード読み取り開始
        if (videoRef.current) {
          codeReader.decodeFromVideoDevice(
            selectedDevice.deviceId,
            videoRef.current,
            (result, error) => {
              if (result) {
                // 二重呼び出し防止 - 最初にチェック
                if (isStoppingRef.current) {
                  return; // ログも出さずに即座にreturn
                }

                const decodedText = result.getText();
                const now = Date.now();

                // 同じQRコードを1秒以内に処理しない（デバウンス）
                if (
                  lastProcessedQR.current === decodedText &&
                  now - lastProcessedTime.current < 1000
                ) {
                  addDebugLog('⏭️ デバウンス: 同じQRを1秒以内に検出、スキップ');
                  return;
                }

                // 即座にフラグを立てる
                isStoppingRef.current = true;
                lastProcessedQR.current = decodedText;
                lastProcessedTime.current = now;

                addDebugLog(`📸 QRコード読み取り成功: ${decodedText.substring(0, 50)}...`);

                if (isMounted.current) {

                  // バリデーション処理
                  const validation = validateAndProcessScan(decodedText);

                  if (validation.isValid) {
                    addDebugLog('✅ バリデーション成功 - スキャナー停止処理開始');

                    // スキャナーを停止してコールバック実行
                    const stopAndCallback = async () => {
                      try {
                        if (readerRef.current) {
                          // ZXingのBrowserQRCodeReaderはreset()メソッドを持たないため、
                          // 単にrefをnullにしてクリーンアップ
                          readerRef.current = null;
                          console.log('✅ ZXing スキャナー停止成功');
                        }
                      } catch (e: any) {
                        console.error('❌ スキャナー停止エラー:', e.message);
                      }

                      // コールバックを実行（親の状態を更新）
                      try {
                        console.log('✅ コールバック実行:', decodedText.substring(0, 50));
                        addDebugLog('✅ コールバック実行 - 親コンポーネントに送信');
                        // 最新のログ配列（ref）を渡す
                        onScan(decodedText, debugLogsRef.current);
                      } catch (e: any) {
                        console.error('❌ QRスキャンコールバックエラー:', e.message);
                      }

                      // クローズ
                      try {
                        onClose();
                      } catch (e: any) {
                        console.error('❌ QRスキャナークローズエラー:', e.message);
                      }
                    };

                    stopAndCallback();
                  } else {
                    addDebugLog(`❌ バリデーション失敗: ${validation.error}`);
                    setCameraError(validation.error || '無効なQRコードです');
                    setIsScanning(false);
                    setShowManualInput(true);
                    isStoppingRef.current = false;
                  }
                }
              }

              // エラーは頻繁に発生するので通常は無視
              if (error && !error.message?.includes('NotFoundException')) {
                addDebugLog(`⚠️ ZXing スキャンエラー: ${error.message}`);
              }
            }
          );

          addDebugLog('✅ ZXing カメラ起動成功');
        }
      } catch (err: any) {
        addDebugLog(`❌ ZXing カメラ初期化エラー: ${err.message}`);
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
      if (readerRef.current) {
        try {
          // ZXingのBrowserQRCodeReaderはreset()メソッドを持たない
          readerRef.current = null;
          console.log('クリーンアップ: ZXing スキャナー停止');
        } catch (e) {
          console.log('クリーンアップエラー（無視）');
        }
      }
    };
  }, []);

  // 手動入力の送信
  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();

    if (!trimmed) {
      setError('アドレスまたは決済コードを入力してください');
      return;
    }

    const validation = validateAndProcessScan(trimmed);
    if (!validation.isValid) {
      setError(validation.error || '無効な入力です');
      return;
    }

    addDebugLog('✅ 手動入力完了 - 親コンポーネントに送信');
    // 最新のログ配列（ref）を渡す
    onScan(trimmed, debugLogsRef.current);
    onClose();
  };

  // 手動入力モードに切り替え
  const switchToManualInput = () => {
    if (readerRef.current) {
      // ZXingのBrowserQRCodeReaderはreset()メソッドを持たない
      readerRef.current = null;
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

        {/* デバッグパネル */}
        {showDebugPanel && debugLogs.length > 0 && (
          <div style={{
            background: '#1a1a1a',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            maxHeight: 200,
            overflow: 'auto',
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#00ff00',
            position: 'relative',
          }}>
            <button
              onClick={() => setShowDebugPanel(false)}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: '#333',
                border: 'none',
                color: '#fff',
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              非表示
            </button>
            <div style={{ marginTop: 24 }}>
              {debugLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: 4, lineHeight: 1.4 }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* デバッグパネル表示ボタン（非表示時） */}
        {!showDebugPanel && debugLogs.length > 0 && (
          <button
            onClick={() => setShowDebugPanel(true)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: '#00ff00',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 16,
              fontFamily: 'monospace',
            }}
          >
            🔍 デバッグログを表示 ({debugLogs.length}件)
          </button>
        )}

        {/* カメラスキャナー */}
        {isScanning && (
          <>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxWidth: '400px',
                height: 'auto',
                borderRadius: 12,
                marginBottom: 16,
                display: 'block',
                margin: '0 auto 16px auto',
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
