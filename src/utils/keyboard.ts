// src/utils/keyboard.ts
// Capacitor Keyboardを利用したキーボード制御ユーティリティ

import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

/**
 * キーボードを表示
 */
export async function showKeyboard() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Keyboard.show();
  } catch (error) {
    console.warn('Keyboard show failed:', error);
  }
}

/**
 * キーボードを非表示
 */
export async function hideKeyboard() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Keyboard.hide();
  } catch (error) {
    console.warn('Keyboard hide failed:', error);
  }
}

/**
 * キーボードのリサイズモードを設定
 * @param mode - リサイズモード（'body' | 'ionic' | 'native' | 'none'）
 */
export async function setKeyboardResize(mode: KeyboardResize) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Keyboard.setResizeMode({ mode });
  } catch (error) {
    console.warn('Keyboard resize mode setup failed:', error);
  }
}

/**
 * キーボードアクセサリバーの表示/非表示を設定
 * @param isVisible - trueの場合、アクセサリバーを表示
 */
export async function setAccessoryBarVisible(isVisible: boolean) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;

  try {
    await Keyboard.setAccessoryBarVisible({ isVisible });
  } catch (error) {
    console.warn('Keyboard accessory bar setup failed:', error);
  }
}

/**
 * キーボードのスクロールアシストを有効化/無効化
 * @param isEnabled - trueの場合、スクロールアシストを有効化
 */
export async function setScroll(isEnabled: boolean) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Keyboard.setScroll({ isDisabled: !isEnabled });
  } catch (error) {
    console.warn('Keyboard scroll setup failed:', error);
  }
}

/**
 * GIFTERRAアプリの初期キーボード設定
 */
export async function initGifterraKeyboard() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // ボディ全体をリサイズ（キーボード表示時に画面全体がスクロール可能に）
    await setKeyboardResize(KeyboardResize.Body);

    // iOSのアクセサリバーを表示（完了ボタンなど）
    await setAccessoryBarVisible(true);

    // スクロールアシストを有効化
    await setScroll(true);
  } catch (error) {
    console.warn('GIFTERRA Keyboard initialization failed:', error);
  }
}

/**
 * キーボード表示イベントリスナーを追加
 * @param callback - キーボード表示時のコールバック関数
 * @returns リスナーハンドル
 */
export function addKeyboardWillShowListener(callback: (info: { keyboardHeight: number }) => void) {
  if (!Capacitor.isNativePlatform()) return;

  return Keyboard.addListener('keyboardWillShow', callback);
}

/**
 * キーボード非表示イベントリスナーを追加
 * @param callback - キーボード非表示時のコールバック関数
 * @returns リスナーハンドル
 */
export function addKeyboardWillHideListener(callback: () => void) {
  if (!Capacitor.isNativePlatform()) return;

  return Keyboard.addListener('keyboardWillHide', callback);
}

/**
 * キーボード表示完了イベントリスナーを追加
 * @param callback - キーボード表示完了時のコールバック関数
 * @returns リスナーハンドル
 */
export function addKeyboardDidShowListener(callback: (info: { keyboardHeight: number }) => void) {
  if (!Capacitor.isNativePlatform()) return;

  return Keyboard.addListener('keyboardDidShow', callback);
}

/**
 * キーボード非表示完了イベントリスナーを追加
 * @param callback - キーボード非表示完了時のコールバック関数
 * @returns リスナーハンドル
 */
export function addKeyboardDidHideListener(callback: () => void) {
  if (!Capacitor.isNativePlatform()) return;

  return Keyboard.addListener('keyboardDidHide', callback);
}
