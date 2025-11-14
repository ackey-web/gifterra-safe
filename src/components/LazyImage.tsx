// src/components/LazyImage.tsx
// 画像の遅延読み込みコンポーネント（パフォーマンス最適化）

import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string; // プレースホルダー画像（低解像度）
  threshold?: number; // Intersection Observerの閾値
}

/**
 * 遅延読み込み画像コンポーネント
 *
 * Intersection Observer APIを使用して、画像がビューポートに入るまで読み込みを遅延
 *
 * 使用例:
 * <LazyImage src="/large-image.png" alt="説明" placeholder="/small-placeholder.png" />
 */
export function LazyImage({
  src,
  alt,
  placeholder,
  threshold = 0.1,
  className,
  style,
  ...props
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observerで画像がビューポートに入ったか監視
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect(); // 一度読み込んだら監視を解除
          }
        });
      },
      { threshold }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  // ビューポートに入ったら実際の画像を読み込み
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${src}`);
      setIsLoaded(true); // エラーでもローディング状態を解除
    };
  }, [src, isInView]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease-in-out',
      }}
      loading="lazy" // ブラウザネイティブの遅延読み込みもサポート
      {...props}
    />
  );
}

/**
 * 背景画像の遅延読み込みコンポーネント
 *
 * 使用例:
 * <LazyBackgroundImage src="/bg.jpg" className="hero-section">
 *   <h1>コンテンツ</h1>
 * </LazyBackgroundImage>
 */
interface LazyBackgroundImageProps {
  src: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  threshold?: number;
}

export function LazyBackgroundImage({
  src,
  children,
  className,
  style,
  threshold = 0.1,
}: LazyBackgroundImageProps) {
  const [backgroundImage, setBackgroundImage] = useState<string>('none');
  const [isLoaded, setIsLoaded] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
              setBackgroundImage(`url(${src})`);
              setIsLoaded(true);
            };
            observer.disconnect();
          }
        });
      },
      { threshold }
    );

    observer.observe(divRef.current);

    return () => {
      observer.disconnect();
    };
  }, [src, threshold]);

  return (
    <div
      ref={divRef}
      className={className}
      style={{
        ...style,
        backgroundImage,
        opacity: isLoaded ? 1 : 0.8,
        transition: 'opacity 0.3s ease-in-out',
      }}
    >
      {children}
    </div>
  );
}
