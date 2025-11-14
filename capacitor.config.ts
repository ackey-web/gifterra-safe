import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.metatron.gifterra',
  appName: 'GIFTERRA',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0a0a0f",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#667EEA",
      splashFullScreen: true,
      splashImmersive: true,
    },
    Camera: {
      // カメラ・写真ライブラリアクセス
      // Androidパーミッション: CAMERA, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE
      // iOSパーミッション: NSCameraUsageDescription, NSPhotoLibraryUsageDescription
    },
    Keyboard: {
      resize: "body", // キーボード表示時に画面全体をリサイズ
      style: "dark",  // ダークスタイル
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#018a9a", // GIFTERRAブランドカラー
    },
    Haptics: {
      // ハプティックフィードバック（バイブレーション）
      // Androidパーミッション: VIBRATE
    },
  },
};

export default config;
