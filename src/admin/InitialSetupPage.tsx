// src/admin/InitialSetupPage.tsx
import React, { useState, useEffect } from 'react';

interface TenantConfig {
  paymentSplitterAddress: string;
  tenantName: string;
  tenantDescription: string;
  adminAddresses: string[]; // テナント管理者のウォレットアドレス一覧
}

export default function InitialSetupPage() {
  const [config, setConfig] = useState<TenantConfig>({
    paymentSplitterAddress: '',
    tenantName: '',
    tenantDescription: '',
    adminAddresses: [],
  });

  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ローカルストレージから設定を読み込み
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('gifterra_tenant_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }, []);

  // 設定を保存
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // バリデーション
      if (!config.paymentSplitterAddress || !/^0x[a-fA-F0-9]{40}$/.test(config.paymentSplitterAddress)) {
        throw new Error('有効なPaymentSplitterアドレスを入力してください');
      }

      if (!config.tenantName.trim()) {
        throw new Error('テナント名を入力してください');
      }

      // ローカルストレージに保存
      localStorage.setItem('gifterra_tenant_config', JSON.stringify(config));

      // TODO: 将来的にはSupabaseなどのバックエンドに保存
      // await saveTenantConfig(config);

      setSaveMessage({ type: 'success', text: '設定を保存しました' });

      // 3秒後にメッセージを消す
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '設定の保存に失敗しました'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 管理者アドレスを追加
  const handleAddAdmin = () => {
    const trimmedAddress = newAdminAddress.trim().toLowerCase();

    // バリデーション
    if (!trimmedAddress) {
      setSaveMessage({ type: 'error', text: 'アドレスを入力してください' });
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      setSaveMessage({ type: 'error', text: '有効なウォレットアドレスを入力してください (0x... 形式)' });
      return;
    }

    if (config.adminAddresses.includes(trimmedAddress)) {
      setSaveMessage({ type: 'error', text: 'このアドレスは既に登録されています' });
      return;
    }

    // アドレスを追加
    setConfig({
      ...config,
      adminAddresses: [...config.adminAddresses, trimmedAddress]
    });
    setNewAdminAddress('');
    setSaveMessage({ type: 'success', text: '管理者アドレスを追加しました' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // 管理者アドレスを削除
  const handleRemoveAdmin = (addressToRemove: string) => {
    if (confirm(`管理者アドレス ${addressToRemove} を削除してもよろしいですか？`)) {
      setConfig({
        ...config,
        adminAddresses: config.adminAddresses.filter(addr => addr !== addressToRemove)
      });
      setSaveMessage({ type: 'success', text: '管理者アドレスを削除しました' });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // 設定をリセット
  const handleReset = () => {
    if (confirm('設定をリセットしてもよろしいですか？')) {
      const defaultConfig: TenantConfig = {
        paymentSplitterAddress: '',
        tenantName: '',
        tenantDescription: '',
        adminAddresses: [],
      };
      setConfig(defaultConfig);
      localStorage.removeItem('gifterra_tenant_config');
      setSaveMessage({ type: 'success', text: '設定をリセットしました' });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return (
    <div style={{
      padding: 24,
      maxWidth: 900,
      margin: '0 auto',
      color: '#fff'
    }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span>⚙️</span>
          <span>初期設定</span>
        </h1>
        <p style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.6
        }}>
          テナント運用に必要な基本設定を行います。すべての項目を正確に入力してください。
        </p>
      </div>

      {/* 保存メッセージ */}
      {saveMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 24,
          background: saveMessage.type === 'success'
            ? 'rgba(34, 197, 94, 0.2)'
            : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${saveMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: saveMessage.type === 'success' ? '#86efac' : '#fca5a5',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>{saveMessage.type === 'success' ? '✅' : '❌'}</span>
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* 設定フォーム */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 24,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* テナント基本情報 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>🏢</span>
            <span>テナント基本情報</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* テナント名 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
                color: 'rgba(255,255,255,0.9)'
              }}>
                テナント名 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={config.tenantName}
                onChange={(e) => setConfig({ ...config, tenantName: e.target.value })}
                placeholder="例: カフェ テラス"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>

            {/* テナント説明 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
                color: 'rgba(255,255,255,0.9)'
              }}>
                テナント説明
              </label>
              <textarea
                value={config.tenantDescription}
                onChange={(e) => setConfig({ ...config, tenantDescription: e.target.value })}
                placeholder="テナントの説明や特徴を入力してください"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>
        </section>

        {/* ブロックチェーン設定 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>🔗</span>
            <span>ブロックチェーン設定</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* PaymentSplitter アドレス */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
                color: 'rgba(255,255,255,0.9)'
              }}>
                PaymentSplitter コントラクトアドレス <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={config.paymentSplitterAddress}
                onChange={(e) => setConfig({ ...config, paymentSplitterAddress: e.target.value })}
                placeholder="0x..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
              <p style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                marginTop: 6,
                lineHeight: 1.5
              }}>
                GIFT HUB購入時の収益分配を管理するスマートコントラクトのアドレスです。
              </p>
            </div>
          </div>
        </section>

        {/* 管理者アクセス権限設定 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>👥</span>
            <span>テナント管理者権限</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 説明 */}
            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.6,
              margin: 0
            }}>
              テナントオーナーと同等の管理権限を付与するウォレットアドレスを登録します。
              登録されたアドレスは、このテナントの全コントラクトに対する管理者権限を持ちます。
            </p>

            {/* アドレス追加フォーム */}
            <div style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  テナント管理者ウォレットアドレス
                </label>
                <input
                  type="text"
                  value={newAdminAddress}
                  onChange={(e) => setNewAdminAddress(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAdmin();
                    }
                  }}
                  placeholder="0x..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 14,
                    fontFamily: 'monospace',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={handleAddAdmin}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>➕</span>
                <span>追加</span>
              </button>
            </div>

            {/* 登録済み管理者リスト */}
            {config.adminAddresses.length > 0 && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  登録済みテナント管理者 ({config.adminAddresses.length}件)
                </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  {config.adminAddresses.map((address, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 6,
                        gap: 12
                      }}
                    >
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        <code style={{
                          fontSize: 13,
                          color: '#86efac',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all'
                        }}>
                          {address}
                        </code>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(address)}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #ef4444',
                          borderRadius: 4,
                          color: '#fca5a5',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>❌</span>
                        <span>削除</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 登録がない場合の表示 */}
            {config.adminAddresses.length === 0 && (
              <div style={{
                padding: 16,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 6,
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center'
              }}>
                まだテナント管理者が登録されていません。上記フォームからウォレットアドレスを追加してください。
              </div>
            )}
          </div>
        </section>

        {/* アクションボタン */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={handleReset}
            disabled={isSaving}
            style={{
              padding: '10px 20px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: 6,
              color: '#fca5a5',
              fontSize: 14,
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            リセット
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            {isSaving ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>設定を保存</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 注意事項 */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 8,
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 1.6
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 8
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <strong style={{ fontWeight: 700 }}>重要な注意事項</strong>
        </div>
        <ul style={{
          margin: '8px 0 0 24px',
          paddingLeft: 0,
          listStyle: 'disc'
        }}>
          <li>PaymentSplitterアドレスは一度設定すると変更が困難です。慎重に入力してください。</li>
          <li>現在の設定はブラウザのローカルストレージに保存されます。</li>
          <li>ブラウザのキャッシュをクリアすると設定が失われる可能性があります。</li>
        </ul>
      </div>

      {/* スピナーアニメーション用CSS */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
