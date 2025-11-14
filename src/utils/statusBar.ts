// src/utils/statusBar.ts
// Capacitor StatusBarを利用したステータスバー制御ユーティリティ

import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

/**
 * ステータスバーを暗いテーマに設定（白い文字）
 * GIFTERRAのダークブルーグラデーション背景に適用
 */
export async function setStatusBarDark() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#018a9a' }); // GIFTERRAのテーマカラー
  } catch (error) {
    console.warn('StatusBar Dark setup failed:', error);
  }
}

/**
 * ステータスバーを明るいテーマに設定（黒い文字）
 * モーダルや明るい背景に適用
 */
export async function setStatusBarLight() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch (error) {
    console.warn('StatusBar Light setup failed:', error);
  }
}

/**
 * ステータスバーを表示
 */
export async function showStatusBar() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.show();
  } catch (error) {
    console.warn('StatusBar show failed:', error);
  }
}

/**
 * ステータスバーを非表示
 */
export async function hideStatusBar() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.hide();
  } catch (error) {
    console.warn('StatusBar hide failed:', error);
  }
}

/**
 * ステータスバーのオーバーレイモードを設定
 * @param overlay - trueの場合、コンテンツがステータスバーの下に表示される
 */
export async function setStatusBarOverlay(overlay: boolean) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay });
  } catch (error) {
    console.warn('StatusBar overlay setup failed:', error);
  }
}

/**
 * GIFTERRAアプリの初期ステータスバー設定
 */
export async function initGifterraStatusBar() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await setStatusBarDark();
    await showStatusBar();
    await setStatusBarOverlay(false); // コンテンツはステータスバーの下に配置しない
  } catch (error) {
    console.warn('GIFTERRA StatusBar initialization failed:', error);
  }
}
