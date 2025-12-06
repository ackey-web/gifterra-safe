// supabase/functions/generate-ogp-image/index.ts
// OGP画像を動的に生成（左：アバター、右：BIO）

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const address = url.searchParams.get('address');

    if (!address) {
      return new Response('Missing address parameter', { status: 400 });
    }

    // Supabaseクライアント作成
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // プロフィール情報取得
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url, bio')
      .eq('wallet_address', address.toLowerCase())
      .single();

    const displayName = profile?.display_name || `${address.slice(0, 6)}...${address.slice(-4)}`;
    const bio = profile?.bio || 'WEB3.0 ギフティングプラットフォーム';
    const avatarUrl = profile?.avatar_url || 'https://gifterra-safe.vercel.app/GIFTY.icon.png';

    // SVGで画像を生成（添付画像スタイル）
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <!-- 背景：白 -->
        <rect width="1200" height="630" fill="#ffffff"/>

        <!-- 左側：グレー背景エリア（幅40%） -->
        <rect x="0" y="0" width="480" height="630" fill="#f5f5f5"/>

        <!-- アバター画像（円形にクリップ） -->
        <defs>
          <clipPath id="circle">
            <circle cx="240" cy="315" r="120"/>
          </clipPath>
        </defs>
        <image
          href="${avatarUrl}"
          x="120"
          y="195"
          width="240"
          height="240"
          clip-path="url(#circle)"
          preserveAspectRatio="xMidYMid slice"
        />

        <!-- 右側：テキスト情報（白背景） -->
        <!-- タイトル -->
        <text x="520" y="180" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#333333">
          ${displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName}
        </text>

        <!-- BIO（複数行対応） -->
        <foreignObject x="520" y="220" width="620" height="320">
          <div xmlns="http://www.w3.org/1999/xhtml" style="
            font-family: Arial, sans-serif;
            font-size: 28px;
            color: #666666;
            line-height: 1.5;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
          ">
            ${bio}
          </div>
        </foreignObject>

        <!-- 下部：GIFTERRAロゴ -->
        <text x="520" y="590" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#999999">
          GIFTERRA
        </text>
      </svg>
    `;

    // SVGをPNGに変換する代わりに、SVGをそのまま返す
    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('OGP generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate OGP image' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
