// src/pages/ReceivePage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ConnectWallet } from '@thirdweb-dev/react';

export function ReceivePage() {
  const [address, setAddress] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');

  // URLパラメータからアドレスを取得（ログイン不要）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address');

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
        console.log('❌ ReceivePage: No address provided');
        return;
      }

      console.log('🔍 ReceivePage: Fetching profile for address:', address);

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('display_name, avatar_url')
          .eq('wallet_address', address.toLowerCase())
          .single();

        if (error) {
          console.error('❌ ReceivePage: Supabase error:', error);
          throw error;
        }

        console.log('✅ ReceivePage: Profile data fetched:', data);

        if (data) {
          setDisplayName(data.display_name || '');
          setProfileImage(data.avatar_url || '');
          console.log('✅ ReceivePage: Display name:', data.display_name);
          console.log('✅ ReceivePage: Profile image:', data.avatar_url);
        } else {
          console.log('⚠️ ReceivePage: No profile data found for this address');
        }
      } catch (error) {
        console.error('❌ ReceivePage: Failed to fetch profile:', error);
      }
    };

    fetchProfile();
  }, [address]);

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
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      padding: isMobile ? '8px' : '20px',
      position: 'relative',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: isMobile ? '16px' : '24px',
        padding: isMobile ? '16px 14px' : '36px 28px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* ヘッダー */}
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? '12px' : '20px',
        }}>
          <h1 style={{
            fontSize: isMobile ? 18 : 26,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: isMobile ? '4px' : '8px',
          }}>
            💴 送金先アドレス
          </h1>
          <p style={{
            fontSize: isMobile ? 11 : 14,
            color: '#4a5568',
            lineHeight: 1.3,
          }}>
            下記のアドレスに送金してください
          </p>
        </div>

        {/* プロフィール画像 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: isMobile ? '12px' : '20px',
        }}>
          <div style={{
            width: isMobile ? 100 : 140,
            height: isMobile ? 100 : 140,
            borderRadius: '50%',
            overflow: 'hidden',
            border: isMobile ? '3px solid #10b981' : '4px solid #10b981',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
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
                fontSize: isMobile ? 40 : 60,
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
            marginBottom: isMobile ? '12px' : '20px',
            fontSize: isMobile ? 16 : 20,
            fontWeight: 700,
            color: '#1a1a1a',
          }}>
            {displayName}
          </div>
        )}

        {/* アドレス表示 (タップでコピー) */}
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            background: copySuccess ? '#ecfdf5' : '#f7fafc',
            border: copySuccess ? '2px solid #10b981' : '2px solid #e2e8f0',
            borderRadius: isMobile ? '10px' : '14px',
            padding: isMobile ? '10px' : '16px',
            marginBottom: isMobile ? '10px' : '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            fontSize: isMobile ? 9 : 10,
            color: '#718096',
            marginBottom: isMobile ? '6px' : '8px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'left',
          }}>
            {copySuccess ? '✅ コピーしました！' : 'アドレス (タップでコピー)'}
          </div>
          <div style={{
            wordBreak: 'break-all',
            fontSize: isMobile ? 10 : 13,
            fontFamily: 'monospace',
            color: '#1a1a1a',
            fontWeight: 500,
            lineHeight: isMobile ? 1.3 : 1.5,
            padding: isMobile ? '8px' : '12px',
            background: '#ffffff',
            borderRadius: isMobile ? '6px' : '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'left',
          }}>
            {address}
          </div>
        </button>

        {/* GIFTERRAを使って贈るボタン */}
        <a
          href="/login"
          style={{
            display: 'block',
            width: '100%',
            padding: isMobile ? '12px' : '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: isMobile ? '8px' : '10px',
            color: '#ffffff',
            fontSize: isMobile ? 13 : 15,
            fontWeight: 700,
            textAlign: 'center',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            marginBottom: isMobile ? '10px' : '16px',
          }}
        >
          💴 GIFTERRAを使って贈る
        </a>

        {/* ウォレットを接続して贈るボタン */}
        <div style={{
          width: '100%',
          marginBottom: isMobile ? '10px' : '16px',
        }}>
          <ConnectWallet
            theme="dark"
            btnTitle="🔗 ウォレットを接続して贈る"
            style={{
              width: '100%',
              padding: isMobile ? '12px' : '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: isMobile ? '8px' : '10px',
              color: '#ffffff',
              fontSize: isMobile ? 13 : 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          />
        </div>

        {/* 注意事項 */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: isMobile ? '8px' : '10px',
          padding: isMobile ? '10px' : '14px',
        }}>
          <div style={{
            fontWeight: 600,
            color: '#92400e',
            marginBottom: isMobile ? '5px' : '7px',
            fontSize: isMobile ? 11 : 13,
          }}>
            ⚠️ 送金手順
          </div>
          <ol style={{
            margin: 0,
            paddingLeft: isMobile ? '14px' : '18px',
            fontSize: isMobile ? 10 : 12,
            color: '#78350f',
            lineHeight: isMobile ? 1.4 : 1.6,
          }}>
            <li>アドレスをタップしてコピー</li>
            <li>GIFTERRAを使って贈るをタップ</li>
            <li>コピーしたアドレスを貼り付けて送金</li>
          </ol>
        </div>

        {/* フッター */}
        <div style={{
          marginTop: isMobile ? '10px' : '16px',
          paddingTop: isMobile ? '10px' : '14px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
          fontSize: isMobile ? 9 : 11,
          color: '#718096',
          lineHeight: isMobile ? 1.3 : 1.5,
        }}>
          <div>Powered by <strong>GIFTERRA</strong></div>
          <div>Produced by <strong>METATRON</strong></div>
        </div>
      </div>
    </div>
  );
}
