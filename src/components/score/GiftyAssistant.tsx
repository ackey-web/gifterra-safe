/**
 * @file Giftyアシスタントコンポーネント
 * @description AIによる二軸スコアバランス分析とパーソナライズド提案
 */

import React, { useState, useEffect, useRef } from 'react';
import type { UserScoreData } from '../../hooks/useScoreApi';

// ========================================
// 型定義
// ========================================

export interface GiftyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface BalanceAnalysis {
  economicRatio: number; // 0-100
  resonanceRatio: number; // 0-100
  balanceType: 'balanced' | 'economic-heavy' | 'resonance-heavy' | 'beginner';
  suggestions: string[];
  encouragement: string;
}

export interface GiftyAssistantProps {
  userScore: UserScoreData;
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

// ========================================
// バランス分析ロジック
// ========================================

function analyzeBalance(userScore: UserScoreData): BalanceAnalysis {
  const { economic, resonance } = userScore;

  // 総スコアの計算
  const totalScore = economic.score + resonance.score;

  // 初心者判定
  if (totalScore < 100) {
    return {
      economicRatio: 50,
      resonanceRatio: 50,
      balanceType: 'beginner',
      suggestions: [
        '🎉 はじめてのTIPをしてみましょう！',
        '💝 お気に入りのクリエイターを見つけましょう',
        '🔥 毎日ログインしてストリークを伸ばしましょう',
      ],
      encouragement: 'Gifterraへようこそ！まずは気になるクリエイターにTIPしてみましょう✨',
    };
  }

  // 比率計算
  const economicRatio = (economic.score / totalScore) * 100;
  const resonanceRatio = (resonance.score / totalScore) * 100;

  // バランスタイプ判定（60/40を閾値とする）
  let balanceType: BalanceAnalysis['balanceType'] = 'balanced';
  let suggestions: string[] = [];
  let encouragement = '';

  if (economicRatio > 60) {
    // Economic寄り
    balanceType = 'economic-heavy';
    suggestions = [
      '🔥 連続応援でResonanceスコアを伸ばしましょう！',
      `⚡ あと${7 - (resonance.streak % 7)}日連続でボーナス獲得！`,
      '💝 お気に入り登録で応援を習慣化しましょう',
    ];
    encouragement = `素晴らしい貢献です💸 継続的な応援でResonanceスコアも伸ばしてみませんか？`;
  } else if (resonanceRatio > 60) {
    // Resonance寄り
    balanceType = 'resonance-heavy';
    suggestions = [
      '💰 大きなTIPでEconomicスコアを伸ばしましょう',
      '🎯 まとめて応援するとレベルアップが早くなります',
      '⭐ 新しいクリエイターも応援してみましょう',
    ];
    encouragement = `継続的な熱量が素晴らしい🔥 たまにはまとまったTIPもいかがですか？`;
  } else {
    // バランス良好
    balanceType = 'balanced';
    suggestions = [
      '🏆 完璧なバランスです！このまま続けましょう',
      `📊 現在のランクは #${userScore.composite.score}位です`,
      '🌟 次のバッジまであと少し！',
    ];
    encouragement = `理想的なバランスです✨ 金銭的貢献と継続的熱量が両立しています！`;
  }

  return {
    economicRatio,
    resonanceRatio,
    balanceType,
    suggestions,
    encouragement,
  };
}

// ========================================
// メインコンポーネント
// ========================================

export const GiftyAssistant: React.FC<GiftyAssistantProps> = ({
  userScore,
  onSuggestionClick,
  className = '',
}) => {
  const [messages, setMessages] = useState<GiftyMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // バランス分析
  const analysis = analyzeBalance(userScore);

  // 初回メッセージ
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessage: GiftyMessage = {
        id: 'initial',
        role: 'assistant',
        content: `こんにちは！私はGifty、あなたの応援をサポートするAIアシスタントです🎁\n\n${analysis.encouragement}`,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
    }
  }, []);

  // メッセージが更新されたら最下部にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // バランス分析を実行
  const handleAnalyzeBalance = () => {
    setIsAnalyzing(true);

    const analysisMessage: GiftyMessage = {
      id: `analysis-${Date.now()}`,
      role: 'assistant',
      content: `📊 スコアバランス分析結果\n\n💸 Economic: ${analysis.economicRatio.toFixed(1)}%\n🔥 Resonance: ${analysis.resonanceRatio.toFixed(1)}%\n\nタイプ: ${
        analysis.balanceType === 'balanced'
          ? '⚖️ バランス型'
          : analysis.balanceType === 'economic-heavy'
          ? '💰 金銭貢献型'
          : analysis.balanceType === 'resonance-heavy'
          ? '🔥 熱量重視型'
          : '🌱 ビギナー'
      }\n\n${analysis.encouragement}`,
      timestamp: new Date(),
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, analysisMessage]);
      setIsAnalyzing(false);
    }, 1000);
  };

  // 提案をクリック
  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick?.(suggestion);

    const responseMessage: GiftyMessage = {
      id: `response-${Date.now()}`,
      role: 'assistant',
      content: '素晴らしい選択です！頑張ってください✨',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, responseMessage]);
  };

  return (
    <div className={`gifty-assistant ${className}`}>
      <style jsx>{`
        .gifty-assistant {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
        }

        /* フローティングボタン */
        .gifty-button {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          transition: all 0.3s ease;
          position: relative;
        }

        .gifty-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
        }

        .gifty-button.open {
          transform: scale(0.9);
        }

        /* 通知バッジ */
        .notification-badge {
          position: absolute;
          top: 0;
          right: 0;
          width: 20px;
          height: 20px;
          background: #e74c3c;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
          border: 2px solid white;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }

        /* チャットパネル */
        .chat-panel {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 360px;
          max-height: 600px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          transform: translateY(20px) scale(0.9);
          pointer-events: none;
          transition: all 0.3s ease;
        }

        .chat-panel.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        /* ヘッダー */
        .chat-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .chat-header-info {
          flex: 1;
        }

        .chat-header-name {
          font-size: 16px;
          font-weight: bold;
        }

        .chat-header-status {
          font-size: 12px;
          opacity: 0.9;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* メッセージエリア */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #f8f9fa;
        }

        .messages-area::-webkit-scrollbar {
          width: 6px;
        }

        .messages-area::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .messages-area::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 3px;
        }

        /* メッセージバブル */
        .message {
          display: flex;
          gap: 8px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .message.user .message-avatar {
          background: #e2e8f0;
        }

        .message-bubble {
          max-width: 70%;
          padding: 12px 16px;
          border-radius: 16px;
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          white-space: pre-wrap;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.5;
          color: #2d3748;
        }

        .message.user .message-bubble {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        /* 提案カード */
        .suggestions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }

        .suggestion-card {
          padding: 12px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          text-align: left;
        }

        .suggestion-card:hover {
          background: #edf2f7;
          border-color: #667eea;
          transform: translateX(4px);
        }

        /* アクションエリア */
        .actions-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 8px;
        }

        .action-button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* ローディング */
        .loading {
          display: flex;
          gap: 4px;
          padding: 8px 12px;
        }

        .loading-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #cbd5e0;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .loading-dot:nth-child(1) {
          animation-delay: -0.32s;
        }

        .loading-dot:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        /* モバイル対応 */
        @media (max-width: 640px) {
          .gifty-assistant {
            bottom: 16px;
            right: 16px;
          }

          .gifty-button {
            width: 56px;
            height: 56px;
            font-size: 28px;
          }

          .chat-panel {
            width: calc(100vw - 32px);
            max-height: calc(100vh - 120px);
          }
        }
      `}</style>

      {/* フローティングボタン */}
      <button
        className={`gifty-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        🎁
        {!isOpen && analysis.suggestions.length > 0 && (
          <div className="notification-badge">{analysis.suggestions.length}</div>
        )}
      </button>

      {/* チャットパネル */}
      <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
        {/* ヘッダー */}
        <div className="chat-header">
          <div className="chat-avatar">🎁</div>
          <div className="chat-header-info">
            <div className="chat-header-name">Gifty</div>
            <div className="chat-header-status">AIアシスタント</div>
          </div>
          <button className="close-button" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>

        {/* メッセージエリア */}
        <div className="messages-area">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-avatar">{message.role === 'assistant' ? '🎁' : '👤'}</div>
              <div className="message-bubble">{message.content}</div>
            </div>
          ))}

          {/* 提案カード */}
          {messages.length > 0 && analysis.suggestions.length > 0 && (
            <div className="suggestions">
              {analysis.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-card"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}

          {/* ローディング */}
          {isAnalyzing && (
            <div className="message assistant">
              <div className="message-avatar">🎁</div>
              <div className="message-bubble">
                <div className="loading">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* アクションエリア */}
        <div className="actions-area">
          <button
            className="action-button"
            onClick={handleAnalyzeBalance}
            disabled={isAnalyzing}
          >
            📊 バランス分析
          </button>
        </div>
      </div>
    </div>
  );
};

export default GiftyAssistant;
