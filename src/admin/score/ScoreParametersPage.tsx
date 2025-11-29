/**
 * @file スコアパラメータ管理ページ（改善版）
 * @description Admin用：二軸スコアシステムのパラメータを直感的に管理
 */

import React, { useState, useEffect } from 'react';

// ========================================
// 型定義
// ========================================

type Curve = 'Linear' | 'Sqrt' | 'Log';
type BalanceMode = 'simple' | 'custom';

interface ScoreParams {
  weightEconomic: number;
  weightResonance: number;
  curve: Curve;
  lastUpdated: string;
}

interface ParamsHistory {
  id: string;
  weightEconomic: number;
  weightResonance: number;
  curve: Curve;
  updatedAt: string;
  updatedBy: string;
}

// ========================================
// メインコンポーネント
// ========================================

export const ScoreParametersPage: React.FC = () => {
  const [params, setParams] = useState<ScoreParams>({
    weightEconomic: 100,
    weightResonance: 100,
    curve: 'Sqrt',
    lastUpdated: new Date().toISOString(),
  });

  const [editParams, setEditParams] = useState<ScoreParams>(params);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<ParamsHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 新機能：バランスモード切り替え
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('simple');

  // シンプルモード用のバランス値（-100〜100）
  // -100: JPYC重視、0: 均等、100: 応援重視
  const [simpleBalance, setSimpleBalance] = useState(0);

  // パラメータ取得
  useEffect(() => {
    fetchParams();
    fetchHistory();
  }, []);

  const fetchParams = async () => {
    try {
      // TODO: 実際のAPIエンドポイントから取得
      console.log('Fetching current params...');
    } catch (error) {
      console.error('Failed to fetch params:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      // TODO: 実際のAPIから履歴取得
      // モックデータ
      setHistory([
        {
          id: '1',
          weightEconomic: 100,
          weightResonance: 100,
          curve: 'Sqrt',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Admin',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  // シンプルバランススライダーが変更されたとき
  const handleSimpleBalanceChange = (value: number) => {
    setSimpleBalance(value);

    // バランス値から重みを計算
    // -100（JPYC重視）→ Economic: 200, Resonance: 50
    // 0（均等）→ Economic: 100, Resonance: 100
    // 100（応援重視）→ Economic: 50, Resonance: 200

    const economicWeight = Math.round(100 - (value * 0.5));
    const resonanceWeight = Math.round(100 + (value * 0.5));

    setEditParams({
      ...editParams,
      weightEconomic: economicWeight,
      weightResonance: resonanceWeight,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/params', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ADMIN_API_KEY || '',
        },
        body: JSON.stringify(editParams),
      });

      if (response.ok) {
        setParams(editParams);
        setIsEditing(false);
        await fetchHistory();
        alert('✅ パラメータを更新しました\n\n⚠️ 全ユーザーのkodomi値が再計算されます。');
      } else {
        throw new Error('Failed to update params');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('❌ 更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditParams(params);
    setIsEditing(false);
    setSimpleBalance(0);
  };

  const hasChanges =
    editParams.weightEconomic !== params.weightEconomic ||
    editParams.weightResonance !== params.weightResonance ||
    editParams.curve !== params.curve;

  // バランス状態を表示用の文字列に変換
  const getBalanceLabel = () => {
    if (simpleBalance < -50) return 'JPYC重視';
    if (simpleBalance < -20) return 'JPYC やや重視';
    if (simpleBalance > 50) return '応援熱量重視';
    if (simpleBalance > 20) return '応援熱量 やや重視';
    return 'バランス均等';
  };

  const getBalanceColor = () => {
    if (simpleBalance < -20) return '#4a9eff'; // JPYC blue
    if (simpleBalance > 20) return '#ff7e33'; // Resonance orange
    return '#8b5cf6'; // Balanced purple
  };

  return (
    <div className="score-params-page">
      <style jsx>{`
        .score-params-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        /* ヘッダー */
        .page-header {
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 28px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .page-description {
          font-size: 14px;
          color: #718096;
        }

        /* カード */
        .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-bottom: 24px;
        }

        .card-title {
          font-size: 20px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* 現在の設定 */
        .current-params {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .param-display {
          padding: 20px;
          background: linear-gradient(135deg, #667eea22, #764ba222);
          border-radius: 12px;
          text-align: center;
        }

        .param-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .param-value {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
          margin-bottom: 4px;
        }

        .param-unit {
          font-size: 14px;
          color: #4a5568;
        }

        /* モード切り替えタブ */
        .mode-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 2px solid #e2e8f0;
        }

        .mode-tab {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 14px;
          font-weight: 600;
          color: #718096;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: -2px;
        }

        .mode-tab:hover {
          color: #667eea;
        }

        .mode-tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }

        /* シンプルバランススライダー */
        .balance-slider-container {
          padding: 32px;
          background: linear-gradient(135deg, rgba(74, 158, 255, 0.05), rgba(255, 126, 51, 0.05));
          border-radius: 16px;
          margin-bottom: 24px;
        }

        .balance-label-main {
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #2d3748;
        }

        .balance-status {
          text-align: center;
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 24px;
          transition: color 0.3s ease;
        }

        .balance-slider-wrapper {
          position: relative;
          padding: 20px 0;
        }

        .balance-slider {
          width: 100%;
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(90deg, #4a9eff 0%, #8b5cf6 50%, #ff7e33 100%);
          outline: none;
          -webkit-appearance: none;
          position: relative;
        }

        .balance-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 4px currentColor;
          transition: all 0.2s ease;
        }

        .balance-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .balance-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 4px currentColor;
          transition: all 0.2s ease;
        }

        .balance-markers {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 12px;
          color: #718096;
        }

        .balance-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .balance-marker-icon {
          font-size: 20px;
        }

        /* 詳細プレビュー */
        .balance-preview {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 2px solid rgba(0, 0, 0, 0.05);
        }

        .balance-preview-item {
          text-align: center;
          padding: 16px;
          background: white;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
        }

        .balance-preview-label {
          font-size: 11px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .balance-preview-value {
          font-size: 20px;
          font-weight: 700;
        }

        /* 編集フォーム */
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 600;
          color: #2d3748;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .form-help {
          font-size: 12px;
          color: #718096;
          margin-left: 4px;
        }

        .range-input {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #e2e8f0;
          outline: none;
          -webkit-appearance: none;
        }

        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #667eea;
          cursor: pointer;
        }

        .range-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #667eea;
          cursor: pointer;
          border: none;
        }

        .range-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }

        .range-value {
          font-size: 18px;
          font-weight: bold;
          color: #667eea;
        }

        /* ボタン */
        .button-group {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .button-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .button-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .button-secondary {
          background: white;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .button-secondary:hover {
          background: #f7fafc;
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* 履歴 */
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-item {
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .history-params {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #4a5568;
        }

        .history-meta {
          font-size: 12px;
          color: #718096;
          text-align: right;
        }

        /* 警告 */
        .warning-box {
          padding: 16px;
          background: #fff5f5;
          border: 2px solid #fc8181;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .warning-title {
          font-size: 14px;
          font-weight: 600;
          color: #c53030;
          margin-bottom: 8px;
        }

        .warning-text {
          font-size: 12px;
          color: #742a2a;
        }

        /* モバイル対応 */
        @media (max-width: 768px) {
          .current-params {
            grid-template-columns: 1fr;
          }

          .balance-preview {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ヘッダー */}
      <div className="page-header">
        <h1 className="page-title">⚖️ kodomi判定バランス管理</h1>
        <p className="page-description">
          JPYCと応援熱量の評価バランスを調整します
        </p>
      </div>

      {/* 現在の設定 */}
      <div className="card">
        <h2 className="card-title">
          ⚙️ 現在の設定
        </h2>

        <div className="current-params">
          <div className="param-display">
            <div className="param-label">💸 JPYC貢献の重み</div>
            <div className="param-value">{params.weightEconomic}</div>
            <div className="param-unit">{(params.weightEconomic / 100).toFixed(1)}倍</div>
          </div>

          <div className="param-display">
            <div className="param-label">⚡ 応援熱量の重み</div>
            <div className="param-value">{params.weightResonance}</div>
            <div className="param-unit">{(params.weightResonance / 100).toFixed(1)}倍</div>
          </div>
        </div>

        {!isEditing ? (
          <div className="button-group">
            <button className="button button-primary" onClick={() => setIsEditing(true)}>
              ✏️ バランスを調整する
            </button>
          </div>
        ) : (
          <>
            {/* 警告 */}
            <div className="warning-box">
              <div className="warning-title">⚠️ 重要な注意事項</div>
              <div className="warning-text">
                バランスを変更すると、全ユーザーのkodomi値が再計算されます。<br />
                ランキングが大きく変動する可能性があるため、慎重に変更してください。
              </div>
            </div>

            {/* モード切り替えタブ */}
            <div className="mode-tabs">
              <button
                className={`mode-tab ${balanceMode === 'simple' ? 'active' : ''}`}
                onClick={() => setBalanceMode('simple')}
              >
                🎯 シンプル設定
              </button>
              <button
                className={`mode-tab ${balanceMode === 'custom' ? 'active' : ''}`}
                onClick={() => setBalanceMode('custom')}
              >
                🔧 カスタム設定
              </button>
            </div>

            {/* シンプルモード */}
            {balanceMode === 'simple' && (
              <div className="balance-slider-container">
                <div className="balance-label-main">
                  📊 評価バランス
                </div>
                <div className="balance-status" style={{ color: getBalanceColor() }}>
                  {getBalanceLabel()}
                </div>

                <div className="balance-slider-wrapper">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="10"
                    value={simpleBalance}
                    onChange={(e) => handleSimpleBalanceChange(parseInt(e.target.value))}
                    className="balance-slider"
                    style={{ color: getBalanceColor() }}
                  />
                </div>

                <div className="balance-markers">
                  <div className="balance-marker">
                    <div className="balance-marker-icon">💸</div>
                    <div>JPYC重視</div>
                  </div>
                  <div className="balance-marker">
                    <div className="balance-marker-icon">⚖️</div>
                    <div>バランス</div>
                  </div>
                  <div className="balance-marker">
                    <div className="balance-marker-icon">⚡</div>
                    <div>応援重視</div>
                  </div>
                </div>

                {/* 詳細プレビュー */}
                <div className="balance-preview">
                  <div className="balance-preview-item">
                    <div className="balance-preview-label">💸 JPYC貢献</div>
                    <div className="balance-preview-value" style={{ color: '#4a9eff' }}>
                      {editParams.weightEconomic} ({(editParams.weightEconomic / 100).toFixed(1)}倍)
                    </div>
                  </div>
                  <div className="balance-preview-item">
                    <div className="balance-preview-label">⚡ 応援熱量</div>
                    <div className="balance-preview-value" style={{ color: '#ff7e33' }}>
                      {editParams.weightResonance} ({(editParams.weightResonance / 100).toFixed(1)}倍)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* カスタムモード */}
            {balanceMode === 'custom' && (
              <div className="edit-form">
                {/* Economic Weight */}
                <div className="form-group">
                  <label className="form-label">
                    💸 JPYC貢献の重み
                    <span className="form-help">
                      (金銭的貢献の評価重み - 100 = 1.0倍)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="10"
                    value={editParams.weightEconomic}
                    onChange={(e) =>
                      setEditParams({ ...editParams, weightEconomic: parseInt(e.target.value) })
                    }
                    className="range-input"
                  />
                  <div className="range-display">
                    <span>0 (無視)</span>
                    <span className="range-value">
                      {editParams.weightEconomic} ({(editParams.weightEconomic / 100).toFixed(1)}倍)
                    </span>
                    <span>300 (3倍)</span>
                  </div>
                </div>

                {/* Resonance Weight */}
                <div className="form-group">
                  <label className="form-label">
                    ⚡ 応援熱量の重み
                    <span className="form-help">
                      (継続的応援の評価重み - 100 = 1.0倍)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="10"
                    value={editParams.weightResonance}
                    onChange={(e) =>
                      setEditParams({ ...editParams, weightResonance: parseInt(e.target.value) })
                    }
                    className="range-input"
                  />
                  <div className="range-display">
                    <span>0 (無視)</span>
                    <span className="range-value">
                      {editParams.weightResonance} ({(editParams.weightResonance / 100).toFixed(1)}倍)
                    </span>
                    <span>300 (3倍)</span>
                  </div>
                </div>
              </div>
            )}

            {/* ボタン */}
            <div className="button-group">
              <button className="button button-secondary" onClick={handleCancel}>
                キャンセル
              </button>
              <button
                className="button button-primary"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? '保存中...' : '💾 保存して適用する'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 変更履歴 */}
      <div className="card">
        <h2 className="card-title" style={{ cursor: 'pointer' }} onClick={() => setShowHistory(!showHistory)}>
          📜 変更履歴 {showHistory ? '▼' : '▶'}
        </h2>

        {showHistory && (
          <div className="history-list">
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#718096' }}>
                まだ変更履歴がありません
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-params">
                    <span>💸 JPYC: {item.weightEconomic} ({(item.weightEconomic / 100).toFixed(1)}倍)</span>
                    <span>⚡ 応援: {item.weightResonance} ({(item.weightResonance / 100).toFixed(1)}倍)</span>
                  </div>
                  <div className="history-meta">
                    <div>{new Date(item.updatedAt).toLocaleString('ja-JP')}</div>
                    <div>更新者: {item.updatedBy}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreParametersPage;
