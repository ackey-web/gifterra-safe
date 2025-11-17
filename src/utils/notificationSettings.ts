// src/utils/notificationSettings.ts
// 通知設定の管理（ローカルストレージ）

const STORAGE_KEY = 'gifterra_notification_settings';

export interface NotificationSettings {
  /** 同じロールの新規ユーザー登録通知を受け取るか */
  newUserWithSameRole: boolean;
}

/**
 * デフォルトの通知設定
 */
const DEFAULT_SETTINGS: NotificationSettings = {
  newUserWithSameRole: true, // デフォルトで有効
};

/**
 * 通知設定を取得
 */
export function getNotificationSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.error('[NotificationSettings] Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 通知設定を保存
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[NotificationSettings] Failed to save settings:', error);
  }
}

/**
 * 通知設定をリセット
 */
export function resetNotificationSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[NotificationSettings] Failed to reset settings:', error);
  }
}

/**
 * 特定の設定を更新
 */
export function updateNotificationSetting<K extends keyof NotificationSettings>(
  key: K,
  value: NotificationSettings[K]
): void {
  const current = getNotificationSettings();
  saveNotificationSettings({ ...current, [key]: value });
}
