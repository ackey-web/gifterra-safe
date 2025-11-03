// src/components/GIFTERRAAIAssistant.tsx
// GIFTERRA AI アシスタント - 特典受け取り失敗時のサポート

import { useState, useEffect, useRef } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { getExtendedKodomiProfile, getCachedKodomiProfile } from '../lib/kodomi-integration';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatWindowProps {
  walletAddress: string | undefined;
  autoOpenContext: 'CLAIM_FAILED' | null;
  onClose: () => void;
  // GIFT HUB商品データ（AIの提案用）
  products?: Array<{
    id: string;
    name: string;
    price_amount_wei: string;
    stock: number;
    is_unlimited: boolean;
    description?: string | null;
  }>;
  // ユーザーのトークン残高（Wei）
  userBalance?: string;
}

function ChatWindow({ walletAddress, autoOpenContext, onClose, products, userBalance }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [kodomiProfile, setKodomiProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isClearing = useRef(false); // チャット履歴削除中フラグ

  // URLをリンク化する関数
  const linkifyUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#60a5fa',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#60a5fa';
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // 自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // kodomiプロファイル取得（キャッシュ優先）
  useEffect(() => {
    if (!walletAddress) return;

    const loadProfile = async () => {
      // まずキャッシュから取得
      const cached = getCachedKodomiProfile(walletAddress);
      if (cached) {
        setKodomiProfile(cached);
      }

      // バックグラウンドでフル取得
      try {
        const full = await getExtendedKodomiProfile(walletAddress);
        if (full) {
          setKodomiProfile(full);
        }
      } catch (error) {
        console.warn('⚠️ Kodomi プロファイル取得エラー:', error);
      }
    };

    loadProfile();
  }, [walletAddress]);

  // チャット履歴の復元（localStorage から）+ 自動削除
  useEffect(() => {
    if (!walletAddress) return;

    const storageKey = `gifterra_chat_${walletAddress}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // タイムスタンプを Date オブジェクトに変換 + 24時間以上古いメッセージを除外
        const restored: Message[] = parsed
          .map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          .filter((msg: Message) => {
            const messageAge = now - msg.timestamp.getTime();
            return messageAge < twentyFourHours;
          })
          .slice(-10); // 最新10件のみ保持

        if (restored.length > 0) {
          setMessages(restored);
          return;
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.warn('⚠️ チャット履歴の復元に失敗:', error);
      }
    }

    // 保存された履歴がない場合は初期メッセージを設定
    const greeting: Message = {
      role: 'assistant',
      content: autoOpenContext === 'CLAIM_FAILED'
        ? '申し訳ございません。特典の受け取りに問題が発生した可能性があります。\n\nどのような状況かお聞かせいただけますか？履歴を確認して、すぐにサポートいたします。'
        : 'こんにちは！ギフティです。\n\n特典の受け取りに関するご質問や、おすすめの特典についてお答えします。お気軽にお声がけください。',
      timestamp: new Date()
    };
    setMessages([greeting]);
  }, [walletAddress, autoOpenContext]);

  // チャット履歴の保存（localStorage へ）- 最新10件のみ
  useEffect(() => {
    if (!walletAddress || messages.length === 0) return;

    // チャット履歴削除中は保存しない
    if (isClearing.current) {
      isClearing.current = false; // フラグをリセット
      return;
    }

    const storageKey = `gifterra_chat_${walletAddress}`;
    try {
      // 最新10件のみ保存してストレージ容量を節約
      const messagesToSave = messages.slice(-10);
      localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
    } catch (error) {
      console.warn('⚠️ チャット履歴の保存に失敗:', error);
    }
  }, [messages, walletAddress]);

  // 問題解決検出とチャット削除提案
  useEffect(() => {
    if (messages.length < 2) return;

    const lastMessage = messages[messages.length - 1];
    const secondLastMessage = messages[messages.length - 2];

    // ギフティが「この問題は解決しましたか」と聞いている場合
    if (
      secondLastMessage.role === 'assistant' &&
      (secondLastMessage.content.includes('問題は解決しましたか') ||
       secondLastMessage.content.includes('解決しましたか'))
    ) {
      // ユーザーが肯定的に答えた場合
      if (
        lastMessage.role === 'user' &&
        (lastMessage.content.match(/はい|解決|大丈夫|ok|オーケー|ありがとう|thanks/i))
      ) {
        // 少し待ってから削除提案
        setTimeout(() => {
          const confirmed = window.confirm(
            '問題が解決したようで良かったです！\n\n' +
            'チャット履歴を削除しますか？\n' +
            '（削除すると運営側のコスト削減にもなります）'
          );

          if (confirmed && walletAddress) {
            const storageKey = `gifterra_chat_${walletAddress}`;
            localStorage.removeItem(storageKey);

            // チャット履歴削除中フラグを設定
            isClearing.current = true;

            // 初期メッセージにリセット
            const greeting: Message = {
              role: 'assistant',
              content: 'こんにちは！ギフティです。\n\n特典の受け取りに関するご質問や、おすすめの特典についてお答えします。お気軽にお声がけください。',
              timestamp: new Date()
            };
            setMessages([greeting]);
          }
        }, 1000);
      }
    }
  }, [messages, walletAddress]);

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || !walletAddress) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // AI APIに送信（商品データと残高も含む）
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          message: userMessage.content,
          context: autoOpenContext,
          kodomiProfile: kodomiProfile,
          products: products || [],
          userBalance: userBalance || '0'
        })
      });

      if (!response.ok) {
        // エラーレスポンスの詳細を取得
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = errorData.error || JSON.stringify(errorData);
        } catch (e) {
          errorDetail = await response.text();
        }

        console.error('❌ API エラー詳細:', errorDetail);
        throw new Error(`API Error ${response.status}: ${errorDetail}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || '申し訳ございません。応答の生成に失敗しました。',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('❌ AI応答エラー:', error);

      // デバッグ用：エラー詳細をユーザーにも表示
      const errorDetail = error instanceof Error ? error.message : String(error);
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      const errorMessage: Message = {
        role: 'assistant',
        content: isDevelopment
          ? `🔧 デバッグモード\n\nエラー詳細:\n${errorDetail}\n\n原因の可能性：\n1. Vercel環境変数 OPENAI_API_KEY が未設定\n2. APIエンドポイントが正しくデプロイされていない\n3. OpenAI APIキーが無効`
          : '申し訳ございません。一時的にエラーが発生しました。\n\nブラウザのコンソールログ（F12キー）をご確認いただくか、しばらく経ってから再度お試しください。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Enterキーで送信
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // チャット履歴を削除
  const handleClearHistory = () => {
    if (!walletAddress) return;

    const confirmed = window.confirm('チャット履歴を削除しますか？\n\nこの操作は取り消せません。');
    if (!confirmed) return;

    const storageKey = `gifterra_chat_${walletAddress}`;
    localStorage.removeItem(storageKey);

    // チャット履歴削除中フラグを設定
    isClearing.current = true;

    // 初期メッセージにリセット
    const greeting: Message = {
      role: 'assistant',
      content: 'こんにちは！ギフティです。\n\n特典の受け取りに関するご質問や、おすすめの特典についてお答えします。お気軽にお声がけください。',
      timestamp: new Date()
    };
    setMessages([greeting]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 20,
        width: 380,
        height: 520,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/gifterra-logo.png"
            alt="GIFTERRA AI"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              GIFTERRA AI
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, color: '#fff' }}>
              サポートアシスタント
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleClearHistory}
            title="チャット履歴を削除"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            🗑️
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Kodomi プロファイル表示 */}
      {kodomiProfile && (
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            fontSize: 12,
            color: '#fff'
          }}
        >
          <div style={{ opacity: 0.8, marginBottom: 4 }}>
            貢献熱量: <strong>{kodomiProfile.heatLevel || '😊ライト'}</strong>
          </div>
          {kodomiProfile.combined?.engagementLevel && (
            <div style={{ opacity: 0.8 }}>
              エンゲージメント: <strong>{kodomiProfile.combined.engagementLevel}</strong>
            </div>
          )}
        </div>
      )}

      {/* メッセージエリア */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {/* ギフティからのメッセージにはLINE風のラベルを表示 */}
            {msg.role === 'assistant' && (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: 4,
                  marginLeft: 4
                }}
              >
                ギフティ
              </div>
            )}
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: 12,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                  : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {linkifyUrls(msg.content)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 14
              }}
            >
              <span className="typing-indicator">...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div
        style={{
          padding: 16,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)'
        }}
      >
        {!walletAddress ? (
          <div
            style={{
              padding: 12,
              textAlign: 'center',
              color: '#fff',
              opacity: 0.7,
              fontSize: 13
            }}
          >
            ウォレットを接続してください
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                outline: 'none'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              style={{
                padding: '10px 16px',
                background: input.trim() && !isLoading
                  ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                  : 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                opacity: input.trim() && !isLoading ? 1 : 0.5
              }}
            >
              送信
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface GIFTERRAAIAssistantProps {
  // GIFT HUB商品データ（AIの提案用）
  products?: Array<{
    id: string;
    name: string;
    price_amount_wei: string;
    stock: number;
    is_unlimited: boolean;
    description?: string | null;
  }>;
  // ユーザーのトークン残高（Wei）
  userBalance?: string;
}

export function GIFTERRAAIAssistant({ products, userBalance }: GIFTERRAAIAssistantProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoOpenContext, setAutoOpenContext] = useState<'CLAIM_FAILED' | null>(null);
  const address = useAddress();

  // 特典受け取り失敗時の自動オープン
  useEffect(() => {
    const handleError = (event: CustomEvent) => {
      if (event.detail.type === 'CLAIM_FAILED') {
        setAutoOpenContext('CLAIM_FAILED');
        setIsOpen(true);
      }
    };

    window.addEventListener('gifterraError' as any, handleError);
    return () => window.removeEventListener('gifterraError' as any, handleError);
  }, []);

  // 閉じた時にコンテキストをリセット
  const handleClose = () => {
    setIsOpen(false);
    setAutoOpenContext(null);
  };

  return (
    <>
      {/* フローティングボタン */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            height: 50,
            borderRadius: 25,
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            zIndex: 9998,
            transition: 'transform 0.2s, box-shadow 0.2s',
            padding: '8px 20px 8px 12px',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2), 0 3px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)';
          }}
        >
          <img
            src="/gifterra-logo.png"
            alt="GIFTERRA AI"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          <span
            style={{
              color: '#2563EB',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.5
            }}
          >
            AIサポートアシスタント
          </span>
        </button>
      )}

      {/* チャットウィンドウ */}
      {isOpen && (
        <ChatWindow
          walletAddress={address}
          autoOpenContext={autoOpenContext}
          onClose={handleClose}
          products={products}
          userBalance={userBalance}
        />
      )}
    </>
  );
}
