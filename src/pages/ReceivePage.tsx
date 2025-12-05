// src/pages/ReceivePage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ConnectWallet } from '@thirdweb-dev/react';
import { JPYC_TOKEN } from '../contract';
import { useMetaTags } from '../hooks/useMetaTags';

export function ReceivePage() {
  const [address, setAddress] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [bio, setBio] = useState<string>('');

  // URLパスまたはクエリパラメータからアドレスを取得（ログイン不要）
  useEffect(() => {
    // パスパラメータから取得: /receive/0x123...
    const pathParts = window.location.pathname.split('/');
    const addressFromPath = pathParts[pathParts.length - 1];

    // クエリパラメータから取得: /receive?address=0x123...
    const urlParams = new URLSearchParams(window.location.search);
    const addressFromQuery = urlParams.get('address');

    // パスパラメータを優先、次にクエリパラメータ
    const addressParam = addressFromPath && addressFromPath !== 'receive'
      ? addressFromPath
      : addressFromQuery;

    if (addressParam) {
      setAddress(addressParam);
    }
  }, []);

  useEffect(() => {
    // モバイル判定
    setIsMobile(window.innerWidth <= 768);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!address) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('display_name, avatar_url, bio')
          .eq('wallet_address', address.toLowerCase())
          .single();

        if (error) {
          console.error('❌ ReceivePage: Supabase error:', error);
          throw error;
        }

        if (data) {
          setDisplayName(data.display_name || '');
          setProfileImage(data.avatar_url || '');
          setBio(data.bio || '');
        }
      } catch (error) {
        console.error('❌ ReceivePage: Failed to fetch profile:', error);
      }
    };

    fetchProfile();
  }, [address]);

  // OGPメタタグを動的に設定
  useMetaTags({
    title: displayName ? `${displayName} - GIFTERRA` : 'GIFTERRA - WEB3.0 ギフティングプラットフォーム',
    description: bio || 'ブロックチェーン技術を活用したWEB3.0 ギフティングプラットフォーム',
    imageUrl: profileImage || 'https://gifterra-safe.vercel.app/someneGIFTERRA.png', // プロフィール画像を優先
    url: address ? `https://gifterra-safe.vercel.app/receive/${address}` : 'https://gifterra-safe.vercel.app',
    type: 'profile',
  });

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
      alert('コピーに失敗しました');
    }
  };

  // アドレスが指定されていない場合
  if (!address) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#1a1a1a', marginBottom: '16px', fontSize: 24 }}>
            ❌ アドレスが指定されていません
          </h1>
          <p style={{ color: '#4a5568', fontSize: 16 }}>
            URLパラメータにアドレスを指定してください
          </p>
          <p style={{ color: '#718096', fontSize: 12, marginTop: '16px', fontFamily: 'monospace' }}>
            例: /receive?address=0x123...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'url("/UI-back.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      padding: isMobile ? '8px' : '20px',
      position: 'relative',
    }}>
      {/* カード背後の光エフェクト - メイン */}
      <div style={{
        position: 'absolute',
        width: isMobile ? '280px' : '400px',
        height: isMobile ? '280px' : '400px',
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.15) 30%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'pulse 4s ease-in-out infinite',
        zIndex: 0,
      }} />

      {/* 回転する光のリング1 */}
      <div style={{
        position: 'absolute',
        width: isMobile ? '320px' : '450px',
        height: isMobile ? '320px' : '450px',
        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255, 255, 255, 0.2) 90deg, transparent 180deg, rgba(255, 255, 255, 0.2) 270deg, transparent 360deg)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        animation: 'rotate 8s linear infinite',
        zIndex: 0,
      }} />

      {/* 回転する光のリング2 (逆回転) */}
      <div style={{
        position: 'absolute',
        width: isMobile ? '300px' : '420px',
        height: isMobile ? '300px' : '420px',
        background: 'conic-gradient(from 90deg, transparent 0deg, rgba(255, 255, 255, 0.15) 60deg, transparent 120deg, rgba(255, 255, 255, 0.15) 240deg, transparent 300deg)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        animation: 'rotateReverse 10s linear infinite',
        zIndex: 0,
      }} />

      {/* キラキラエフェクト */}
      <div style={{
        position: 'absolute',
        width: isMobile ? '260px' : '380px',
        height: isMobile ? '260px' : '380px',
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 50%)',
        borderRadius: '50%',
        filter: 'blur(30px)',
        animation: 'sparkle 3s ease-in-out infinite',
        zIndex: 0,
      }} />

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.6;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.8;
            }
          }

          @keyframes rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes rotateReverse {
            from {
              transform: rotate(360deg);
            }
            to {
              transform: rotate(0deg);
            }
          }

          @keyframes sparkle {
            0%, 100% {
              opacity: 0.3;
              transform: scale(0.95);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.05);
            }
          }
        `}
      </style>

      <div style={{
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: isMobile ? '20px' : '28px',
        padding: isMobile ? '24px 20px' : '40px 32px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1), 0 0 60px rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* ヘッダー - GIFTERRAロゴ */}
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? '20px' : '28px',
        }}>
          <img
            src="/GIFTERRA.sidelogo.png"
            alt="GIFTERRA"
            style={{
              height: isMobile ? 40 : 52,
              opacity: 0.95,
            }}
          />
        </div>

        {/* プロフィール画像 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: isMobile ? '16px' : '24px',
        }}>
          <div
            onClick={() => {
              window.location.href = `/user/${address}`;
            }}
            style={{
              width: isMobile ? 110 : 150,
              height: isMobile ? 110 : 150,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid rgba(139, 92, 246, 0.6)',
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 92, 246, 0.6), 0 0 0 1px rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255,255,255,0.1)';
            }}
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{
                fontSize: isMobile ? 50 : 70,
              }}>
                👤
              </div>
            )}
          </div>
        </div>

        {/* 表示名 */}
        {displayName && (
          <div style={{
            textAlign: 'center',
            marginBottom: isMobile ? '12px' : '16px',
            fontSize: isMobile ? 18 : 24,
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {displayName}
          </div>
        )}

        {/* 自己紹介文 */}
        {bio && (
          <div style={{
            textAlign: 'center',
            marginBottom: isMobile ? '20px' : '28px',
            fontSize: isMobile ? 13 : 15,
            color: 'rgba(255, 255, 255, 0.75)',
            lineHeight: 1.6,
            padding: isMobile ? '12px 16px' : '16px 24px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: isMobile ? '12px' : '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            {bio}
          </div>
        )}

        {/* アドレス表示 (タップでコピー) */}
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            background: copySuccess
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(255, 255, 255, 0.08)',
            border: copySuccess
              ? '2px solid rgba(16, 185, 129, 0.5)'
              : '2px solid rgba(255, 255, 255, 0.15)',
            borderRadius: isMobile ? '14px' : '18px',
            padding: isMobile ? '14px' : '18px',
            marginBottom: isMobile ? '14px' : '20px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => {
            if (!copySuccess) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }
          }}
          onMouseLeave={(e) => {
            if (!copySuccess) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
          }}
        >
          <div style={{
            fontSize: isMobile ? 10 : 11,
            color: copySuccess ? 'rgba(16, 185, 129, 1)' : 'rgba(255, 255, 255, 0.6)',
            marginBottom: isMobile ? '8px' : '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            textAlign: 'left',
          }}>
            {copySuccess ? '✅ コピーしました！' : 'アドレス (タップでコピー)'}
          </div>
          <div style={{
            wordBreak: 'break-all',
            fontSize: isMobile ? 11 : 13,
            fontFamily: 'monospace',
            color: '#ffffff',
            fontWeight: 500,
            lineHeight: isMobile ? 1.4 : 1.6,
            padding: isMobile ? '10px' : '14px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: isMobile ? '8px' : '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'left',
          }}>
            {address}
          </div>
        </button>

        {/* GIFTERRAを使って贈るボタン */}
        <a
          href={`/login?recipient=${address}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '8px' : '10px',
            width: '100%',
            padding: isMobile ? '14px' : '18px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(109, 40, 217, 0.9) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.5)',
            borderRadius: isMobile ? '12px' : '16px',
            color: '#ffffff',
            fontSize: isMobile ? 14 : 16,
            fontWeight: 700,
            textAlign: 'center',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)',
            marginBottom: isMobile ? '12px' : '16px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(139, 92, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.35)';
          }}
        >
          <img
            src="/gifterra-logo.png"
            alt="GIFTERRA"
            style={{
              height: isMobile ? 28 : 32,
              width: 'auto',
            }}
          />
          GIFTERRAを使って贈る
        </a>

        {/* ウォレットを接続して贈るボタン */}
        <div style={{
          width: '100%',
        }}>
          <ConnectWallet
            theme="dark"
            btnTitle="🔗 ウォレットを接続して贈る"
            supportedTokens={{
              137: [
                {
                  address: JPYC_TOKEN.ADDRESS,
                  name: JPYC_TOKEN.NAME,
                  symbol: JPYC_TOKEN.SYMBOL,
                  icon: 'https://jpyc.jp/logo.png',
                }
              ]
            }}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '18px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: isMobile ? '12px' : '16px',
              color: '#ffffff',
              fontSize: isMobile ? 14 : 16,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)',
              transition: 'all 0.3s ease',
            }}
          />
        </div>

        {/* フッター */}
        <div style={{
          marginTop: isMobile ? '20px' : '28px',
          paddingTop: isMobile ? '16px' : '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
          fontSize: isMobile ? 10 : 12,
          color: 'rgba(255, 255, 255, 0.5)',
          lineHeight: isMobile ? 1.3 : 1.5,
        }}>
          <div>Powered by <strong style={{ color: 'rgba(255, 255, 255, 0.75)' }}>GIFTERRA</strong></div>
        </div>
      </div>
    </div>
  );
}
