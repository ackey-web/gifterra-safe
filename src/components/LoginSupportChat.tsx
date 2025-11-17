/**
 * @file ログインサポートチャット
 * @description ログインページ専用のサポートチャットボット
 */

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface LoginSupportChatProps {
  isMobile?: boolean;
}

export function LoginSupportChat({ isMobile = false }: LoginSupportChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期メッセージ
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'こんにちは！ログインでお困りですか？\n\nよくある質問:\n\n1️⃣ ログインできない\n2️⃣ ブラウザが対応していない\n3️⃣ ウォレット接続エラー\n4️⃣ Google/SNSログインができない\n\n番号を入力するか、直接質問してください！',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen]);

  // メッセージ追加時に自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自動応答ロジック
  const getAutoResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();

    // よくある質問の番号対応
    if (msg === '1' || msg.includes('ログインできない') || msg.includes('ログインエラー')) {
      return `ログインできない場合は、以下を確認してください：

✅ **推奨ブラウザを使用していますか？**
Safari または Chrome をご利用ください。

✅ **ポップアップブロックを解除していますか？**
ブラウザの設定でポップアップを許可してください。

✅ **キャッシュをクリアしてみましたか？**
ブラウザのキャッシュをクリアして再度お試しください。

✅ **それでも解決しない場合**
ページを再読み込み（リロード）してから、もう一度ログインしてみてください。`;
    }

    if (msg === '2' || msg.includes('ブラウザ') || msg.includes('対応')) {
      return `【推奨ブラウザ】

✅ **Safari**（iOS・Mac）
✅ **Chrome**（Android・Windows・Mac）

⚠️ **非推奨ブラウザ**
・Firefox
・Opera
・その他マイナーブラウザ

非推奨ブラウザでは、ログイン不可・送信画面が開かない等の問題が発生する可能性があります。

推奨ブラウザをご利用ください！`;
    }

    if (msg === '3' || msg.includes('ウォレット') || msg.includes('metamask') || msg.includes('接続エラー')) {
      return `ウォレット接続エラーの解決方法：

1️⃣ **ウォレットアプリがインストールされていますか？**
MetaMask等のウォレットアプリをインストールしてください。

2️⃣ **正しいネットワークを選択していますか？**
Polygon Mainnet を選択してください。

3️⃣ **ウォレットアプリを最新版に更新していますか？**
古いバージョンでは接続できない場合があります。

💡 **初めての方へ**
Google/SNSログイン（推奨）をご利用いただくと、ウォレットが自動生成されるため簡単です！`;
    }

    if (msg === '4' || msg.includes('google') || msg.includes('sns') || msg.includes('privy')) {
      return `Google/SNSログインのトラブルシューティング：

1️⃣ **ポップアップがブロックされていませんか？**
ブラウザのポップアップブロック設定を確認してください。

2️⃣ **Cookieが有効になっていますか？**
ブラウザのCookie設定を確認してください。

3️⃣ **プライベートブラウジングモードを使用していませんか？**
通常モードでお試しください。

4️⃣ **ログインボタンを押した後、何も表示されない場合**
ページを再読み込みして、もう一度お試しください。

それでも解決しない場合は、ウォレット接続でのログインもご検討ください。`;
    }

    // ガス代関連
    if (msg.includes('ガス代') || msg.includes('手数料') || msg.includes('コスト')) {
      return `ブロックチェーン手数料（ガス代）について：

💰 **Polygon Mainnetのガス代**
約0.01〜0.05円/回（非常に安価です）

💡 **ガス代支援サービス**
外部サイト「JPYCユーザーガス代支援」をご利用いただけます。

🎁 **初回送金時**
少額のMATICトークンがあれば送金可能です。
必要に応じて取引所から少額送金してください。

ガス代は送金・受取等のトランザクション時に必要ですが、ログインやプロフィール閲覧には不要です。`;
    }

    // セキュリティ関連
    if (msg.includes('安全') || msg.includes('セキュリティ') || msg.includes('秘密鍵')) {
      return `セキュリティについて：

🔒 **Gifterraは安全です**
・秘密鍵はあなたのデバイスにのみ保存されます
・当社がパスワードや秘密鍵を要求することはありません

⚠️ **絶対に秘密鍵を教えないでください**
・サポートを装った詐欺にご注意ください
・秘密鍵やリカバリーフレーズは誰にも教えてはいけません

✅ **Google/SNSログインの場合**
Privyによる安全な認証システムを使用しています。`;
    }

    // デフォルト応答
    return `申し訳ございません。その質問には自動で回答できません。

以下の番号から選択してください：

1️⃣ ログインできない
2️⃣ ブラウザが対応していない
3️⃣ ウォレット接続エラー
4️⃣ Google/SNSログインができない

または、別の言葉で質問してみてください。

💡 **ヒント**
「ログインできない」「ブラウザ」「ウォレット」「Google」などのキーワードで質問してみてください！`;
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // 自動応答
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAutoResponse(inputValue),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  return (
    <>
      {/* チャットボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: isMobile ? 20 : 30,
          right: isMobile ? 20 : 30,
          width: isMobile ? 56 : 64,
          height: isMobile ? 56 : 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: 'none',
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isMobile ? 24 : 28,
          zIndex: 9999,
          transition: 'all 0.3s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
        }}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* チャットウィンドウ */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 90 : 110,
            right: isMobile ? 20 : 30,
            width: isMobile ? 'calc(100vw - 40px)' : 380,
            height: isMobile ? 'calc(100vh - 180px)' : 500,
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9998,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: 16,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '16px 16px 0 0',
              color: 'white',
              fontWeight: 600,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>🤖</span>
            ログインサポート
          </div>

          {/* メッセージエリア */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background:
                      message.role === 'user'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'rgba(16, 185, 129, 0.1)',
                    color: message.role === 'user' ? 'white' : '#1f2937',
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.content}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#9ca3af',
                    marginTop: 4,
                    textAlign: message.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {message.timestamp.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div
            style={{
              padding: 16,
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              placeholder="メッセージを入力..."
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: inputValue.trim()
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#d1d5db',
                color: 'white',
                border: 'none',
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              送信
            </button>
          </div>
        </div>
      )}
    </>
  );
}
