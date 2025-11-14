// src/utils/nativeCamera.ts
// Capacitor Cameraを利用したネイティブカメラユーティリティ

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/**
 * ネイティブカメラで写真を撮影
 * @param quality - 画質（0-100、デフォルト90）
 * @returns 撮影した写真データ、またはnull（キャンセル時）
 */
export async function takePictureNative(quality: number = 90): Promise<Photo | null> {
  if (!Capacitor.isNativePlatform()) {
    console.warn('takePictureNative is only available on native platforms');
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });

    return image;
  } catch (error: any) {
    // ユーザーがキャンセルした場合
    if (error.message && error.message.includes('User cancelled')) {
      return null;
    }

    console.error('Camera error:', error);
    throw error;
  }
}

/**
 * ギャラリーから写真を選択
 * @param quality - 画質（0-100、デフォルト90）
 * @returns 選択した写真データ、またはnull（キャンセル時）
 */
export async function pickPhotoFromGallery(quality: number = 90): Promise<Photo | null> {
  if (!Capacitor.isNativePlatform()) {
    console.warn('pickPhotoFromGallery is only available on native platforms');
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    });

    return image;
  } catch (error: any) {
    // ユーザーがキャンセルした場合
    if (error.message && error.message.includes('User cancelled')) {
      return null;
    }

    console.error('Photo picker error:', error);
    throw error;
  }
}

/**
 * カメラまたはギャラリーから写真を選択（ユーザーに選択させる）
 * @param quality - 画質（0-100、デフォルト90）
 * @returns 選択した写真データ、またはnull（キャンセル時）
 */
export async function pickPhotoWithPrompt(quality: number = 90): Promise<Photo | null> {
  if (!Capacitor.isNativePlatform()) {
    console.warn('pickPhotoWithPrompt is only available on native platforms');
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt, // カメラ/ギャラリーの選択肢を表示
    });

    return image;
  } catch (error: any) {
    // ユーザーがキャンセルした場合
    if (error.message && error.message.includes('User cancelled')) {
      return null;
    }

    console.error('Photo selection error:', error);
    throw error;
  }
}

/**
 * 写真のBase64データを取得
 * @param quality - 画質（0-100、デフォルト90）
 * @param source - 写真のソース（Camera/Photos/Prompt）
 * @returns Base64エンコードされた写真データ、またはnull（キャンセル時）
 */
export async function getPhotoBase64(
  quality: number = 90,
  source: CameraSource = CameraSource.Prompt
): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    console.warn('getPhotoBase64 is only available on native platforms');
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source,
    });

    return image.base64String || null;
  } catch (error: any) {
    // ユーザーがキャンセルした場合
    if (error.message && error.message.includes('User cancelled')) {
      return null;
    }

    console.error('Photo selection error:', error);
    throw error;
  }
}

/**
 * カメラパーミッションをチェック
 * @returns パーミッションの状態
 */
export async function checkCameraPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return { camera: 'granted', photos: 'granted' };
  }

  try {
    const permissions = await Camera.checkPermissions();
    return permissions;
  } catch (error) {
    console.error('Permission check error:', error);
    return { camera: 'denied', photos: 'denied' };
  }
}

/**
 * カメラパーミッションをリクエスト
 * @returns パーミッションの状態
 */
export async function requestCameraPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return { camera: 'granted', photos: 'granted' };
  }

  try {
    const permissions = await Camera.requestPermissions();
    return permissions;
  } catch (error) {
    console.error('Permission request error:', error);
    return { camera: 'denied', photos: 'denied' };
  }
}
