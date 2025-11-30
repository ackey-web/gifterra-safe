/**
 * @file スコアパラメータ管理ページ（改善版）
 * @description Admin用：二軸スコアシステムのパラメータを直感的に管理
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LegalCompliantDualAxisTank } from '../../components/score/LegalCompliantDualAxisTank';
import { supabase } from '../../lib/supabase';
import { saveScoreParams, type ScoreParamsData } from '../../lib/adminApi';

// ========================================
// 型定義
// ========================================

type Curve = 'Linear' | 'Sqrt' | 'Log';
type BalanceMode = 'simple' | 'custom';

interface ScoreParams {
  weightEconomic: number;
  weightResonance: number;
  curve: Curve;
  // Resonance計算パラメーター
  nhtWeight: number;
  streakWeight: number;
  aiQualityWeight: number;
  messageQualityWeight: number;
  lastUpdated: string;
}

interface ParamsHistory {
  id: string;
  weightEconomic: number;
  weightResonance: number;
  curve: Curve;
  nhtWeight: number;
  streakWeight: number;
  aiQualityWeight: number;
  messageQualityWeight: number;
  updatedAt: string;
  updatedBy: string;
}

// ========================================
// メインコンポーネント
// ========================================

export const ScoreParametersPage: React.FC = () => {
  // タブ切り替え用state
  const [activeTab, setActiveTab] = useState<'tank' | 'gauge'>('tank');

  const [params, setParams] = useState<ScoreParams>({
    weightEconomic: 100,
    weightResonance: 100,
    curve: 'Sqrt',
    nhtWeight: 2.0,
    streakWeight: 10.0,
    aiQualityWeight: 1.0,
    messageQualityWeight: 1.0,
    lastUpdated: new Date().toISOString(),
  });

  const [editParams, setEditParams] = useState<ScoreParams>(params);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<ParamsHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 新機能：バランスモード切り替え（タンク設定用）
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('simple');

  // シンプルモード用のバランス値（-100〜100）
  // -100: JPYC重視、0: 均等、100: 応援重視
  const [simpleBalance, setSimpleBalance] = useState(0);

  // ゲージ設定用のモード切り替え
  const [gaugeMode, setGaugeMode] = useState<BalanceMode>('simple');

  // ゲージのシンプルモード用バランス値（-100〜100）
  // -100: 回数重視、0: 均等、100: 質重視
  const [gaugeSimpleBalance, setGaugeSimpleBalance] = useState(0);

  // パラメータ取得
  useEffect(() => {
    fetchParams();
    fetchHistory();
  }, []);

  const fetchParams = async () => {
    try {
      console.log('📊 Fetching current params from Supabase...');

      // 最新のパラメータを取得（last_updated順で最新のもの）
      const { data, error } = await supabase
        .from('score_params')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Failed to fetch params:', error);
        return;
      }

      if (data) {
        console.log('✅ Params fetched:', data);
        const fetchedParams: ScoreParams = {
          weightEconomic: data.weight_economic,
          weightResonance: data.weight_resonance,
          curve: data.curve as Curve,
          nhtWeight: data.nht_weight ?? 2.0,
          streakWeight: data.streak_weight ?? 10.0,
          aiQualityWeight: data.ai_quality_weight ?? 1.0,
          messageQualityWeight: data.message_quality_weight ?? 1.0,
          lastUpdated: data.last_updated,
        };
        setParams(fetchedParams);
        setEditParams(fetchedParams);
      }
    } catch (error) {
      console.error('❌ Failed to fetch params:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      console.log('📜 Fetching params history from Supabase...');

      // 過去10件のパラメータ変更履歴を取得
      const { data, error } = await supabase
        .from('score_params')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Failed to fetch history:', error);
        return;
      }

      if (data) {
        const historyData: ParamsHistory[] = data.map((item) => ({
          id: item.id,
          weightEconomic: item.weight_economic,
          weightResonance: item.weight_resonance,
          curve: item.curve as Curve,
          nhtWeight: item.nht_weight ?? 2.0,
          streakWeight: item.streak_weight ?? 10.0,
          aiQualityWeight: item.ai_quality_weight ?? 1.0,
          messageQualityWeight: item.message_quality_weight ?? 1.0,
          updatedAt: item.last_updated,
          updatedBy: 'Admin', // TODO: 実際のユーザー情報を保存する場合はDBスキーマを変更
        }));
        setHistory(historyData);
        console.log('✅ History fetched:', historyData.length, 'records');
      }
    } catch (error) {
      console.error('❌ Failed to fetch history:', error);
    }
  };

  // シンプルバランススライダーが変更されたとき（タンク設定用）
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

  // ゲージ設定のシンプルバランススライダーが変更されたとき
  const handleGaugeSimpleBalanceChange = (value: number) => {
    setGaugeSimpleBalance(value);

    // バランス値から重みを計算（タンクと同じロジック）
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
      console.log('💾 Saving params via API...', editParams);

      // API経由で保存（Service Role使用）
      const paramsData: ScoreParamsData = {
        weightEconomic: editParams.weightEconomic,
        weightResonance: editParams.weightResonance,
        curve: editParams.curve,
        nhtWeight: editParams.nhtWeight,
        streakWeight: editParams.streakWeight,
        aiQualityWeight: editParams.aiQualityWeight,
        messageQualityWeight: editParams.messageQualityWeight,
      };

      const savedParams = await saveScoreParams(paramsData);

      console.log('✅ Params saved successfully:', savedParams);

      // 状態を更新
      const updatedParams: ScoreParams = {
        weightEconomic: savedParams.weightEconomic,
        weightResonance: savedParams.weightResonance,
        curve: savedParams.curve,
        nhtWeight: savedParams.nhtWeight ?? 2.0,
        streakWeight: savedParams.streakWeight ?? 10.0,
        aiQualityWeight: savedParams.aiQualityWeight ?? 1.0,
        messageQualityWeight: savedParams.messageQualityWeight ?? 1.0,
        lastUpdated: savedParams.lastUpdated,
      };

      setParams(updatedParams);
      setEditParams(updatedParams);
      setIsEditing(false);

      // 履歴を再取得
      await fetchHistory();

      alert('✅ パラメータを更新しました\n\n⚠️ 全ユーザーのkodomi値が再計算されます。');
    } catch (error) {
      console.error('❌ Save error:', error);
      alert('❌ 更新に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
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
    editParams.curve !== params.curve ||
    editParams.nhtWeight !== params.nhtWeight ||
    editParams.streakWeight !== params.streakWeight ||
    editParams.aiQualityWeight !== params.aiQualityWeight ||
    editParams.messageQualityWeight !== params.messageQualityWeight;

  // バランス状態を表示用の文字列に変換（タンク設定用）
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

  // ゲージバランス状態を表示用の文字列に変換
  const getGaugeBalanceLabel = () => {
    if (gaugeSimpleBalance < -50) return '回数重視';
    if (gaugeSimpleBalance < -20) return '回数 やや重視';
    if (gaugeSimpleBalance > 50) return '質重視';
    if (gaugeSimpleBalance > 20) return '質 やや重視';
    return 'バランス均等';
  };

  const getGaugeBalanceColor = () => {
    if (gaugeSimpleBalance < -20) return '#4a9eff'; // 回数重視 blue
    if (gaugeSimpleBalance > 20) return '#ff7e33'; // 質重視 orange
    return '#8b5cf6'; // Balanced purple
  };

  // ========================================
  // プレビュー計算ロジック（50 JPYC基準）
  // ========================================

  const previewData = useMemo(() => {
    const baseJPYC = 50; // 基準JPYC額
    const baseNHT = 10;  // 基準NHT応援回数

    // 重みを適用してスコア計算
    const jpycScore = baseJPYC * (editParams.weightEconomic / 100);
    const resonanceScore = baseNHT * 2 * (editParams.weightResonance / 100); // NHTは回数×2

    // ランク定義（useDualAxisKodomiと同じ）
    const JPYC_RANKS = {
      BRONZE: { name: 'Bronze', threshold: 0, color: '#cd7f32', maxThreshold: 200 },
      SILVER: { name: 'Silver', threshold: 200, color: '#c0c0c0', maxThreshold: 700 },
      GOLD: { name: 'Gold', threshold: 700, color: '#ffd700', maxThreshold: 1500 },
      PLATINUM: { name: 'Platinum', threshold: 1500, color: '#e5e4e2', maxThreshold: 7000 },
      DIAMOND: { name: 'Diamond', threshold: 7000, color: '#b9f2ff', maxThreshold: Infinity },
    };

    const RESONANCE_RANKS = {
      SPARK: { name: 'Spark', threshold: 0, color: '#ffa500', maxThreshold: 150 },
      FLAME: { name: 'Flame', threshold: 150, color: '#ff6b35', maxThreshold: 400 },
      BLAZE: { name: 'Blaze', threshold: 400, color: '#ff4500', maxThreshold: 800 },
      INFERNO: { name: 'Inferno', threshold: 800, color: '#dc143c', maxThreshold: 1500 },
      PHOENIX: { name: 'Phoenix', threshold: 1500, color: '#ff00ff', maxThreshold: Infinity },
    };

    // JPYCランク計算
    function calculateJPYCRank(totalAmount: number) {
      const ranks = Object.values(JPYC_RANKS);
      for (let i = 0; i < ranks.length; i++) {
        const currentRank = ranks[i];
        if (totalAmount < currentRank.maxThreshold) {
          const progress = totalAmount >= currentRank.threshold
            ? ((totalAmount - currentRank.threshold) / (currentRank.maxThreshold - currentRank.threshold)) * 100
            : 0;
          return {
            rank: currentRank.name,
            color: currentRank.color,
            level: Math.min(progress, 100),
            displayLevel: i + 1,
          };
        }
      }
      return {
        rank: JPYC_RANKS.DIAMOND.name,
        color: JPYC_RANKS.DIAMOND.color,
        level: 100,
        displayLevel: Object.keys(JPYC_RANKS).length,
      };
    }

    // Resonanceランク計算
    function calculateResonanceRank(engagementScore: number) {
      const ranks = Object.values(RESONANCE_RANKS);
      for (let i = 0; i < ranks.length; i++) {
        const currentRank = ranks[i];
        if (engagementScore < currentRank.maxThreshold) {
          const progress = engagementScore >= currentRank.threshold
            ? ((engagementScore - currentRank.threshold) / (currentRank.maxThreshold - currentRank.threshold)) * 100
            : 0;
          return {
            rank: currentRank.name,
            color: currentRank.color,
            level: Math.min(progress, 100),
            displayLevel: i + 1,
          };
        }
      }
      return {
        rank: RESONANCE_RANKS.PHOENIX.name,
        color: RESONANCE_RANKS.PHOENIX.color,
        level: 100,
        displayLevel: Object.keys(RESONANCE_RANKS).length,
      };
    }

    const jpycRank = calculateJPYCRank(jpycScore);
    const resonanceRank = calculateResonanceRank(resonanceScore);

    // KODOMIゲージ用の総合スコア計算
    // Economic + Resonanceの合計
    const totalKodomiScore = Math.round(jpycScore + resonanceScore);

    return {
      jpycAmount: jpycScore,
      jpycTipCount: 1,
      jpycLevel: jpycRank.level,
      jpycDisplayLevel: jpycRank.displayLevel,
      jpycRank: jpycRank.rank,
      jpycColor: jpycRank.color,
      supportCount: baseNHT,
      streakDays: 3,
      engagementScore: resonanceScore,
      resonanceLevel: resonanceRank.level,
      resonanceDisplayLevel: resonanceRank.displayLevel,
      resonanceRank: resonanceRank.rank,
      resonanceColor: resonanceRank.color,
      kodomiScore: totalKodomiScore, // ゲージ用
    };
  }, [editParams.weightEconomic, editParams.weightResonance]);

  return (
    <div className="score-params-page">
      <style>{`
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

        /* プレビューセクション */
        .preview-section {
          margin-top: 32px;
          padding: 24px;
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          border-radius: 16px;
          border: 2px solid #e2e8f0;
        }

        .preview-title {
          font-size: 16px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 12px;
          text-align: center;
        }

        .preview-description {
          font-size: 13px;
          color: #718096;
          margin-bottom: 20px;
          text-align: center;
          line-height: 1.6;
        }

        .preview-tank-wrapper {
          display: flex;
          justify-content: center;
          margin-top: 20px;
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
        <h1 className="page-title">⚖️ スコアパラメータ管理</h1>
        <p className="page-description">
          KODOMIタンクとKODOMIゲージの設定を管理します
        </p>
      </div>

      {/* タブナビゲーション */}
      <div className="card">
        <div style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 24,
        }}>
          <button
            onClick={() => setActiveTab('tank')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'tank' ? '3px solid #667eea' : '3px solid transparent',
              fontSize: 15,
              fontWeight: 600,
              color: activeTab === 'tank' ? '#667eea' : '#718096',
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'all 0.2s ease',
            }}
          >
            🏆 KODOMIタンク設定
          </button>
          <button
            onClick={() => setActiveTab('gauge')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'gauge' ? '3px solid #ff7e33' : '3px solid transparent',
              fontSize: 15,
              fontWeight: 600,
              color: activeTab === 'gauge' ? '#ff7e33' : '#718096',
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'all 0.2s ease',
            }}
          >
            📊 KODOMIゲージ設定
          </button>
        </div>
      </div>

      {/* タンク設定タブ */}
      {activeTab === 'tank' && (
        <>
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

                {/* リアルタイムプレビュー */}
                <div className="preview-section">
                  <div className="preview-title">
                    📊 リアルタイムプレビュー
                  </div>
                  <div className="preview-description">
                    50 JPYCのチップ + 10回のNHT応援を送った場合のkodomi TANKの変化
                  </div>
                  <div className="preview-tank-wrapper">
                    <LegalCompliantDualAxisTank
                      {...previewData}
                      showDetails={true}
                      size="small"
                    />
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

                {/* セパレーター */}
                <div style={{
                  margin: '32px 0',
                  padding: '16px',
                  background: 'linear-gradient(135deg, rgba(255, 126, 51, 0.05), rgba(255, 87, 34, 0.02))',
                  borderRadius: 12,
                  border: '1px dashed rgba(255, 126, 51, 0.2)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ff7e33', marginBottom: 4 }}>
                    🔥 応援熱量タンク（オレンジ）の詳細設定
                  </div>
                  <div style={{ fontSize: 12, color: '#718096' }}>
                    KODOMIタンクの応援熱量（Resonance）評価の内訳パラメーター
                  </div>
                </div>

                {/* NHT Weight */}
                <div className="form-group">
                  <label className="form-label">
                    🎁 NHT応援回数の重み
                    <span className="form-help">
                      (応援回数の評価重み - デフォルト: 2.0)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editParams.nhtWeight}
                    onChange={(e) =>
                      setEditParams({ ...editParams, nhtWeight: parseFloat(e.target.value) })
                    }
                    className="range-input"
                  />
                  <div className="range-display">
                    <span>0.0</span>
                    <span className="range-value">{editParams.nhtWeight.toFixed(1)}</span>
                    <span>10.0</span>
                  </div>
                </div>

                {/* Streak Weight */}
                <div className="form-group">
                  <label className="form-label">
                    🔥 連続応援日数の重み
                    <span className="form-help">
                      (継続性の評価重み - デフォルト: 10.0)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={editParams.streakWeight}
                    onChange={(e) =>
                      setEditParams({ ...editParams, streakWeight: parseFloat(e.target.value) })
                    }
                    className="range-input"
                  />
                  <div className="range-display">
                    <span>0.0</span>
                    <span className="range-value">{editParams.streakWeight.toFixed(1)}</span>
                    <span>20.0</span>
                  </div>
                </div>

                {/* AI Quality Weight */}
                <div className="form-group">
                  <label className="form-label">
                    🤖 AI質的スコアの重み
                    <span className="form-help">
                      (メッセージのAI評価の重み - デフォルト: 1.0)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={editParams.aiQualityWeight}
                    onChange={(e) =>
                      setEditParams({ ...editParams, aiQualityWeight: parseFloat(e.target.value) })
                    }
                    className="range-input"
                  />
                  <div className="range-display">
                    <span>0.0</span>
                    <span className="range-value">{editParams.aiQualityWeight.toFixed(1)}</span>
                    <span>5.0</span>
                  </div>
                </div>

                {/* Message Quality Weight */}
                <div className="form-group">
                  <label className="form-label">
                    💬 メッセージ品質の重み
                    <span className="form-help">
                      (メッセージの量的評価の重み - デフォルト: 1.0)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={editParams.messageQualityWeight}
                    onChange={(e) =>
                      setEditParams({ ...editParams, messageQualityWeight: parseFloat(e.target.value) })
                    }
                    className="range-input"
                  />
                  <div className="range-display">
                    <span>0.0</span>
                    <span className="range-value">{editParams.messageQualityWeight.toFixed(1)}</span>
                    <span>5.0</span>
                  </div>
                </div>

                {/* リアルタイムプレビュー（カスタムモード） */}
                <div className="preview-section">
                  <div className="preview-title">
                    📊 リアルタイムプレビュー
                  </div>
                  <div className="preview-description">
                    50 JPYCのチップ + 10回のNHT応援を送った場合のkodomi TANKの変化
                  </div>
                  <div className="preview-tank-wrapper">
                    <LegalCompliantDualAxisTank
                      {...previewData}
                      showDetails={true}
                      size="small"
                    />
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
        </>
      )}

      {/* ゲージ設定タブ */}
      {activeTab === 'gauge' && (
        <>
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
                ゲージパラメーターを変更すると、全ユーザーのエンゲージメントスコアが再計算されます。<br />
                ランキングが大きく変動する可能性があるため、慎重に変更してください。
              </div>
            </div>

            {/* モード切り替えタブ */}
            <div className="mode-tabs">
              <button
                className={`mode-tab ${gaugeMode === 'simple' ? 'active' : ''}`}
                onClick={() => setGaugeMode('simple')}
              >
                🎯 シンプル設定
              </button>
              <button
                className={`mode-tab ${gaugeMode === 'custom' ? 'active' : ''}`}
                onClick={() => setGaugeMode('custom')}
              >
                🔧 カスタム設定
              </button>
            </div>

            {/* シンプルモード */}
            {gaugeMode === 'simple' && (
              <div className="balance-slider-container">
                <div className="balance-label-main">
                  📊 評価バランス
                </div>
                <div className="balance-status" style={{ color: getGaugeBalanceColor() }}>
                  {getGaugeBalanceLabel()}
                </div>

                <div className="balance-slider-wrapper">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="10"
                    value={gaugeSimpleBalance}
                    onChange={(e) => handleGaugeSimpleBalanceChange(parseInt(e.target.value))}
                    className="balance-slider"
                    style={{ color: getGaugeBalanceColor() }}
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

                {/* リアルタイムプレビュー - 二軸ゲージ */}
                <div className="preview-section">
                  <div className="preview-title">
                    📊 リアルタイムプレビュー（二軸ゲージ）
                  </div>
                  <div className="preview-description">
                    50 JPYCのチップ + 10回のNHT応援を送った場合のKODOMI GAUGEの変化
                  </div>
                  <div style={{
                    marginTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: '24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 12,
                  }}>
                    {/* 💸 JPYC貢献ゲージ */}
                    <div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.8)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <span>💸</span>
                        <span>JPYC貢献</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>
                          （50 JPYC）
                        </span>
                      </div>
                      <ContributionGaugeCustom
                        kodomi={Math.round(previewData.jpycAmount)}
                        label="JPYC"
                        icon="💸"
                        isMobile={false}
                      />
                    </div>

                    {/* ⚡ NHT応援熱量ゲージ */}
                    <div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.8)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <span>⚡</span>
                        <span>応援熱量</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>
                          （10回の応援）
                        </span>
                      </div>
                      <ContributionGaugeCustom
                        kodomi={Math.round(previewData.engagementScore)}
                        label="NHT"
                        icon="⚡"
                        isMobile={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* カスタムモード */}
            {gaugeMode === 'custom' && (
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

                {/* リアルタイムプレビュー（カスタムモード） - 二軸ゲージ */}
                <div className="preview-section">
                  <div className="preview-title">
                    📊 リアルタイムプレビュー（二軸ゲージ）
                  </div>
                  <div className="preview-description">
                    50 JPYCのチップ + 10回のNHT応援を送った場合のKODOMI GAUGEの変化
                  </div>
                  <div style={{
                    marginTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: '24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 12,
                  }}>
                    {/* 💸 JPYC貢献ゲージ */}
                    <div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.8)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <span>💸</span>
                        <span>JPYC貢献</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>
                          （50 JPYC）
                        </span>
                      </div>
                      <ContributionGaugeCustom
                        kodomi={Math.round(previewData.jpycAmount)}
                        label="JPYC"
                        icon="💸"
                        isMobile={false}
                      />
                    </div>

                    {/* ⚡ NHT応援熱量ゲージ */}
                    <div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.8)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <span>⚡</span>
                        <span>応援熱量</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>
                          （10回の応援）
                        </span>
                      </div>
                      <ContributionGaugeCustom
                        kodomi={Math.round(previewData.engagementScore)}
                        label="NHT"
                        icon="⚡"
                        isMobile={false}
                      />
                    </div>
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
        </>
      )}

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

// ========================================
// カスタマイズ可能なContributionGauge（JPYC/NHT用 - 二軸ゲージ）
// ========================================
function ContributionGaugeCustom({ kodomi, label, icon, isMobile }: {
  kodomi: number;
  label: string;
  icon: string;
  isMobile: boolean;
}) {
  // レベル計算（ContributionGaugeと同じロジック）
  function calculateLevel(k: number): { level: number; progress: number; nextLevelThreshold: number } {
    const thresholds = [0, 100, 300, 600, 1000];

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (k >= thresholds[i]) {
        const level = i + 1;
        const currentThreshold = thresholds[i];
        const nextThreshold = i < thresholds.length - 1 ? thresholds[i + 1] : thresholds[i] + 500;
        const progressInLevel = k - currentThreshold;
        const levelRange = nextThreshold - currentThreshold;
        const progress = Math.min(100, (progressInLevel / levelRange) * 100);

        return { level, progress, nextLevelThreshold: nextThreshold };
      }
    }

    return { level: 1, progress: 0, nextLevelThreshold: 100 };
  }

  const { level, progress, nextLevelThreshold } = calculateLevel(kodomi);

  // レベルに応じた色を決定
  const getLevelColor = (lvl: number) => {
    switch (lvl) {
      case 1: return '#94a3b8'; // Gray
      case 2: return '#3b82f6'; // Blue
      case 3: return '#8b5cf6'; // Purple
      case 4: return '#f59e0b'; // Orange
      case 5: return '#ef4444'; // Red
      default: return '#94a3b8';
    }
  };

  const levelColor = getLevelColor(level);
  const remaining = nextLevelThreshold - kodomi;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '10px' : '14px',
        padding: isMobile ? '10px 16px' : '12px 20px',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 100%)',
        borderRadius: 12,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* アイコン */}
      <span
        style={{
          fontSize: isMobile ? 22 : 26,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
        }}
      >
        {icon}
      </span>

      {/* ラベル */}
      <div
        style={{
          fontSize: isMobile ? 10 : 11,
          fontWeight: 800,
          color: 'rgba(255, 255, 255, 0.6)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
          minWidth: isMobile ? 40 : 50,
        }}
      >
        {label}
      </div>

      {/* レベル表示とプログレスバー */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700,
            color: levelColor,
            letterSpacing: '0.5px',
            textShadow: `0 0 8px ${levelColor}80, 0 2px 4px rgba(0, 0, 0, 0.5)`,
          }}
        >
          Lv.{level}
        </div>

        {/* プログレスバー */}
        <div
          style={{
            width: '100%',
            height: isMobile ? 10 : 12,
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: 6,
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(0, 0, 0, 0.3)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(180deg, ${levelColor} 0%, ${levelColor}cc 50%, ${levelColor}99 100%)`,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 12px ${levelColor}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
              position: 'relative',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '40%',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%)',
                borderRadius: '4px 4px 0 0',
              }}
            />
          </div>
        </div>
      </div>

      {/* スコア表示 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: isMobile ? 13 : 15,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            letterSpacing: '0.3px',
          }}
        >
          {kodomi}pt
        </div>

        {level < 5 && (
          <div
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.6,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            次まで {remaining}pt
          </div>
        )}

        {level >= 5 && (
          <div
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.7,
              color: '#fbbf24',
              textShadow: '0 0 6px rgba(251, 191, 36, 0.5), 0 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            ✨ MAX
          </div>
        )}
      </div>
    </div>
  );
}

export default ScoreParametersPage;
