// src/components/WalletExportModal.tsx
// ウォレット秘密鍵エクスポートモーダル

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePrivy } from '@privy-io/react-auth';

interface WalletExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export function WalletExportModal({ isOpen, onClose, isMobile }: WalletExportModalProps) {
  const { exportWallet, user, authenticated, setWalletRecovery } = usePrivy();
  const [isExporting, setIsExporting] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isSettingRecovery, setIsSettingRecovery] = useState(false);

  if (!isOpen) return null;

  const handleExportWallet = async () => {
    if (!hasConfirmed) {
      alert('⚠️ 注意事項を確認して、チェックボックスにチェックを入れてください。');
      return;
    }

    if (!authenticated) {
      alert('❌ 認証されていません。再度ログインしてください。');
      return;
    }

    if (!user?.wallet) {
      alert('❌ ウォレット情報が見つかりません。');
      return;
    }

    setIsExporting(true);
    try {
      // ウォレットのアドレスを指定してエクスポート
      const walletAddress = user.wallet.address;
      console.log('🔑 Exporting wallet:', walletAddress);

      await exportWallet({
        address: walletAddress,
      });

      alert('✅ 秘密鍵がダウンロードされました。\n\n安全な場所に保管してください。誰にも共有しないでください。');
      onClose();
    } catch (error) {
      console.error('エクスポートエラー:', error);

      // エラーメッセージをより詳細に表示
      let errorMessage = '❌ ウォレットのエクスポートに失敗しました。\n\n';

      if (error instanceof Error) {
        if (error.message.includes('MFA')) {
          errorMessage += '多要素認証(MFA)が必要です。Privyの設定でMFAを有効にしてから再度お試しください。';
        } else if (error.message.includes('access token')) {
          errorMessage += 'アクセストークンが無効です。一度ログアウトして再度ログインしてください。';
        } else {
          errorMessage += 'エラー詳細: ' + error.message;
        }
      } else {
        errorMessage += 'エラー詳細: ' + String(error);
      }

      alert(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  // Privyの埋め込みウォレットかどうかを判定
  // walletClientTypeが'privy'の場合のみPrivy埋め込みウォレットと判定
  const isPrivyEmbeddedWallet = user?.wallet && user.wallet.walletClientType === 'privy';

  // デバッグ用：ウォレット情報をコンソールに出力
  console.log('🔍 Wallet Debug Info:', {
    hasWallet: !!user?.wallet,
    walletClientType: user?.wallet?.walletClientType,
    connectorType: user?.wallet?.connectorType,
    isPrivyEmbeddedWallet,
    walletAddress: user?.wallet?.address,
  });

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
          borderRadius: isMobile ? 16 : 24,
          maxWidth: isMobile ? '100%' : 500,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '2px solid rgba(251, 191, 36, 0.3)',
          boxShadow: '0 20px 60px rgba(251, 191, 36, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? 20 : 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🔑</span>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? 18 : 20,
                fontWeight: 700,
                color: '#FCD34D',
              }}
            >
              秘密鍵のエクスポート
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{ padding: isMobile ? 20 : 24 }}>
          {!isPrivyEmbeddedWallet ? (
            /* 外部ウォレット接続の場合 */
            <div
              style={{
                padding: 20,
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#93C5FD',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ℹ️ 外部ウォレット接続中
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.6,
                }}
              >
                MetaMaskなどの外部ウォレットで接続している場合、秘密鍵はそれぞれのウォレットアプリで管理されています。
                <br /><br />
                秘密鍵の確認・バックアップは、お使いのウォレットアプリから行ってください。
              </div>
            </div>
          ) : showWarning ? (
            /* 警告画面 */
            <>
              <div
                style={{
                  padding: 20,
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#93C5FD',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  ℹ️ 秘密鍵エクスポートについて
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: 1.7,
                  }}
                >
                  <p style={{ margin: '0 0 12px 0' }}>
                    Privy埋め込みウォレットの秘密鍵をエクスポートするには、アカウントに<strong>パスワードまたは多要素認証(MFA)</strong>を設定する必要があります。
                  </p>

                  <div
                    style={{
                      padding: 16,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '2px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#FCA5A5', marginBottom: 8 }}>
                      ⚠️ 重要：初回ログイン時の設定が必要です
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6 }}>
                      Privyのセキュリティ設定は<strong>ログイン時のみ</strong>設定可能です。<br />
                      既にログイン済みの場合、一度ログアウトして再ログインする必要があります。
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>📱 設定手順：</strong>
                  </p>
                  <div
                    style={{
                      padding: 16,
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 8,
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>1️⃣ 設定メニューからログアウト</p>
                    <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                      右上の⚙️設定メニューから「ログアウト」を選択
                    </p>

                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>2️⃣ 再度ログインして、セキュリティ設定を追加</p>
                    <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                      ログイン時にPrivy画面が表示されたら、以下のオプションから選択：
                    </p>
                    <div style={{
                      padding: '8px 12px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderLeft: '3px solid rgba(59, 130, 246, 0.5)',
                      marginBottom: 12,
                      fontSize: 12,
                    }}>
                      <div style={{ marginBottom: 4 }}>
                        <strong style={{ color: '#93C5FD' }}>「Set up a password」</strong>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}> = パスワードを設定する（推奨）</span>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong style={{ color: '#93C5FD' }}>「Connect a passkey」</strong>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}> = パスキーで接続する</span>
                      </div>
                      <div>
                        <strong style={{ color: '#93C5FD' }}>「Enable MFA」</strong>
                        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}> = 多要素認証を有効化</span>
                      </div>
                    </div>

                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>3️⃣ 設定完了後、再度秘密鍵をエクスポート</p>
                    <p style={{ margin: '0', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                      ログイン後、設定メニューから再度「秘密鍵をエクスポート」を選択
                    </p>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    💡 <strong>ヒント：</strong> ログイン時にPrivyのダイアログで「Set up a password」を選ぶのが最も簡単です。パスワードを入力するだけで完了します。
                  </div>

                  {/* パスワード設定ボタン */}
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSettingRecovery(true);
                      try {
                        await setWalletRecovery();
                        alert('✅ パスワード設定が完了しました。\n再度「秘密鍵をエクスポート」を実行してください。');
                      } catch (error) {
                        console.error('リカバリー設定エラー:', error);
                        if (error instanceof Error && error.message.includes('User exited')) {
                          // ユーザーがキャンセルした場合は何もしない
                        } else {
                          alert('❌ パスワード設定に失敗しました。\n一度ログアウトして再ログインしてください。');
                        }
                      } finally {
                        setIsSettingRecovery(false);
                      }
                    }}
                    disabled={isSettingRecovery}
                    style={{
                      width: '100%',
                      padding: 14,
                      background: isSettingRecovery ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                      border: '2px solid rgba(59, 130, 246, 0.5)',
                      borderRadius: 12,
                      color: '#93C5FD',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: isSettingRecovery ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSettingRecovery) {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSettingRecovery) {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                      }
                    }}
                  >
                    {isSettingRecovery ? '⏳ 設定中...' : '🔐 今すぐパスワード設定する（推奨）'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: 20,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '2px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#FCA5A5',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  ⚠️ 重要な警告
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: 1.7,
                  }}
                >
                  <p style={{ margin: '0 0 12px 0' }}>
                    秘密鍵は、ウォレットにアクセスするための最も重要な情報です。以下の点に十分注意してください。
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li style={{ marginBottom: 8 }}>
                      <strong>誰にも共有しないでください</strong> - サポートスタッフも秘密鍵を聞くことはありません
                    </li>
                    <li style={{ marginBottom: 8 }}>
                      <strong>安全な場所に保管してください</strong> - 紙に書いて保管するか、パスワードマネージャーを使用
                    </li>
                    <li style={{ marginBottom: 8 }}>
                      <strong>紛失すると資金を失います</strong> - 秘密鍵を紛失すると、誰も復旧できません
                    </li>
                    <li style={{ marginBottom: 8 }}>
                      <strong>スクリーンショットは危険</strong> - クラウドに自動アップロードされる可能性があります
                    </li>
                  </ul>
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: '#FCD34D' }}>💡 推奨事項</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                    <li style={{ marginBottom: 4 }}>
                      エクスポート前に、周囲に人がいないか確認してください
                    </li>
                    <li style={{ marginBottom: 4 }}>
                      安全なオフライン環境で保管してください
                    </li>
                    <li>
                      外部ウォレット（MetaMaskなど）へのインポートは慎重に行ってください
                    </li>
                  </ul>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  marginBottom: 20,
                  cursor: 'pointer',
                }}
                onClick={() => setHasConfirmed(!hasConfirmed)}
              >
                <input
                  type="checkbox"
                  checked={hasConfirmed}
                  onChange={(e) => setHasConfirmed(e.target.checked)}
                  style={{
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                    marginTop: 2,
                  }}
                />
                <label
                  style={{
                    fontSize: 14,
                    color: '#EAF2FF',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  上記の注意事項を理解し、安全に秘密鍵を管理することを約束します
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: isMobile ? 14 : 16,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    color: '#EAF2FF',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => setShowWarning(false)}
                  disabled={!hasConfirmed}
                  style={{
                    flex: 1,
                    padding: isMobile ? 14 : 16,
                    background: hasConfirmed
                      ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                      : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: 12,
                    color: hasConfirmed ? '#FFF' : 'rgba(255, 255, 255, 0.3)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: hasConfirmed ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: hasConfirmed ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => {
                    if (hasConfirmed) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(251, 191, 36, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasConfirmed) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  次へ →
                </button>
              </div>
            </>
          ) : (
            /* エクスポート実行画面 */
            <>
              <div
                style={{
                  padding: 20,
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: 12,
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#FCD34D',
                    marginBottom: 8,
                  }}
                >
                  秘密鍵をエクスポートします
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: 1.6,
                  }}
                >
                  以下のボタンをクリックすると、Privyのセキュアなプロセスを通じて秘密鍵がダウンロードされます。
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: '#93C5FD' }}>📝 エクスポート後の使い方</strong>
                  <br /><br />
                  ダウンロードされた秘密鍵は、MetaMaskなどの外部ウォレットにインポートできます。
                  <br /><br />
                  これにより、GIFTERRAが利用できない場合でも、資金にアクセスできるようになります。
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowWarning(true)}
                  style={{
                    flex: 1,
                    padding: isMobile ? 14 : 16,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    color: '#EAF2FF',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  ← 戻る
                </button>
                <button
                  onClick={handleExportWallet}
                  disabled={isExporting}
                  style={{
                    flex: 1,
                    padding: isMobile ? 14 : 16,
                    background: isExporting
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    border: 'none',
                    borderRadius: 12,
                    color: '#FFF',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: isExporting ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isExporting) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(251, 191, 36, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExporting) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {isExporting ? '処理中...' : '🔑 秘密鍵をエクスポート'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
