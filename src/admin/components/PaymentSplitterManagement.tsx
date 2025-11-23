// src/admin/components/PaymentSplitterManagement.tsx
// PaymentSplitter（収益分配）管理コンポーネント

import { useEffect, useState } from 'react';
import {
  usePaymentSplitterStats,
  usePaymentSplitterVersion,
  usePaymentSplitterPayees,
  useReleaseAll,
  useRelease,
  usePausePaymentSplitter,
} from '../../hooks/usePaymentSplitter';

interface PaymentSplitterManagementProps {
  contractAddress: string;
}

export default function PaymentSplitterManagement({ contractAddress }: PaymentSplitterManagementProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // データ取得
  const { stats, isLoading: statsLoading } = usePaymentSplitterStats(contractAddress);
  const { version, isLoading: versionLoading } = usePaymentSplitterVersion(contractAddress);
  const { payees, isLoading: payeesLoading, loadPayees } = usePaymentSplitterPayees(contractAddress);

  // 操作フック
  const { releaseAll, isLoading: isReleasingAll } = useReleaseAll(contractAddress);
  const { release, isLoading: isReleasing } = useRelease(contractAddress);
  const { pause, unpause, isPausing, isUnpausing } = usePausePaymentSplitter(contractAddress);

  // 初回ロード
  useEffect(() => {
    if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
      loadPayees();
    }
  }, [contractAddress, refreshTrigger]);

  // 全員に分配
  const handleReleaseAll = async () => {
    const confirmed = window.confirm(
      `全受益者に収益を分配しますか？\n\n総額: ${stats?.nativeBalance} MATIC\n受益者数: ${stats?.payeeCount}人\n\n※ シェア比率に応じて自動的に振り分けられます`
    );
    if (!confirmed) return;

    try {
      await releaseAll();
      alert('✅ 収益を全員に分配しました！\n\nブロックチェーンで処理が完了するまでお待ちください。');
      setTimeout(() => setRefreshTrigger((prev) => prev + 1), 3000);
    } catch (error: any) {
      console.error('Failed to release all:', error);
      alert(`❌ 分配に失敗しました\n\n${error?.message || error}`);
    }
  };

  // 個別分配
  const handleRelease = async (payeeAddress: string, releasableAmount: string) => {
    const confirmed = window.confirm(
      `この受益者に収益を分配しますか？\n\nアドレス: ${payeeAddress.slice(0, 10)}...\n分配額: ${releasableAmount} MATIC`
    );
    if (!confirmed) return;

    try {
      await release(payeeAddress);
      alert('✅ 収益を分配しました！');
      setTimeout(() => setRefreshTrigger((prev) => prev + 1), 3000);
    } catch (error: any) {
      console.error('Failed to release:', error);
      alert(`❌ 分配に失敗しました\n\n${error?.message || error}`);
    }
  };

  // 一時停止/再開
  const handlePauseToggle = async () => {
    if (!stats) return;

    const action = stats.isPaused ? 'unpause' : 'pause';
    const actionText = stats.isPaused ? '再開' : '一時停止';

    const confirmed = window.confirm(
      `PaymentSplitterを${actionText}しますか？\n\n${
        stats.isPaused
          ? '再開すると、寄付の受け付けが可能になります。'
          : '一時停止すると、寄付の受け付けができなくなります。'
      }`
    );
    if (!confirmed) return;

    try {
      if (stats.isPaused) {
        await unpause();
      } else {
        await pause();
      }
      alert(`✅ PaymentSplitterを${actionText}しました！`);
      setTimeout(() => setRefreshTrigger((prev) => prev + 1), 2000);
    } catch (error: any) {
      console.error('Failed to toggle pause:', error);
      alert(`❌ ${actionText}に失敗しました\n\n${error?.message || error}`);
    }
  };

  // コントラクトアドレスが未設定の場合
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <div
        style={{
          padding: 32,
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: 12,
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', color: '#ff9800', fontSize: 18, fontWeight: 700 }}>
          ⚠️ PaymentSplitter未設定
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
          テナント設定でPaymentSplitterコントラクトアドレスを設定してください。
        </p>
      </div>
    );
  }

  // ローディング中
  if (statsLoading || versionLoading || payeesLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: '0 auto 16px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>読み込み中...</p>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
          💰 収益分配管理
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          PaymentSplitter: {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
        </p>
        {version && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0' }}>
            {version}
          </p>
        )}
      </div>

      {/* 統計サマリー */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* プール残高 */}
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>プール残高</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.nativeBalance} MATIC</div>
          </div>

          {/* 累計分配額 */}
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>累計分配額</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.totalNativeReleased} MATIC</div>
          </div>

          {/* 受益者数 */}
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>受益者数</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.payeeCount}人</div>
          </div>

          {/* ステータス */}
          <div
            style={{
              padding: 20,
              background: stats.isPaused
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: 12,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>ステータス</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {stats.isPaused ? '⏸️ 停止中' : '✅ 稼働中'}
            </div>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <button
          onClick={handleReleaseAll}
          disabled={isReleasingAll || !stats || parseFloat(stats.nativeBalance) === 0}
          style={{
            padding: '12px 24px',
            background:
              isReleasingAll || !stats || parseFloat(stats.nativeBalance) === 0
                ? 'rgba(16, 185, 129, 0.3)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor:
              isReleasingAll || !stats || parseFloat(stats.nativeBalance) === 0
                ? 'not-allowed'
                : 'pointer',
            opacity: isReleasingAll || !stats || parseFloat(stats.nativeBalance) === 0 ? 0.6 : 1,
          }}
        >
          {isReleasingAll ? '分配中...' : '💸 全員に分配'}
        </button>

        <button
          onClick={handlePauseToggle}
          disabled={isPausing || isUnpausing}
          style={{
            padding: '12px 24px',
            background:
              isPausing || isUnpausing
                ? 'rgba(239, 68, 68, 0.3)'
                : stats?.isPaused
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: isPausing || isUnpausing ? 'not-allowed' : 'pointer',
            opacity: isPausing || isUnpausing ? 0.6 : 1,
          }}
        >
          {isPausing || isUnpausing
            ? '処理中...'
            : stats?.isPaused
            ? '▶️ 再開'
            : '⏸️ 一時停止'}
        </button>

        <button
          onClick={() => setRefreshTrigger((prev) => prev + 1)}
          style={{
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔄 更新
        </button>
      </div>

      {/* 受益者リスト */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>
          📊 受益者リスト
        </h3>
        {payees.length === 0 ? (
          <div
            style={{
              padding: 32,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              受益者情報を読み込めませんでした
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <th
                    style={{
                      padding: 16,
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#fff',
                      fontSize: 13,
                    }}
                  >
                    アドレス
                  </th>
                  <th
                    style={{
                      padding: 16,
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#fff',
                      fontSize: 13,
                    }}
                  >
                    シェア
                  </th>
                  <th
                    style={{
                      padding: 16,
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#fff',
                      fontSize: 13,
                    }}
                  >
                    分配済み
                  </th>
                  <th
                    style={{
                      padding: 16,
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#fff',
                      fontSize: 13,
                    }}
                  >
                    分配可能額
                  </th>
                  <th
                    style={{
                      padding: 16,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: '#fff',
                      fontSize: 13,
                    }}
                  >
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody>
                {payees.map((payee, idx) => (
                  <tr
                    key={payee.address}
                    style={{
                      borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <td style={{ padding: 16, fontFamily: 'monospace', fontSize: 13 }}>
                      {payee.address.slice(0, 10)}...{payee.address.slice(-8)}
                    </td>
                    <td style={{ padding: 16, textAlign: 'right', fontSize: 14 }}>
                      {payee.shares} ({payee.sharePercentage.toFixed(2)}%)
                    </td>
                    <td
                      style={{
                        padding: 16,
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {payee.releasedNative} MATIC
                    </td>
                    <td
                      style={{
                        padding: 16,
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#10b981',
                      }}
                    >
                      {payee.releasableNative} MATIC
                    </td>
                    <td style={{ padding: 16, textAlign: 'center' }}>
                      <button
                        onClick={() => handleRelease(payee.address, payee.releasableNative)}
                        disabled={isReleasing || parseFloat(payee.releasableNative) === 0}
                        style={{
                          padding: '6px 12px',
                          background:
                            parseFloat(payee.releasableNative) === 0
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 6,
                          color: parseFloat(payee.releasableNative) === 0 ? '#666' : '#10b981',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor:
                            isReleasing || parseFloat(payee.releasableNative) === 0
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {isReleasing ? '処理中...' : '分配'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
