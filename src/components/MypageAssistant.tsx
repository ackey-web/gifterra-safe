// src/components/MypageAssistant.tsx
// マイページ用AIアシスタント（FAQ・エラー対応・使い方ガイド）

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import giftyIcon from '../../public/GIFTY.icon.png';
import { callOpenAI, isAIAvailable, isOnline } from '../utils/openai';
import { useNewUserNotifications } from '../hooks/useNewUserNotifications';
import { getNotificationSettings } from '../utils/notificationSettings';
import type { UserRole } from '../types/profile';
import { ROLE_LABELS } from '../types/profile';

// ========================================
// 型定義
// ========================================

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface MypageAssistantProps {
  isMobile: boolean;
  walletAddress?: string;
  displayName?: string;
  userRoles?: UserRole[]; // 新規ユーザー通知用
}

// ========================================
// FAQ・ガイドデータベース
// ========================================

const FAQ_DATABASE = {
  // プロフィール関連
  profile: {
    keywords: ['プロフィール', 'アイコン', '画像', '編集', '変更', 'カバー', 'ロール'],
    responses: [
      {
        trigger: ['プロフィール', '編集'],
        answer: 'プロフィールの編集は、マイページ右上の「✏️ プロフィール編集」ボタンから行えます。\n\n編集できる項目:\n• プロフィール画像\n• カバー画像\n• 表示名\n• 自己紹介（140文字）\n• ロール（複数選択可）\n• Webサイト/SNSリンク\n• 所在地',
      },
      {
        trigger: ['画像', 'アイコン', 'アップロード'],
        answer: '画像のアップロード方法:\n\n1. プロフィール編集画面を開く\n2. 画像をクリック\n3. ファイルを選択（JPG, PNG, GIF, WebP）\n4. 最大5MB（プロフィール画像）、10MB（カバー画像）\n\n※アップロードに失敗する場合は、画像サイズを確認してください。',
      },
      {
        trigger: ['ロール', '役割'],
        answer: 'ロールは複数選択できます:\n\n• クリエイター\n• 店舗\n• イベント主催\n• コミュニティ\n• アーティスト\n• プロジェクトオーナー\n• メタバーススペース\n• 開発者\n• ファン\n\nあなたの活動に合ったロールを選んでください！',
      },
    ],
  },

  // チップ機能関連
  tips: {
    keywords: ['チップ', '送金', 'JPYC', '送る', '受け取る', 'メッセージ'],
    responses: [
      {
        trigger: ['チップ', '送る', '送金'],
        answer: 'チップの送り方:\n\n1. 送りたい相手のプロフィールページへ移動\n2. 「💝 チップを送る」ボタンをクリック\n3. 金額を選択（50/100/500/1000/3000 JPYC）\n4. ウォレットで承認\n5. 完了！相手にメッセージが届きます',
      },
      {
        trigger: ['受け取り', 'メッセージ'],
        answer: '受け取り時メッセージの設定:\n\n1. プロフィール編集画面を開く\n2. 「受け取り時メッセージ」欄に入力\n3. 最大100文字まで設定可能\n4. チップをもらった際に、送信者に表示されます\n\n例: 「ありがとうございました！」',
      },
    ],
  },

  // セキュリティ関連
  security: {
    keywords: ['凍結', '制限', 'エラー', '送信できない', 'セキュリティ'],
    responses: [
      {
        trigger: ['凍結', '制限'],
        answer: 'アカウントが凍結されている場合:\n\n• 不正利用の疑いがある場合に自動凍結されます\n• 管理者に問い合わせてください\n• 詳細な理由は通知メッセージに記載されています',
      },
      {
        trigger: ['送信できない', 'エラー'],
        answer: '送信エラーの原因:\n\n1. トランザクション制限超過\n   • 1回の上限: 100,000 JPYC\n   • 1時間の上限: 100,000 JPYC\n   • 1日の上限: 500,000 JPYC\n\n2. 残高不足\n   • JPYCの残高を確認してください\n\n3. ネットワークエラー\n   • 時間をおいて再試行してください',
      },
      {
        trigger: ['高額', '確認'],
        answer: '高額送金の追加確認:\n\n50,000 JPYC以上の送金には追加の確認画面が表示されます。\n\nこれはセキュリティ機能で:\n• 誤送信の防止\n• 不正利用の検知\n• 高額取引の保護\n\nを目的としています。',
      },
    ],
  },

  // 設定関連
  settings: {
    keywords: ['設定', 'ログアウト', '退会', 'ウォレット', '履歴'],
    responses: [
      {
        trigger: ['設定', '⚙️'],
        answer: '設定メニュー:\n\nマイページ右上の「⚙️」ボタンから:\n• ログイン履歴\n• ログアウト\n• アカウント削除\n\nにアクセスできます。',
      },
      {
        trigger: ['ログアウト'],
        answer: 'ログアウト方法:\n\n1. 右上の「⚙️」をクリック\n2. 「ログアウト」ボタンをクリック\n3. 再度ログインする場合はウォレット接続から',
      },
      {
        trigger: ['退会', '削除'],
        answer: 'アカウント削除について:\n\n⚠️ 重要な注意事項:\n• プロフィール情報が削除されます\n• 送受信履歴は残ります（ブロックチェーン上）\n• 削除後は復元できません\n\n削除は設定メニューの最下部から行えます。',
      },
    ],
  },

  // ウォレット接続トラブル
  wallet: {
    keywords: ['ウォレット', '接続', '繋がらない', 'ネットワーク', 'チェーン', '表示されない', '生成', '作成'],
    responses: [
      {
        trigger: ['接続できない', '繋がらない', '接続エラー'],
        answer: 'ウォレット接続エラーの対処法:\n\n1. ページを再読み込み\n   • F5キーまたは更新ボタン\n\n2. ブラウザのキャッシュをクリア\n   • Ctrl+Shift+Delete（Windows）\n   • Cmd+Shift+Delete（Mac）\n\n3. 別のブラウザを試す\n   • Chrome、Edge、Braveを推奨\n\n4. ウォレット拡張機能を再インストール\n   • MetaMaskなどを一度削除して再インストール\n\n5. ブロックチェーンRPCの混雑\n   • 時間をおいて再試行',
      },
      {
        trigger: ['ウォレット', '生成', '作成'],
        answer: 'ウォレットが生成されない場合:\n\n🔧 Privyウォレット（埋め込み）の場合:\n1. ポップアップブロッカーを無効化\n2. プライベートモード/シークレットモードを終了\n3. ブラウザのCookieを有効化\n4. ページを再読み込み\n\n🔧 MetaMaskなどの外部ウォレット:\n1. 拡張機能が正しくインストールされているか確認\n2. ウォレットのロックを解除\n3. Gifterraへの接続を承認\n\n💡 それでも解決しない場合:\nログアウトして再度ログインしてみてください',
      },
      {
        trigger: ['ネットワーク', 'チェーン', '正しくない'],
        answer: 'ネットワーク/チェーンが正しく表示されない:\n\n✅ 正しいネットワーク:\n• Polygon Mainnet（Chain ID: 137）\n\n🔄 切り替え方法:\n\n【MetaMaskの場合】\n1. MetaMaskを開く\n2. 上部のネットワーク名をクリック\n3. 「Polygon Mainnet」を選択\n4. 表示されない場合は手動追加:\n   • ネットワーク名: Polygon Mainnet\n   • RPC URL: https://polygon-rpc.com\n   • Chain ID: 137\n   • 通貨記号: MATIC\n\n【Privyウォレットの場合】\n• 自動的にPolygon Mainnetに設定されます\n• 表示が異なる場合はページを再読み込み\n\n⚠️ 注意: テストネットではJPYCの送受信はできません',
      },
      {
        trigger: ['残高', '表示', '反映'],
        answer: '残高が正しく表示されない:\n\n🔄 対処法:\n\n1. ページを再読み込み（F5）\n\n2. ウォレットを再接続\n   • 一度ログアウト\n   • 再度ログイン\n\n3. トランザクションの確認\n   • PolygonScanで確認:\n     https://polygonscan.com/\n   • ウォレットアドレスで検索\n\n4. ブロックチェーンの遅延\n   • 混雑時は反映に数分かかる場合があります\n\n5. 正しいネットワークか確認\n   • Polygon Mainnet（Chain ID: 137）になっているか',
      },
      {
        trigger: ['MetaMask', 'メタマスク'],
        answer: 'MetaMask接続のトラブルシューティング:\n\n🦊 よくある問題:\n\n1. 「リクエストが保留中」\n   • MetaMaskのポップアップを確認\n   • ブラウザの別タブで開いている可能性\n\n2. 「接続を拒否されました」\n   • MetaMaskで「接続」を承認\n   • サイトの接続をリセット:\n     設定 → 接続済みサイト → Gifterra削除 → 再接続\n\n3. 「署名エラー」\n   • トランザクションを承認\n   • ガス代（MATIC）が不足していないか確認\n\n4. 複数アカウント\n   • MetaMaskで正しいアカウントを選択\n\n💡 完全リセット方法:\n1. MetaMaskでGifterraの接続を解除\n2. ページを再読み込み\n3. 再度ウォレット接続',
      },
    ],
  },

  // その他
  general: {
    keywords: ['使い方', 'ヘルプ', '始め方', 'とは'],
    responses: [
      {
        trigger: ['使い方', '始め方'],
        answer: 'Gifterraの使い方:\n\n1. プロフィールを設定\n   • 表示名や自己紹介を入力\n   • プロフィール画像をアップロード\n\n2. 他のユーザーを探す\n   • ダッシュボードでユーザー一覧を確認\n\n3. チップを送る\n   • 応援したいユーザーにチップ\n\n4. 自分も受け取る\n   • プロフィールを充実させて受け取りやすく',
      },
    ],
  },
};

// ========================================
// インテント分析（キーワードマッチング）
// ========================================

function analyzeIntent(message: string): AssistantMessage | null {
  const lowerMessage = message.toLowerCase();

  // 全カテゴリーを検索
  for (const category of Object.values(FAQ_DATABASE)) {
    for (const faq of category.responses) {
      // トリガーワードに一致するかチェック
      const matched = faq.trigger.some(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
      );

      if (matched) {
        return {
          id: `faq-${Date.now()}`,
          role: 'assistant',
          content: faq.answer,
          timestamp: new Date(),
        };
      }
    }
  }

  return null;
}

// ========================================
// デフォルトレスポンス
// ========================================

function getDefaultResponse(): AssistantMessage {
  return {
    id: `default-${Date.now()}`,
    role: 'assistant',
    content: '申し訳ございません、その質問には対応できませんでした。\n\n以下のトピックからお選びください:',
    timestamp: new Date(),
    suggestions: [
      '🔌 ウォレット接続エラー',
      '📝 プロフィールの編集方法',
      '💝 チップの送り方',
      '🔒 セキュリティについて',
    ],
  };
}

// ========================================
// メインコンポーネント
// ========================================

export function MypageAssistant({ isMobile, walletAddress, displayName, userRoles }: MypageAssistantProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 新規ユーザー通知フック
  const notificationSettings = getNotificationSettings();
  useNewUserNotifications({
    myRoles: userRoles,
    enabled: notificationSettings.newUserWithSameRole && isOpen,
    onNewUser: (notification) => {
      const roleNames = notification.commonRoles.map(r => ROLE_LABELS[r]).join('、');

      const notificationMessage: AssistantMessage = {
        id: notification.id,
        role: 'assistant',
        content: `🎉 新しい${roleNames}の仲間が登録しました！\n\n` +
                 `表示名: ${notification.displayName}\n` +
                 `共通ロール: ${roleNames}\n\n` +
                 `同じ活動をしている仲間が増えました！\nプロフィールを見に行ってフォローしてみませんか？`,
        timestamp: notification.timestamp,
      };

      setMessages(prev => [...prev, notificationMessage]);
    },
  });

  // 初回メッセージ
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = displayName ? `${displayName}さん` : 'こんにちは';
      const initialMessage: AssistantMessage = {
        id: 'initial',
        role: 'assistant',
        content: `${greeting}！\n\n私はGIFTERRAアシスタントのギフティです\n使い方やエラーでお困りのことはありませんか？`,
        timestamp: new Date(),
        suggestions: [
          '🔌 ウォレット接続',
          '📝 プロフィール編集',
          '💝 チップの送り方',
          '⚙️ 設定',
        ],
      };
      setMessages([initialMessage]);
    }
  }, []);

  // スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // メッセージ送信（ハイブリッドFAQ+AI）
  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    // ユーザーメッセージを追加
    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const userInput = inputValue.trim();
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // 1. まずFAQで回答を探す（高速・無料）
    const faqResponse = analyzeIntent(userInput);

    if (faqResponse) {
      // FAQで回答が見つかった場合
      setTimeout(() => {
        setMessages(prev => [...prev, faqResponse]);
        setIsTyping(false);
      }, 800);
      return;
    }

    // 2. FAQに無い質問 → AI使用（オンラインの場合のみ）
    if (isAIAvailable()) {
      try {
        const aiResult = await callOpenAI({
          userMessage: userInput,
          context: 'マイページでのユーザーサポート',
          walletAddress,
          displayName,
        });

        if (aiResult.success && aiResult.content) {
          // AI回答を表示
          const aiMessage: AssistantMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: aiResult.content,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsTyping(false);
        } else {
          // AIエラー時はデフォルト応答
          const errorMessage: AssistantMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `申し訳ありません。AIが一時的に利用できません。\n\n${aiResult.error || 'もう一度お試しください。'}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsTyping(false);
        }
      } catch (error) {
        // ネットワークエラー等
        const errorMessage: AssistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: 'ネットワークエラーが発生しました。接続を確認してください。',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
      }
    } else {
      // 3. オフライン時はデフォルト応答
      setTimeout(() => {
        const offlineMessage: AssistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: isOnline()
            ? getDefaultResponse().content
            : '現在オフラインです。よくある質問に該当しない場合は、オンライン時に再度お試しください。\n\n' + getDefaultResponse().content,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, offlineMessage]);
        setIsTyping(false);
      }, 800);
    }
  };

  // 提案クリック
  const handleSuggestionClick = (suggestion: string) => {
    const query = suggestion.replace(/^[📝💝🔒⚙️]\s/, '');
    setInputValue(query);
    handleSend();
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 20 : 20,
      left: isMobile ? 20 : 'auto',
      right: isMobile ? 'auto' : 20,
      zIndex: 10001,
    }}>
      {/* GIFTY フローティングボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: isMobile ? 56 : 64,
          height: isMobile ? 56 : 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          transform: isOpen ? 'scale(0.9)' : 'scale(1)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = isOpen ? 'scale(0.9)' : 'scale(1)'; }}
      >
        <img
          src={giftyIcon}
          alt="GIFTY"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </button>

      {/* チャットパネル */}
      {isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: isMobile ? '50%' : '50%',
            left: isMobile ? '50%' : 'auto',
            right: isMobile ? 'auto' : 20,
            transform: isMobile ? 'translate(-50%, -50%)' : 'translateY(-50%)',
            width: isMobile ? 'calc(100vw - 40px)' : 420,
            maxWidth: isMobile ? '90vw' : '420px',
            height: isMobile ? 'calc(100vh - 100px)' : 'auto',
            maxHeight: isMobile ? 'calc(100vh - 100px)' : '80vh',
            background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
            borderRadius: 20,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            zIndex: 10002,
          }}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: isMobile ? 16 : 20,
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                <img
                  src={giftyIcon}
                  alt="GIFTY"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>ギフティ</div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)' }}>GIFTERRA アシスタント</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
            >
              ✕
            </button>
          </div>

          {/* メッセージエリア */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? 16 : 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: '#1a1a24',
            }}
          >
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: message.role === 'assistant'
                        ? 'linear-gradient(135deg, #667eea, #764ba2)'
                        : 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                      overflow: 'hidden',
                      padding: 0,
                    }}
                  >
                    {message.role === 'assistant' ? (
                      <img
                        src={giftyIcon}
                        alt="GIFTY"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : '👤'}
                  </div>
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: 12,
                      borderRadius: 16,
                      background: message.role === 'assistant'
                        ? 'rgba(102, 126, 234, 0.1)'
                        : 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#EAF2FF',
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      border: message.role === 'assistant' ? '1px solid rgba(102, 126, 234, 0.3)' : 'none',
                    }}
                  >
                    {message.content}
                  </div>
                </div>

                {/* 提案ボタン */}
                {message.suggestions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, marginLeft: 40 }}>
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        style={{
                          padding: 10,
                          background: 'rgba(102, 126, 234, 0.1)',
                          border: '1px solid rgba(102, 126, 234, 0.3)',
                          borderRadius: 12,
                          color: '#93c5fd',
                          fontSize: 13,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* タイピング中 */}
            {isTyping && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={giftyIcon} alt="Gifty" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: 12, borderRadius: 16, background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.3)', display: 'flex', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#93c5fd', animation: 'pulse 1.4s infinite' }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#93c5fd', animation: 'pulse 1.4s infinite 0.2s' }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#93c5fd', animation: 'pulse 1.4s infinite 0.4s' }}></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div
            style={{
              padding: isMobile ? 12 : 16,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: 8,
              background: '#1a1a24',
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="質問を入力..."
              disabled={isTyping}
              style={{
                flex: 1,
                padding: isMobile ? 10 : 12,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                color: '#EAF2FF',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                background: inputValue.trim() && !isTyping
                  ? 'linear-gradient(135deg, #667eea, #764ba2)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 12,
                color: '#EAF2FF',
                fontSize: 14,
                fontWeight: 600,
                cursor: inputValue.trim() && !isTyping ? 'pointer' : 'not-allowed',
                opacity: inputValue.trim() && !isTyping ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              送信
            </button>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
