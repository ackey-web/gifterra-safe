// src/hooks/useMetaTags.ts
// 動的OGP/Twitter Card メタタグを設定するカスタムフック

import { useEffect } from 'react';

interface MetaTagsConfig {
  title?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
}

export function useMetaTags({
  title,
  description,
  imageUrl,
  url,
  type = 'website',
}: MetaTagsConfig) {
  useEffect(() => {
    // デフォルト値
    const defaultTitle = 'GIFTERRA - Web3ギフトカードプラットフォーム';
    const defaultDescription = 'ブロックチェーン技術を活用した次世代ギフトカードプラットフォーム';
    const defaultImage = 'https://gifterra-safe.vercel.app/gifterra-ogp.png';
    const defaultUrl = 'https://gifterra-safe.vercel.app/';

    const finalTitle = title || defaultTitle;
    const finalDescription = description || defaultDescription;
    const finalImage = imageUrl || defaultImage;
    const finalUrl = url || defaultUrl;

    // タイトルを更新
    document.title = finalTitle;

    // メタタグを更新する関数
    const updateMetaTag = (selector: string, attribute: string, content: string) => {
      let element = document.querySelector(selector);
      if (element) {
        element.setAttribute(attribute, content);
      } else {
        element = document.createElement('meta');
        if (selector.includes('property=')) {
          const property = selector.match(/property="([^"]+)"/)?.[1];
          if (property) element.setAttribute('property', property);
        } else if (selector.includes('name=')) {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (name) element.setAttribute('name', name);
        }
        element.setAttribute(attribute, content);
        document.head.appendChild(element);
      }
    };

    // OGPタグを更新
    updateMetaTag('meta[property="og:title"]', 'content', finalTitle);
    updateMetaTag('meta[property="og:description"]', 'content', finalDescription);
    updateMetaTag('meta[property="og:image"]', 'content', finalImage);
    updateMetaTag('meta[property="og:url"]', 'content', finalUrl);
    updateMetaTag('meta[property="og:type"]', 'content', type);

    // Twitter Cardタグを更新
    updateMetaTag('meta[name="twitter:title"]', 'content', finalTitle);
    updateMetaTag('meta[name="twitter:description"]', 'content', finalDescription);
    updateMetaTag('meta[name="twitter:image"]', 'content', finalImage);
    updateMetaTag('meta[name="twitter:url"]', 'content', finalUrl);

    // 通常のdescriptionタグも更新
    updateMetaTag('meta[name="description"]', 'content', finalDescription);

    // クリーンアップ関数（コンポーネントがアンマウントされた時にデフォルトに戻す）
    return () => {
      document.title = defaultTitle;
      updateMetaTag('meta[property="og:title"]', 'content', defaultTitle);
      updateMetaTag('meta[property="og:description"]', 'content', defaultDescription);
      updateMetaTag('meta[property="og:image"]', 'content', defaultImage);
      updateMetaTag('meta[property="og:url"]', 'content', defaultUrl);
      updateMetaTag('meta[property="og:type"]', 'content', 'website');
      updateMetaTag('meta[name="twitter:title"]', 'content', defaultTitle);
      updateMetaTag('meta[name="twitter:description"]', 'content', defaultDescription);
      updateMetaTag('meta[name="twitter:image"]', 'content', defaultImage);
      updateMetaTag('meta[name="twitter:url"]', 'content', defaultUrl);
      updateMetaTag('meta[name="description"]', 'content', defaultDescription);
    };
  }, [title, description, imageUrl, url, type]);
}
