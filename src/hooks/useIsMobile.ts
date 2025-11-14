// src/hooks/useIsMobile.ts
// モバイル判定フック - Capacitorネイティブアプリ & レスポンシブWeb対応

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * デバイスがモバイル環境かどうかを判定するフック
 *
 * @returns {boolean} モバイル環境の場合true
 *
 * 判定基準:
 * 1. Capacitorネイティブプラットフォーム (iOS/Android) = モバイル
 * 2. 画面幅 <= 768px = モバイル (レスポンシブWeb)
 * 3. User-Agent検出 (iOS/Android) = モバイル
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // 初期値: Capacitorネイティブ判定 または 画面幅判定
    if (typeof window === 'undefined') return false;

    const isNative = Capacitor.isNativePlatform();
    const isSmallScreen = window.innerWidth <= 768;
    const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    return isNative || isSmallScreen || isMobileUA;
  });

  useEffect(() => {
    // Capacitorネイティブプラットフォームの場合は常にtrue
    if (Capacitor.isNativePlatform()) {
      setIsMobile(true);
      return;
    }

    // Web環境の場合はリサイズイベントを監視
    const handleResize = () => {
      const isSmallScreen = window.innerWidth <= 768;
      const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(isSmallScreen || isMobileUA);
    };

    window.addEventListener('resize', handleResize);

    // 初期実行
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isMobile;
}

/**
 * 詳細なデバイス情報を取得するフック
 *
 * @returns デバイス情報オブジェクト
 */
export function useDeviceInfo() {
  const isMobile = useIsMobile();
  const platform = Capacitor.getPlatform(); // 'ios', 'android', 'web'
  const isNative = Capacitor.isNativePlatform();

  return {
    isMobile,
    platform,
    isNative,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
  };
}
