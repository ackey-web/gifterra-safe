/**
 * @file ログインサポートチャット
 * @description ログインページ専用のサポートチャットボット（ギフティアシスタント）
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import giftyIcon from '../../public/GIFTY.icon.png';

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
          content: 'こんにちは！\n\n私はGIFTERRAアシスタントのギフティです\nログインでお困りのことはありませんか？\n\nよくある質問:\n\n1️⃣ ログインできない\n2️⃣ ブラウザが対応していない\n3️⃣ ウォレット接続エラー\n4️⃣ Google/SNSログインができない\n\n番号を入力するか、直接質問してください！',
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
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 20 : 20,
      left: isMobile ? 20 : 'auto',
      right: isMobile ? 'auto' : 20,
      zIndex: 10001,
    }}>
      {/* ギフティ フローティングボタン */}
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
          alt="ギフティ"
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
                  alt="ギフティ"
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
                        alt="ギフティ"
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
              </div>
            ))}
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
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="質問を入力..."
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
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                background: inputValue.trim()
                  ? 'linear-gradient(135deg, #667eea, #764ba2)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 12,
                color: '#EAF2FF',
                fontSize: 14,
                fontWeight: 600,
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                opacity: inputValue.trim() ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              送信
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
