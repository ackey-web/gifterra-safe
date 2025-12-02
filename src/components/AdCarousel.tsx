// src/components/AdCarousel.tsx
import { useEffect, useState, useRef, useCallback } from 'react';

interface AdData {
  src: string;
  href: string;
}

interface AdCarouselProps {
  ads?: Array<{
    src: string;
    alt: string;
    link?: string;
  }>;
  autoPlayInterval?: number;
  transitionDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AdCarousel({ 
  ads: propAds,
  autoPlayInterval = 2200, 
  transitionDuration = 800,
  className,
  style 
}: AdCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ads, setAds] = useState<Array<{ src: string; alt: string; link?: string }>>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // localStorageから広告データを読み込み
  useEffect(() => {
    const loadAds = () => {
      try {
        const saved = localStorage.getItem('gifterra-ads');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.ads && Array.isArray(parsed.ads)) {
            const formattedAds = parsed.ads.map((ad: AdData, index: number) => ({
              src: ad.src,
              alt: `Advertisement ${index + 1}`,
              link: ad.href
            }));
            setAds(formattedAds);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load ad data from localStorage:', error);
      }
      
      // デフォルトまたはpropsからの広告データを使用
      if (propAds && propAds.length > 0) {
        setAds(propAds);
      } else {
        // デフォルトの広告データ
        setAds([
          { src: "/ads/ad1.png", alt: "Advertisement 1", link: "https://example.com/1" },
          { src: "/ads/ad2.png", alt: "Advertisement 2", link: "https://example.com/2" },
          { src: "/ads/ad3.png", alt: "Advertisement 3", link: "https://example.com/3" }
        ]);
      }
    };

    loadAds();
  }, [propAds]);

  // prefers-reduced-motion対応
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effectiveTransitionDuration = prefersReducedMotion ? 200 : transitionDuration;

  // タブの表示状態を監視
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 次のスライドへ
  const nextSlide = useCallback(() => {
    if (isTransitioning || ads.length <= 1) return;
    
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % ads.length);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, effectiveTransitionDuration);
  }, [isTransitioning, ads.length, effectiveTransitionDuration]);

  // 前のスライドへ
  const prevSlide = useCallback(() => {
    if (isTransitioning || ads.length <= 1) return;
    
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, effectiveTransitionDuration);
  }, [isTransitioning, ads.length, effectiveTransitionDuration]);

  // 自動再生
  useEffect(() => {
    if (isPaused || ads.length <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(nextSlide, autoPlayInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [nextSlide, autoPlayInterval, isPaused, ads.length]);

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // タッチ操作
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        nextSlide(); // 左スワイプ = 次へ
      } else {
        prevSlide(); // 右スワイプ = 前へ
      }
    }
  };

  // 広告クリック処理
  const handleAdClick = (link?: string) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  // 広告がない場合はプレースホルダーを表示
  if (ads.length === 0) {
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
          border: '2px dashed rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          minHeight: 200,
          ...style
        }}
      >
        <div style={{
          fontSize: 48,
          marginBottom: 16,
          opacity: 0.6
        }}>
          📺
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 8,
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          広告募集中
        </div>
        <div style={{
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          letterSpacing: '0.01em'
        }}>
          contact us,,,GIFTERRA
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 14,
        cursor: ads[currentIndex]?.link ? 'pointer' : 'default',
        ...style
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => handleAdClick(ads[currentIndex]?.link)}
      onMouseEnter={() => {
        setIsPaused(true);
        // ナビゲーションボタンを表示
        const buttons = containerRef.current?.querySelectorAll('button[aria-label*="広告"]');
        buttons?.forEach(btn => {
          (btn as HTMLElement).style.opacity = '1';
        });
      }}
      onMouseLeave={() => {
        setIsPaused(false);
        // ナビゲーションボタンを非表示
        const buttons = containerRef.current?.querySelectorAll('button[aria-label*="広告"]');
        buttons?.forEach(btn => {
          (btn as HTMLElement).style.opacity = '0';
        });
      }}
    >
      {ads.map((ad, index) => (
        <div
          key={index}
          style={{
            position: index === 0 ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: index === currentIndex ? 1 : 0,
            transform: `scale(${index === currentIndex ? 1 : 0.95}) translateX(${
              index === currentIndex ? 0 : index < currentIndex ? '-10px' : '10px'
            })`,
            transition: prefersReducedMotion
              ? `opacity ${effectiveTransitionDuration}ms ease`
              : `all ${effectiveTransitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            zIndex: index === currentIndex ? 2 : 1,
          }}
        >
          <img
            src={ad.src}
            alt={ad.alt}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.28))',
              borderRadius: 14,
              display: 'block',
            }}
            loading="lazy"
            draggable={false}
          />
        </div>
      ))}

      {/* インジケーター（3つ以上の場合のみ表示） */}
      {ads.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '4px 8px',
            borderRadius: 12,
            backdropFilter: 'blur(4px)',
          }}
        >
          {ads.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                if (!isTransitioning) {
                  setIsTransitioning(true);
                  setCurrentIndex(index);
                  setTimeout(() => setIsTransitioning(false), effectiveTransitionDuration);
                }
              }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: 'none',
                background: index === currentIndex ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                transition: `all ${effectiveTransitionDuration}ms ease`,
                padding: 0,
              }}
              aria-label={`広告 ${index + 1} を表示`}
            />
          ))}
        </div>
      )}

      {/* ナビゲーションボタン（ホバー時のみ表示） */}
      {ads.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              opacity: 0,
              transition: 'opacity 0.2s ease',
              zIndex: 3,
            }}
            aria-label="前の広告"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              opacity: 0,
              transition: 'opacity 0.2s ease',
              zIndex: 3,
            }}
            aria-label="次の広告"
          >
            ›
          </button>
        </>
      )}

    </div>
  );
}