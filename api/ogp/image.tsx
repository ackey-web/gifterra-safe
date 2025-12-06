// api/ogp/image.tsx
// OGP画像を動的に生成（左：アバター、右：BIO）

import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const displayName = searchParams.get('name') || 'GIFTERRA User';
    const bio = searchParams.get('bio') || 'WEB3.0 ギフティングプラットフォーム';
    const avatarUrl = searchParams.get('avatar');

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '60px',
          }}
        >
          {/* 左側：アバター画像エリア */}
          <div
            style={{
              display: 'flex',
              width: '40%',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '40px',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                width="300"
                height="300"
                style={{
                  borderRadius: '50%',
                  border: '6px solid rgba(255, 255, 255, 0.3)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '120px',
                }}
              >
                👤
              </div>
            )}
          </div>

          {/* 右側：テキスト情報エリア */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '60%',
              padding: '40px 60px',
              justifyContent: 'center',
            }}
          >
            {/* 表示名 */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '24px',
                textShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {displayName}
            </div>

            {/* BIO */}
            <div
              style={{
                fontSize: '32px',
                color: '#ffffff',
                lineHeight: '1.6',
                opacity: 0.95,
                textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {bio}
            </div>

            {/* GIFTERRAロゴ */}
            <div
              style={{
                fontSize: '28px',
                color: 'rgba(255, 255, 255, 0.8)',
                marginTop: '40px',
                fontWeight: 'bold',
              }}
            >
              GIFTERRA
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OGP image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
