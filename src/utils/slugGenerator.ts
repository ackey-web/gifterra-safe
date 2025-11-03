// スラッグ生成ユーティリティ

// 日本語→英語変換マップ（よく使う単語）
const japaneseToEnglish: Record<string, string> = {
  '新しい': 'new',
  '自販機': 'vending',
  '店': 'store',
  '東京': 'tokyo',
  '渋谷': 'shibuya',
  '新宿': 'shinjuku',
  '駅': 'station',
  'メイン': 'main',
  '入口': 'entrance',
};

// 日本語→ローマ字変換マップ
const kanaToRomaji: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
};

export const generateSlug = (name: string): string => {
  let slug = name;

  // 日本語→英語変換を先に実行
  for (const [japanese, english] of Object.entries(japaneseToEnglish)) {
    slug = slug.replace(new RegExp(japanese, 'g'), english);
  }

  slug = slug.toLowerCase();
  for (const [kana, romaji] of Object.entries(kanaToRomaji)) {
    slug = slug.replace(new RegExp(kana, 'g'), romaji);
  }
  slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'machine';
};
