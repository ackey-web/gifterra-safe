// src/hooks/useDeviceMotion.ts
// Capacitor Motion APIを使用してデバイスの加速度・傾きを取得

import { useState, useEffect } from 'react';
import { Motion } from '@capacitor/motion';
import { Capacitor } from '@capacitor/core';

export interface DeviceMotionData {
  // デバイスの傾き（度）
  tiltX: number; // -180 ~ 180 (左右の傾き)
  tiltY: number; // -90 ~ 90 (前後の傾き)

  // 加速度（m/s²）
  accelerationX: number;
  accelerationY: number;
  accelerationZ: number;

  // 正規化された値（-1 ~ 1）
  normalizedTiltX: number;
  normalizedTiltY: number;
}

/**
 * デバイスの加速度センサーを使用するカスタムフック
 * @param enabled - モーション検知を有効にするか
 * @param interval - 更新間隔（ミリ秒）デフォルト: 100ms
 */
export function useDeviceMotion(enabled: boolean = true, interval: number = 100) {
  const [motionData, setMotionData] = useState<DeviceMotionData>({
    tiltX: 0,
    tiltY: 0,
    accelerationX: 0,
    accelerationY: 0,
    accelerationZ: 0,
    normalizedTiltX: 0,
    normalizedTiltY: 0,
  });

  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ネイティブプラットフォームでのみ有効
    if (!Capacitor.isNativePlatform()) {
      setError('Motion API is only available on native platforms');
      setIsSupported(false);
      return;
    }

    if (!enabled) {
      return;
    }

    let listener: any;

    const startMotionTracking = async () => {
      try {
        // 加速度センサーのリスナーを登録
        listener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.acceleration;

          // 加速度から傾きを計算（簡易版）
          // より正確な計算にはジャイロスコープも使用可能
          const tiltX = Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
          const tiltY = Math.atan2(x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);

          // 正規化（-1 ~ 1の範囲に）
          const normalizedTiltX = Math.max(-1, Math.min(1, tiltX / 45)); // ±45度を基準
          const normalizedTiltY = Math.max(-1, Math.min(1, tiltY / 45));

          setMotionData({
            tiltX,
            tiltY,
            accelerationX: x,
            accelerationY: y,
            accelerationZ: z,
            normalizedTiltX,
            normalizedTiltY,
          });
        });

        setIsSupported(true);
        console.log('✅ [useDeviceMotion] Motion tracking started');
      } catch (err) {
        console.error('❌ [useDeviceMotion] Failed to start motion tracking:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsSupported(false);
      }
    };

    startMotionTracking();

    // クリーンアップ
    return () => {
      if (listener) {
        listener.remove();
        console.log('🔕 [useDeviceMotion] Motion tracking stopped');
      }
    };
  }, [enabled, interval]);

  return {
    ...motionData,
    isSupported,
    error,
  };
}

/**
 * Web APIのDeviceOrientationEventを使用するフォールバック版
 * （ブラウザでのテスト用）
 */
export function useDeviceMotionWeb(enabled: boolean = true) {
  const [motionData, setMotionData] = useState<DeviceMotionData>({
    tiltX: 0,
    tiltY: 0,
    accelerationX: 0,
    accelerationY: 0,
    accelerationZ: 0,
    normalizedTiltX: 0,
    normalizedTiltY: 0,
  });

  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Web APIのサポート確認
    if (typeof DeviceOrientationEvent === 'undefined') {
      setIsSupported(false);
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event; // beta: 前後, gamma: 左右

      if (beta !== null && gamma !== null) {
        const tiltX = gamma; // -180 ~ 180
        const tiltY = beta;  // -90 ~ 90

        const normalizedTiltX = Math.max(-1, Math.min(1, tiltX / 45));
        const normalizedTiltY = Math.max(-1, Math.min(1, tiltY / 45));

        setMotionData({
          tiltX,
          tiltY,
          accelerationX: 0, // Web APIでは加速度は別途取得が必要
          accelerationY: 0,
          accelerationZ: 0,
          normalizedTiltX,
          normalizedTiltY,
        });
      }
    };

    // iOS 13+では許可が必要
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
            setIsSupported(true);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
      setIsSupported(true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [enabled]);

  return {
    ...motionData,
    isSupported,
    error: null,
  };
}
