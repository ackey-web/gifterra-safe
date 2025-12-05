// middleware.ts
// Vercel Edge Middleware でクローラーを検出してOGP HTMLを返す

export const config = {
  matcher: '/receive/:address*',
};

export default function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);

  // クローラーのUser-Agentパターン
  const crawlerPatterns = [
    'bot',
    'crawler',
    'spider',
    'crawling',
    'facebookexternalhit',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'Discordbot',
    'WhatsApp',
    'TelegramBot',
  ];

  const isCrawler = crawlerPatterns.some(pattern =>
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );

  // クローラーの場合、OGP APIにリダイレクト
  if (isCrawler) {
    const address = url.pathname.split('/').pop();

    // OGP APIにリライト
    const ogpUrl = new URL('/api/ogp/profile', url.origin);
    ogpUrl.searchParams.set('address', address || '');

    return fetch(ogpUrl.toString());
  }

  // 通常のユーザーはそのまま
  return null;
}
