// src/components/TransferMessageHistory.tsx
// 送金メッセージ受信履歴コンポーネント

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  useReceivedTransferMessages,
  markMessageAsRead,
  markMultipleMessagesAsRead,
  addMessageReaction,
  removeMessageReaction,
  getMessageReactions,
  createReactionNotification,
  type TransferMessage,
  type MessageReaction,
} from '../hooks/useTransferMessages';
import { setAppBadge, sendJpycReceivedNotification } from '../utils/pushNotifications';

interface TransferMessageHistoryProps {
  tenantId: string | undefined;
  walletAddress: string | undefined;
  isMobile: boolean;
  onUnreadCountChange?: (count: number) => void;
}

export function TransferMessageHistory({
  tenantId,
  walletAddress,
  isMobile,
  onUnreadCountChange,
}: TransferMessageHistoryProps) {
  const { messages: fetchedMessages, isLoading, error } = useReceivedTransferMessages(tenantId, walletAddress);
  const [messages, setMessages] = useState<TransferMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<TransferMessage | null>(null);
  const [showProfileBio, setShowProfileBio] = useState(false);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [isReacting, setIsReacting] = useState(false);
  const [activeTab, setActiveTab] = useState<'gifterra' | 'all'>('all'); // タブ状態
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const previousMessageIdsRef = useRef<Set<string>>(new Set());

  // フックから取得したメッセージをローカル状態にコピー & 新規受信を検出
  useEffect(() => {
    if (fetchedMessages.length > 0) {
      // 新規メッセージを検出（初回ロード時は除外）
      if (previousMessageIdsRef.current.size > 0) {
        const newMessages = fetchedMessages.filter(
          (msg) => !previousMessageIdsRef.current.has(msg.id) && msg.source === 'blockchain'
        );

        // 新規ブロックチェーン受信があればプッシュ通知とバッジを更新
        newMessages.forEach((msg) => {
          sendJpycReceivedNotification(
            msg.amount,
            msg.from_address,
            msg.sender_profile?.name
          );
        });
      }

      // メッセージIDのセットを更新
      previousMessageIdsRef.current = new Set(fetchedMessages.map((m) => m.id));
      setMessages(fetchedMessages);
    }
  }, [fetchedMessages]);

  // 未読数が変わったら親に通知 & アプリバッジを更新
  useEffect(() => {
    const unreadCount = messages.filter(m => !m.is_read).length;
    onUnreadCountChange?.(unreadCount);

    // PWA/アプリアイコンのバッジを更新
    setAppBadge(unreadCount);
  }, [messages, onUnreadCountChange]);

  // アドレスを短縮表示する関数
  const shortenAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // メッセージを短縮表示する関数（30文字まで）
  const shortenMessage = (message: string | undefined): string => {
    if (!message) return '';
    if (message.length <= 30) return message;
    return `${message.slice(0, 30)}...`;
  };

  // 相対時刻を表示する関数（date-fnsの代わりにシンプルな実装）
  // Note: dateStringはISO 8601形式のタイムスタンプ（DBからTIMESTAMPTZとして取得）
  // new Date()は自動的にタイムゾーンを考慮してローカル時刻に変換する
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;

    // 1週間以上前は日付表示
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // モーダルを開く
  const handleOpenModal = async (message: TransferMessage) => {
    setSelectedMessage(message);
    setShowProfileBio(false);

    // 未読の場合は既読にする
    if (!message.is_read) {
      try {
        // データベースを更新（ブロックチェーントランザクションの場合はlocalStorageに保存）
        await markMessageAsRead(message.id, walletAddress);

        // ローカル状態を即座に更新（リアルタイム更新を待たずに反映）
        setMessages(prevMessages =>
          prevMessages.map(m =>
            m.id === message.id ? { ...m, is_read: true } : m
          )
        );
      } catch (err) {
        console.error('❌ Failed to mark message as read:', err);
      }
    }

    // リアクションを取得
    try {
      const messageReactions = await getMessageReactions(message.id);
      setReactions(messageReactions);
    } catch (err) {
      console.error('Failed to load reactions:', err);
      setReactions([]);
    }
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setSelectedMessage(null);
    setShowProfileBio(false);
    setReactions([]);
  };

  // タブをクリックしたときに未読メッセージを一括既読にする
  const handleTabClick = async (tab: 'gifterra' | 'all') => {
    setActiveTab(tab);

    // 未読メッセージがあれば一括既読にする
    const unreadMessages = messages.filter(m => !m.is_read);
    if (unreadMessages.length > 0) {
      try {
        await markMultipleMessagesAsRead(unreadMessages, walletAddress);

        // ローカル状態を即座に更新
        setMessages(prevMessages =>
          prevMessages.map(m => ({ ...m, is_read: true }))
        );
      } catch (err) {
        console.error('❌ Failed to mark messages as read:', err);
      }
    }
  };

  // スワイプ開始
  const handleSwipeStart = (messageId: string) => {
    setSwipingMessageId(messageId);
    setSwipeOffset(0);
  };

  // スワイプ中
  const handleSwipeMove = (clientX: number, startX: number) => {
    if (!swipingMessageId) return;
    const diff = clientX - startX;
    // 左スワイプのみ許可（負の値）、最大80pxまで
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -80));
    }
  };

  // スワイプ終了
  const handleSwipeEnd = async (message: TransferMessage) => {
    if (!swipingMessageId) return;

    // 50px以上スワイプしたら既読にする
    if (swipeOffset < -50 && !message.is_read) {
      try {
        await markMessageAsRead(message.id, walletAddress);

        // ローカル状態を即座に更新
        setMessages(prevMessages =>
          prevMessages.map(m =>
            m.id === message.id ? { ...m, is_read: true } : m
          )
        );
      } catch (err) {
        console.error('❌ Failed to mark message as read:', err);
      }
    }

    // スワイプ状態をリセット
    setSwipingMessageId(null);
    setSwipeOffset(0);
  };

  // リアクションをトグル
  const handleToggleReaction = async () => {
    if (!selectedMessage || !walletAddress || isReacting) return;

    setIsReacting(true);

    try {
      // 既にリアクションしているかチェック
      const hasReacted = reactions.some(
        (r) => r.reactor_address.toLowerCase() === walletAddress.toLowerCase()
      );

      if (hasReacted) {
        // リアクションを削除
        await removeMessageReaction({
          messageId: selectedMessage.id,
          reactorAddress: walletAddress,
        });

        // ローカル状態を更新
        setReactions((prev) =>
          prev.filter((r) => r.reactor_address.toLowerCase() !== walletAddress.toLowerCase())
        );
      } else {
        // リアクションを追加
        const newReaction = await addMessageReaction({
          messageId: selectedMessage.id,
          reactorAddress: walletAddress,
        });

        // ローカル状態を更新
        setReactions((prev) => [newReaction, ...prev]);

        // 送信者に通知を送る
        try {
          await createReactionNotification({
            messageId: selectedMessage.id,
            reactorAddress: walletAddress,
            senderAddress: selectedMessage.from_address,
          });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
      alert('リアクションの処理に失敗しました');
    } finally {
      setIsReacting(false);
    }
  };

  // ローディング状態
  if (isLoading) {
    return (
      <div
        style={{
          padding: isMobile ? 16 : 24,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.7)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            margin: '0 auto',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: 16, fontSize: isMobile ? 14 : 15 }}>
          読み込み中...
        </p>
      </div>
    );
  }

  // エラー状態
  if (error) {
    return (
      <div
        style={{
          padding: isMobile ? 16 : 24,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 12,
          color: '#fca5a5',
          fontSize: isMobile ? 14 : 15,
          textAlign: 'center',
        }}
      >
        メッセージの読み込みに失敗しました
      </div>
    );
  }

  // タブに応じてメッセージをフィルタリング
  const filteredMessages = activeTab === 'gifterra'
    ? messages.filter(m => m.source === 'gifterra')
    : messages;

  // 各タブの未読数を計算
  const unreadCountAll = messages.filter(m => !m.is_read).length;
  const unreadCountGifterra = messages.filter(m => !m.is_read && m.source === 'gifterra').length;

  return (
    <>
      {/* CSSアニメーション */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* タブUI */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <button
          onClick={() => handleTabClick('all')}
          style={{
            padding: isMobile ? '8px 16px' : '10px 20px',
            background: activeTab === 'all'
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'all'
              ? '2px solid #667eea'
              : '2px solid transparent',
            color: activeTab === 'all' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderRadius: '8px 8px 0 0',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'all') {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'all') {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }
          }}
        >
          全履歴 ({messages.length})
          {unreadCountAll > 0 && (
            <span
              style={{
                position: 'absolute',
                top: isMobile ? 4 : 6,
                right: isMobile ? 4 : 6,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              }}
            >
              {unreadCountAll}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabClick('gifterra')}
          style={{
            padding: isMobile ? '8px 16px' : '10px 20px',
            background: activeTab === 'gifterra'
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'gifterra'
              ? '2px solid #667eea'
              : '2px solid transparent',
            color: activeTab === 'gifterra' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderRadius: '8px 8px 0 0',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'gifterra') {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'gifterra') {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }
          }}
        >
          Gifterra内 ({messages.filter(m => m.source === 'gifterra').length})
          {unreadCountGifterra > 0 && (
            <span
              style={{
                position: 'absolute',
                top: isMobile ? 4 : 6,
                right: isMobile ? 4 : 6,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              }}
            >
              {unreadCountGifterra}
            </span>
          )}
        </button>
      </div>

      {/* 履歴カードリスト（スクロール可能） */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 6 : 8,
          // 5件分の固定高さ (モバイル: (50+6)*5-6 = 274px, PC: (60+8)*5-8 = 332px)
          height: isMobile ? '274px' : '332px',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4,
          WebkitOverflowScrolling: 'touch', // iOS向けスムーズスクロール
        }}
      >
        {filteredMessages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <div style={{ fontSize: isMobile ? 32 : 40, marginBottom: 8 }}>
              📭
            </div>
            <p style={{ margin: 0, fontSize: isMobile ? 13 : 14 }}>
              {activeTab === 'gifterra'
                ? 'Gifterra内の受信履歴はまだありません'
                : '受信したメッセージはまだありません'}
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => {
            const isCurrentlySwiping = swipingMessageId === message.id;
            const currentSwipeOffset = isCurrentlySwiping ? swipeOffset : 0;

            return (
              <div
                key={message.id}
                style={{
                  position: 'relative',
                  flexShrink: 0, // カードが縮小されないようにする
                  overflow: 'hidden', // スワイプ機能のために必要
                }}
              >
                {/* スワイプ時の背景（既読アイコン） */}
                {isCurrentlySwiping && currentSwipeOffset < 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: Math.abs(currentSwipeOffset),
                      background: currentSwipeOffset < -50
                        ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.6))'
                        : 'linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.4))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 16,
                      fontSize: 20,
                      transition: 'background 0.2s',
                    }}
                  >
                    {currentSwipeOffset < -50 ? '✓' : '←'}
                  </div>
                )}

                <div
                  onClick={() => handleOpenModal(message)}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const touch = e.touches[0];
                    handleSwipeStart(message.id);
                    (e.currentTarget as any)._startX = touch.clientX;
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const startX = (e.currentTarget as any)._startX || touch.clientX;
                    handleSwipeMove(touch.clientX, startX);
                    if (swipingMessageId) {
                      e.preventDefault();
                    }
                  }}
                  onTouchEnd={() => handleSwipeEnd(message)}
                  onMouseDown={(e) => {
                    handleSwipeStart(message.id);
                    (e.currentTarget as any)._startX = e.clientX;
                    (e.currentTarget as any)._isDragging = true;
                  }}
                  onMouseMove={(e) => {
                    if ((e.currentTarget as any)._isDragging) {
                      const startX = (e.currentTarget as any)._startX || e.clientX;
                      handleSwipeMove(e.clientX, startX);
                    }
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as any)._isDragging = false;
                    handleSwipeEnd(message);
                  }}
                  onMouseLeave={(e) => {
                    if ((e.currentTarget as any)._isDragging) {
                      (e.currentTarget as any)._isDragging = false;
                      handleSwipeEnd(message);
                    } else if (!isCurrentlySwiping) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: isMobile ? '8px 10px' : '10px 12px',
                    transition: isCurrentlySwiping ? 'none' : 'all 0.2s',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 8 : 10,
                    minHeight: isMobile ? 50 : 60,
                    transform: `translateX(${currentSwipeOffset}px)`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentlySwiping) {
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                    }
                  }}
                >
                  {/* 未読バッジ */}
                  {!message.is_read && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#3b82f6',
                        boxShadow: '0 0 8px #3b82f6',
                      }}
                    />
                  )}

                  {/* アバター */}
                  <div
                    style={{
                      width: isMobile ? 36 : 42,
                      height: isMobile ? 36 : 42,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: message.is_anonymous || !message.sender_profile?.icon_url
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? 18 : 20,
                      flexShrink: 0,
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {message.is_anonymous ? (
                      '🕶️'
                    ) : message.sender_profile?.icon_url ? (
                      <img
                        src={message.sender_profile.icon_url}
                        alt="送信者"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      '👤'
                    )}
                  </div>

                  {/* メイン情報（送信者名・時刻・メッセージ） */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {/* 送信者名と時刻 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'nowrap',
                      }}
                    >
                      <div
                        style={{
                          fontSize: isMobile ? 13 : 14,
                          fontWeight: 600,
                          color: '#EAF2FF',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {message.is_anonymous ? (
                          <>
                            <span>🕶️</span>
                            <span style={{ opacity: 0.7 }}>匿名ユーザー</span>
                          </>
                        ) : (
                          message.sender_profile?.name || '匿名ユーザー'
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: isMobile ? 11 : 12,
                          color: 'rgba(255, 255, 255, 0.5)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {getRelativeTime(message.created_at)}
                      </div>
                    </div>

                    {/* メッセージプレビュー */}
                    {message.message && (
                      <div
                        style={{
                          fontSize: isMobile ? 12 : 13,
                          color: 'rgba(255, 255, 255, 0.7)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {shortenMessage(message.message)}
                      </div>
                    )}
                  </div>

                  {/* 送金額 */}
                  <div
                    style={{
                      fontSize: isMobile ? 16 : 18,
                      fontWeight: 700,
                      color: '#667eea',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {parseFloat(message.amount).toLocaleString('ja-JP', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2
                    })} {message.token_symbol}
                  </div>

                  {/* アクションボタン */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {/* Polygonscanリンク（匿名送金の場合は非表示） */}
                    {message.tx_hash && !message.is_anonymous && (
                      <a
                        href={`https://polygonscan.com/tx/${message.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          width: isMobile ? 28 : 32,
                          height: isMobile ? 28 : 32,
                          background: 'rgba(139, 92, 246, 0.1)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: 6,
                          color: '#c4b5fd',
                          fontSize: isMobile ? 14 : 16,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                        }}
                        title="Polygonscanで確認"
                      >
                        ↗
                      </a>
                    )}

                    {/* メッセージ詳細ボタン */}
                    {message.source !== 'blockchain' && message.message && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(message);
                        }}
                        style={{
                          width: isMobile ? 28 : 32,
                          height: isMobile ? 28 : 32,
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: 6,
                          color: '#93c5fd',
                          fontSize: isMobile ? 14 : 16,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          padding: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        }}
                        title="メッセージを見る"
                      >
                        💬
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* メッセージ詳細モーダル */}
      {selectedMessage &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1000000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isMobile ? 16 : 24,
            }}
            onClick={handleCloseModal}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
                borderRadius: isMobile ? 16 : 24,
                maxWidth: isMobile ? '100%' : 500,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* モーダルヘッダー */}
              <div
                style={{
                  padding: isMobile ? 20 : 24,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 18 : 20,
                    fontWeight: 700,
                    color: '#EAF2FF',
                  }}
                >
                  メッセージ詳細
                </h2>
                <button
                  onClick={handleCloseModal}
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

              {/* モーダルコンテンツ */}
              <div style={{ padding: isMobile ? 20 : 24 }}>
                {/* 送信者情報 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {/* プロフィール画像（クリック可能 - プロフィールページに遷移） */}
                  <div
                    onClick={() => {
                      // 匿名送金の場合はプロフィールページに遷移しない
                      if (!selectedMessage.is_anonymous) {
                        window.location.href = `/profile/${selectedMessage.from_address}`;
                      }
                    }}
                    style={{
                      width: isMobile ? 60 : 70,
                      height: isMobile ? 60 : 70,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: selectedMessage.is_anonymous || !selectedMessage.sender_profile?.icon_url
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? 28 : 32,
                      cursor: selectedMessage.is_anonymous ? 'default' : 'pointer',
                      border: '3px solid rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedMessage.is_anonymous) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.6)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedMessage.is_anonymous) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }
                    }}
                    title={selectedMessage.is_anonymous ? undefined : "プロフィールを見る"}
                  >
                    {selectedMessage.is_anonymous ? (
                      '🕶️'
                    ) : selectedMessage.sender_profile?.icon_url ? (
                      <img
                        src={selectedMessage.sender_profile.icon_url}
                        alt="送信者"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      '👤'
                    )}
                  </div>

                  {/* 送信者名とアドレス */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: isMobile ? 16 : 18,
                        fontWeight: 600,
                        color: '#EAF2FF',
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {selectedMessage.is_anonymous ? (
                        <>
                          <span>🕶️</span>
                          <span style={{ opacity: 0.7 }}>匿名ユーザー</span>
                        </>
                      ) : (
                        selectedMessage.sender_profile?.name || '匿名ユーザー'
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? 12 : 13,
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {selectedMessage.is_anonymous ? '非公開' : shortenAddress(selectedMessage.from_address)}
                    </div>
                  </div>
                </div>

                {/* プロフィールbio（トグル展開） */}
                {showProfileBio && selectedMessage.sender_profile?.bio && (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: isMobile ? 12 : 16,
                      background: 'rgba(102, 126, 234, 0.1)',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: 8,
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: isMobile ? 13 : 14,
                      lineHeight: 1.6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: isMobile ? 11 : 12,
                        color: 'rgba(255, 255, 255, 0.6)',
                        marginBottom: 8,
                        fontWeight: 600,
                      }}
                    >
                      プロフィール
                    </div>
                    {selectedMessage.sender_profile.bio}
                  </div>
                )}

                {/* 送金情報 */}
                <div
                  style={{
                    marginBottom: 20,
                    padding: isMobile ? 16 : 20,
                    background: 'rgba(102, 126, 234, 0.05)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: isMobile ? 12 : 13,
                      color: 'rgba(255, 255, 255, 0.6)',
                      marginBottom: 8,
                    }}
                  >
                    送金額
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 28 : 32,
                      fontWeight: 700,
                      color: '#667eea',
                    }}
                  >
                    {selectedMessage.amount} {selectedMessage.token_symbol}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: isMobile ? 11 : 12,
                      color: 'rgba(255, 255, 255, 0.5)',
                    }}
                  >
                    {getRelativeTime(selectedMessage.created_at)}
                  </div>
                </div>

                {/* メッセージ全文 */}
                <div
                  style={{
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: isMobile ? 13 : 14,
                      color: 'rgba(255, 255, 255, 0.7)',
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    メッセージ
                  </div>
                  <div
                    style={{
                      padding: isMobile ? 14 : 16,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      color: '#EAF2FF',
                      fontSize: isMobile ? 14 : 15,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {selectedMessage.message}
                  </div>
                </div>

                {/* リアクションボタン（ギフテラ内のみ） */}
                {selectedMessage.source !== 'blockchain' && (
                  <div
                    style={{
                      marginBottom: 20,
                    }}
                  >
                    <button
                      onClick={handleToggleReaction}
                      disabled={isReacting}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 12px' : '8px 14px',
                        background: reactions.some(
                          (r) => r.reactor_address.toLowerCase() === walletAddress?.toLowerCase()
                        )
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : 'rgba(239, 68, 68, 0.1)',
                        border: reactions.some(
                          (r) => r.reactor_address.toLowerCase() === walletAddress?.toLowerCase()
                        )
                          ? 'none'
                          : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 20,
                        color: reactions.some(
                          (r) => r.reactor_address.toLowerCase() === walletAddress?.toLowerCase()
                        )
                          ? '#ffffff'
                          : '#fca5a5',
                        fontSize: isMobile ? 14 : 15,
                        fontWeight: 600,
                        cursor: isReacting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: isReacting ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isReacting) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <span style={{ fontSize: isMobile ? 16 : 18 }}>❤️</span>
                    </button>
                  </div>
                )}

                {/* ブロックチェーン送信の表示 */}
                {selectedMessage.source === 'blockchain' && (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: isMobile ? '10px 16px' : '12px 20px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 12,
                      fontSize: isMobile ? 13 : 14,
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    ギフテラ外からの送信
                  </div>
                )}

                {/* Polygonscanリンク（匿名送金の場合は非表示） */}
                {selectedMessage.tx_hash && !selectedMessage.is_anonymous && (
                  <a
                    href={`https://polygonscan.com/tx/${selectedMessage.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: isMobile ? '12px' : '14px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: 8,
                      color: '#c4b5fd',
                      fontSize: isMobile ? 14 : 15,
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <span>Polygonscanで確認</span>
                    <span style={{ fontSize: isMobile ? 16 : 18 }}>↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
