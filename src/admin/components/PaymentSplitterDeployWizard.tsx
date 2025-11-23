// src/admin/components/PaymentSplitterDeployWizard.tsx
// PaymentSplitterデプロイウィザード

import { useState } from 'react';
import { useDeployPaymentSplitter } from '../../hooks/usePaymentSplitter';

interface PayeeEntry {
  id: string;
  address: string;
  share: number;
}

interface PaymentSplitterDeployWizardProps {
  onDeploySuccess: (contractAddress: string) => void;
  onCancel: () => void;
  existingAddress?: string; // 既存のPaymentSplitterアドレス
}

export default function PaymentSplitterDeployWizard({
  onDeploySuccess,
  onCancel,
  existingAddress,
}: PaymentSplitterDeployWizardProps) {
  const [payees, setPayees] = useState<PayeeEntry[]>([
    { id: '1', address: '', share: 50 },
    { id: '2', address: '', share: 50 },
  ]);
  const [newPayeeAddress, setNewPayeeAddress] = useState('');
  const [newPayeeShare, setNewPayeeShare] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { deploy, isDeploying } = useDeployPaymentSplitter();

  // 受益者を追加
  const addPayee = () => {
    const trimmedAddress = newPayeeAddress.trim();

    // バリデーション
    if (!trimmedAddress) {
      setError('アドレスを入力してください');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      setError('有効なウォレットアドレスを入力してください (0x... 形式)');
      return;
    }

    if (payees.some((p) => p.address.toLowerCase() === trimmedAddress.toLowerCase())) {
      setError('このアドレスは既に追加されています');
      return;
    }

    if (newPayeeShare <= 0) {
      setError('シェアは1以上の数値を入力してください');
      return;
    }

    // 追加
    setPayees([
      ...payees,
      {
        id: Date.now().toString(),
        address: trimmedAddress,
        share: newPayeeShare,
      },
    ]);

    // リセット
    setNewPayeeAddress('');
    setNewPayeeShare(0);
    setError(null);
  };

  // 受益者を削除
  const removePayee = (id: string) => {
    if (payees.length <= 1) {
      setError('最低1人の受益者が必要です');
      return;
    }

    setPayees(payees.filter((p) => p.id !== id));
    setError(null);
  };

  // シェアを更新
  const updatePayeeShare = (id: string, newShare: number) => {
    if (newShare < 0) return;

    setPayees(
      payees.map((p) => (p.id === id ? { ...p, share: newShare } : p))
    );
  };

  // 総シェア数を計算
  const totalShares = payees.reduce((sum, p) => sum + p.share, 0);

  // シェア%を計算
  const calculatePercentage = (share: number) => {
    if (totalShares === 0) return 0;
    return ((share / totalShares) * 100).toFixed(2);
  };

  // デプロイ実行
  const handleDeploy = async () => {
    setError(null);

    // バリデーション
    const emptyAddresses = payees.filter((p) => !p.address.trim());
    if (emptyAddresses.length > 0) {
      setError('すべての受益者のアドレスを入力してください');
      return;
    }

    const invalidAddresses = payees.filter(
      (p) => !/^0x[a-fA-F0-9]{40}$/.test(p.address.trim())
    );
    if (invalidAddresses.length > 0) {
      setError('無効なアドレスが含まれています');
      return;
    }

    if (totalShares === 0) {
      setError('総シェア数が0です。シェアを設定してください');
      return;
    }

    // 既存のPaymentSplitterチェック
    if (existingAddress && existingAddress !== '0x0000000000000000000000000000000000000000') {
      const replaceConfirmed = window.confirm(
        `⚠️ 既にPaymentSplitterが設定されています\n\n` +
        `現在のアドレス:\n${existingAddress.slice(0, 10)}...${existingAddress.slice(-8)}\n\n` +
        `新しくデプロイすると、このアドレスは上書きされます。\n` +
        `古いコントラクトに収益が残っている場合は、先に分配してください。\n\n` +
        `本当に新しくデプロイしますか？`
      );

      if (!replaceConfirmed) {
        setError('デプロイをキャンセルしました。既存のPaymentSplitterの収益を確認してください。');
        return;
      }
    }

    const confirmed = window.confirm(
      `PaymentSplitterをデプロイしますか？\n\n受益者数: ${payees.length}人\n総シェア: ${totalShares}\n\n※ デプロイ後、受益者とシェアは変更できません`
    );

    if (!confirmed) return;

    try {
      const addresses = payees.map((p) => p.address.trim());
      const shares = payees.map((p) => p.share);

      const contractAddress = await deploy(addresses, shares);

      alert(
        `✅ PaymentSplitterのデプロイに成功しました！\n\nコントラクトアドレス:\n${contractAddress}\n\nテナント設定に自動的に反映されます。`
      );

      onDeploySuccess(contractAddress);
    } catch (err: any) {
      console.error('Deploy failed:', err);
      setError(`デプロイに失敗しました: ${err?.message || err}`);
    }
  };

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
          🚀 PaymentSplitter デプロイ
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          収益分配の受益者とシェアを設定してデプロイします
        </p>
      </div>

      {/* 既存アドレス警告 */}
      {existingAddress && existingAddress !== '0x0000000000000000000000000000000000000000' && (
        <div
          style={{
            padding: 16,
            background: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#ff9800' }}>
            ⚠️ 既存のPaymentSplitterが設定されています
          </h3>
          <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            現在のアドレス: <code style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {existingAddress.slice(0, 10)}...{existingAddress.slice(-8)}
            </code>
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            新しくデプロイすると、このアドレスは上書きされます。古いコントラクトに収益が残っている場合は、先に分配してください。
          </p>
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* 受益者リスト */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>
          📊 受益者リスト（{payees.length}人）
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {payees.map((payee, index) => (
            <div
              key={payee.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 16,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
              }}
            >
              {/* 番号 */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: '#667eea',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {index + 1}
              </div>

              {/* アドレス */}
              <input
                type="text"
                value={payee.address}
                onChange={(e) =>
                  setPayees(
                    payees.map((p) =>
                      p.id === payee.id ? { ...p, address: e.target.value } : p
                    )
                  )
                }
                placeholder="0x..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: 'monospace',
                }}
              />

              {/* シェア */}
              <input
                type="number"
                value={payee.share}
                onChange={(e) => updatePayeeShare(payee.id, parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: 100,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  textAlign: 'right',
                }}
              />

              {/* パーセンテージ */}
              <div
                style={{
                  width: 80,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#10b981',
                  textAlign: 'right',
                }}
              >
                {calculatePercentage(payee.share)}%
              </div>

              {/* 削除ボタン */}
              <button
                onClick={() => removePayee(payee.id)}
                disabled={payees.length <= 1}
                style={{
                  padding: '8px 12px',
                  background: payees.length <= 1 ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  color: payees.length <= 1 ? '#666' : '#ef4444',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: payees.length <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        {/* 総シェア表示 */}
        <div
          style={{
            padding: 16,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 14, color: '#10b981', marginBottom: 4 }}>
            💰 総シェア: <strong>{totalShares}</strong>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(16, 185, 129, 0.7)' }}>
            シェアの数値は比率として使用されます（例: 50, 30, 20 = 50%, 30%, 20%）
          </div>
        </div>
      </div>

      {/* 受益者追加フォーム */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 12px 0' }}>
          ➕ 受益者を追加
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newPayeeAddress}
            onChange={(e) => setNewPayeeAddress(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPayee();
              }
            }}
            placeholder="ウォレットアドレス (0x...)"
            style={{
              flex: 1,
              minWidth: 300,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontFamily: 'monospace',
            }}
          />
          <input
            type="number"
            value={newPayeeShare || ''}
            onChange={(e) => setNewPayeeShare(parseInt(e.target.value) || 0)}
            placeholder="シェア"
            min="1"
            style={{
              width: 120,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
            }}
          />
          <button
            onClick={addPayee}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            追加
          </button>
        </div>
      </div>

      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCancel}
          disabled={isDeploying}
          style={{
            flex: 1,
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: isDeploying ? 'not-allowed' : 'pointer',
          }}
        >
          キャンセル
        </button>
        <button
          onClick={handleDeploy}
          disabled={isDeploying || payees.length === 0 || totalShares === 0}
          style={{
            flex: 1,
            padding: '12px 24px',
            background:
              isDeploying || payees.length === 0 || totalShares === 0
                ? 'rgba(16, 185, 129, 0.3)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor:
              isDeploying || payees.length === 0 || totalShares === 0
                ? 'not-allowed'
                : 'pointer',
            opacity: isDeploying || payees.length === 0 || totalShares === 0 ? 0.6 : 1,
          }}
        >
          {isDeploying ? '🚀 デプロイ中...' : '🚀 デプロイ実行'}
        </button>
      </div>

      {/* 注意事項 */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: 8,
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#ff9800' }}>
          ⚠️ 重要な注意事項
        </h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          <li>デプロイ後、受益者とシェアは変更できません</li>
          <li>ガス代（MATIC）が必要です</li>
          <li>デプロイには数秒〜数分かかる場合があります</li>
          <li>受益者アドレスは必ず正確に入力してください</li>
        </ul>
      </div>
    </div>
  );
}
