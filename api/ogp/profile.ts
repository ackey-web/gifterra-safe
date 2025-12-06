// api/ogp/profile.ts
// プロフィールページのOGP用動的HTML生成

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRole);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address parameter is required' });
  }

  try {
    // Supabaseからユーザープロフィールを取得
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url, bio')
      .eq('wallet_address', address.toLowerCase())
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);
    }

    const profile = profiles?.[0];

    // デバッグログ: プロフィールデータを確認
    console.log('[OGP Debug] Address:', address);
    console.log('[OGP Debug] Profile found:', !!profile);
    console.log('[OGP Debug] Avatar URL:', profile?.avatar_url);

    // デフォルト値
    const defaultTitle = 'GIFTERRA - WEB3.0 ギフティングプラットフォーム';
    const defaultDescription = 'ブロックチェーン技術を活用したWEB3.0 ギフティングプラットフォーム';

    // プロフィール情報から動的に生成
    const displayName = profile?.display_name || `${address.slice(0, 6)}...${address.slice(-4)}`;
    const title = profile
      ? `${displayName} - GIFTERRA`
      : defaultTitle;
    const description = profile?.bio || defaultDescription;

    // OGP画像を動的に生成するAPIエンドポイントURL
    const ogpImageParams = new URLSearchParams({
      name: displayName,
      bio: description,
    });

    // アバター画像がある場合のみ追加
    if (profile?.avatar_url) {
      ogpImageParams.set('avatar', profile.avatar_url);
    }

    const imageUrl = `https://gifterra-safe.vercel.app/api/ogp/image?${ogpImageParams.toString()}`;
    const profileUrl = `https://gifterra-safe.vercel.app/receive/${address}`;

    // デバッグログ: 最終的なOGP値を確認
    console.log('[OGP Debug] Final image URL:', imageUrl);
    console.log('[OGP Debug] Avatar URL:', profile?.avatar_url);

    // HTMLテンプレート
    const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/GIFTERRA.testflight.png" />
    <link rel="apple-touch-icon" href="/pwa-192x192.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#00b4d8" />
    <meta name="description" content="${description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${profileUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${profileUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="GIFTERRA" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>${title}</title>

    <script>
      window.process = window.process || {
        env: {},
        version: 'v16.0.0',
        versions: {},
        browser: true
      };
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (error) {
    console.error('OGP generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate OGP',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
