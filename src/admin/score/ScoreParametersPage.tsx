/**
 * @file スコアパラメータ管理ページ
 * @description Admin用：二軸スコアシステムのパラメータを管理
 */

import React, { useState, useEffect } from 'react';

// ========================================
// 型定義
// ========================================

type Curve = 'Linear' | 'Sqrt' | 'Log';

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

  // パラメータ取得
  useEffect(() => {
    fetchParams();
    fetchHistory();
  }, []);

  const fetchParams = async () => {
    try {
      // TODO: 実際のAPIエンドポイントから取得
      // const response = await fetch('/api/admin/params', {
      //   headers: { 'x-api-key': process.env.ADMIN_API_KEY }
      // });
      // const data = await response.json();
      // setParams(data);
      // setEditParams(data);

      // モックデータ
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
        alert('✅ パラメータを更新しました\n\n⚠️ 全ユーザーの合成スコアが再計算されます。');
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
  };

  const hasChanges =
    editParams.weightEconomic !== params.weightEconomic ||
    editParams.weightResonance !== params.weightResonance ||
    editParams.curve !== params.curve;

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
          grid-template-columns: repeat(3, 1fr);
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

        .form-input {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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

        /* 曲線選択 */
        .curve-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .curve-option {
          padding: 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .curve-option:hover {
          border-color: #cbd5e0;
          background: #f7fafc;
        }

        .curve-option.active {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea11, #764ba211);
        }

        .curve-name {
          font-size: 16px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .curve-formula {
          font-size: 12px;
          color: #718096;
          font-family: monospace;
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

          .curve-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ヘッダー */}
      <div className="page-header">
        <h1 className="page-title">📊 スコアパラメータ管理</h1>
        <p className="page-description">
          二軸スコアシステムの計算パラメータを管理します
        </p>
      </div>

      {/* 現在の設定 */}
      <div className="card">
        <h2 className="card-title">
          ⚙️ 現在の設定
        </h2>

        <div className="current-params">
          <div className="param-display">
            <div className="param-label">Economic Weight</div>
            <div className="param-value">{params.weightEconomic}</div>
            <div className="param-unit">basis points (1.0x)</div>
          </div>

          <div className="param-display">
            <div className="param-label">Resonance Weight</div>
            <div className="param-value">{params.weightResonance}</div>
            <div className="param-unit">basis points (1.0x)</div>
          </div>

          <div className="param-display">
            <div className="param-label">Curve Type</div>
            <div className="param-value">{params.curve}</div>
            <div className="param-unit">
              {params.curve === 'Linear' && 'f(x) = x'}
              {params.curve === 'Sqrt' && 'f(x) = √x'}
              {params.curve === 'Log' && 'f(x) = log₁₀(x+1)'}
            </div>
          </div>
        </div>

        {!isEditing ? (
          <div className="button-group">
            <button className="button button-primary" onClick={() => setIsEditing(true)}>
              ✏️ 編集する
            </button>
          </div>
        ) : (
          <>
            {/* 警告 */}
            <div className="warning-box">
              <div className="warning-title">⚠️ 重要な注意事項</div>
              <div className="warning-text">
                パラメータを変更すると、全ユーザーの合成スコアが再計算されます。<br />
                ランキングが大きく変動する可能性があるため、慎重に変更してください。
              </div>
            </div>

            {/* 編集フォーム */}
            <div className="edit-form">
              {/* Economic Weight */}
              <div className="form-group">
                <label className="form-label">
                  💸 Economic Weight
                  <span className="form-help">
                    (金銭的貢献の重み - 100 = 1.0倍)
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
                  <span>0</span>
                  <span className="range-value">
                    {editParams.weightEconomic} ({(editParams.weightEconomic / 100).toFixed(1)}x)
                  </span>
                  <span>300</span>
                </div>
              </div>

              {/* Resonance Weight */}
              <div className="form-group">
                <label className="form-label">
                  🔥 Resonance Weight
                  <span className="form-help">
                    (継続的熱量の重み - 100 = 1.0倍)
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
                  <span>0</span>
                  <span className="range-value">
                    {editParams.weightResonance} ({(editParams.weightResonance / 100).toFixed(1)}x)
                  </span>
                  <span>300</span>
                </div>
              </div>

              {/* Curve Type */}
              <div className="form-group">
                <label className="form-label">
                  📈 Curve Type
                  <span className="form-help">
                    (Resonanceスコアに適用する曲線)
                  </span>
                </label>
                <div className="curve-options">
                  {(['Linear', 'Sqrt', 'Log'] as Curve[]).map((curve) => (
                    <div
                      key={curve}
                      className={`curve-option ${editParams.curve === curve ? 'active' : ''}`}
                      onClick={() => setEditParams({ ...editParams, curve })}
                    >
                      <div className="curve-name">{curve}</div>
                      <div className="curve-formula">
                        {curve === 'Linear' && 'f(x) = x'}
                        {curve === 'Sqrt' && 'f(x) = √x'}
                        {curve === 'Log' && 'f(x) = log₁₀(x+1)'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
                {isSaving ? '保存中...' : '💾 保存する'}
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
                    <span>💸 {item.weightEconomic}</span>
                    <span>🔥 {item.weightResonance}</span>
                    <span>📈 {item.curve}</span>
                  </div>
                  <div className="history-meta">
                    <div>{new Date(item.updatedAt).toLocaleString('ja-JP')}</div>
                    <div>{item.updatedBy}</div>
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
