// src/utils/haptics.ts
// Capacitor Hapticsを利用した触覚フィードバックユーティリティ

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * 軽い触覚フィードバック（ボタンタップ等）
 */
export async function hapticsLight() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.warn('Haptics Light failed:', error);
  }
}

/**
 * 中程度の触覚フィードバック（重要なアクション）
 */
export async function hapticsMedium() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.warn('Haptics Medium failed:', error);
  }
}

/**
 * 強い触覚フィードバック（エラーや警告）
 */
export async function hapticsHeavy() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.warn('Haptics Heavy failed:', error);
  }
}

/**
 * 成功時の触覚フィードバック
 */
export async function hapticsSuccess() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.notification({ type: 'SUCCESS' });
  } catch (error) {
    console.warn('Haptics Success failed:', error);
  }
}

/**
 * 警告時の触覚フィードバック
 */
export async function hapticsWarning() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.notification({ type: 'WARNING' });
  } catch (error) {
    console.warn('Haptics Warning failed:', error);
  }
}

/**
 * エラー時の触覚フィードバック
 */
export async function hapticsError() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.notification({ type: 'ERROR' });
  } catch (error) {
    console.warn('Haptics Error failed:', error);
  }
}

/**
 * 選択変更時の触覚フィードバック
 */
export async function hapticsSelectionChange() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.selectionChanged();
  } catch (error) {
    console.warn('Haptics Selection failed:', error);
  }
}

/**
 * 触覚フィードバックのバイブレーション（カスタム時間）
 * @param duration - バイブレーション時間（ミリ秒）
 */
export async function hapticsVibrate(duration: number = 100) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.warn('Haptics Vibrate failed:', error);
  }
}
