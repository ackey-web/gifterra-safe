// 自販機システムの型定義
import type { TokenId } from '../config/tokens';

export type ProductType = 'NFT' | 'SBT' | 'GLB' | 'FBX' | 'VRM' | 'MP3' | 'MP4' | 'PNG' | 'JPG' | 'PDF' | 'ZIP' | 'GLTF' | 'WAV' | 'OBJ';

export interface Product {
  id: string;
  name: string;
  price: number; // = 必要チップ数
  description: string;
  imageUrl: string; // サムネイル画像
  stock: number;
  isUnlimitedStock?: boolean; // 在庫無制限フラグ

  // デジタルコンテンツ設定
  contentType: ProductType; // コンテンツ種類

  // NFT/SBTの場合
  contractAddress?: string; // NFT/SBTコントラクトアドレス
  tokenId?: string; // トークンID

  // ファイル配布の場合（GLB/FBX/VRM/MP3等）
  fileUrl?: string; // ダウンロード用URL（Base64 or 外部URL）
  fileName?: string; // ファイル名（例: avatar.glb）
  fileSize?: string; // ファイルサイズ（例: 2.4MB）

  category: 'digital-asset' | 'nft' | 'sbt' | 'other';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendingMachine {
  id: string;
  slug: string; // URL用スラッグ (例: honsha-1f)
  name: string;
  location: string; // メモフィールド（設置場所の記録用）
  description: string;
  /**
   * @deprecated Use Supabase products table instead
   * Products are now managed separately in Supabase and linked via hub_products table
   */
  products: Product[];
  isActive: boolean;
  totalSales: number;
  totalAccessCount: number;
  totalDistributions: number;
  createdAt: string;
  updatedAt: string;
  settings: VendingMachineSettings;
}

export interface VendingMachineSettings {
  theme: 'default' | 'dark' | 'custom';
  displayName: string;
  welcomeMessage: string;
  thankYouMessage: string;
  maxSelectionsPerUser: number;
  operatingHours: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  customCss?: string;

  // トークン設定（GIFT HUBごとに受け入れるトークンを設定）
  tokenSymbol?: 'tNHT' | 'JPYC'; // [DEPRECATED] 後方互換性のため残す
  acceptedToken?: TokenId;       // 受け入れるトークン（例: 'NHT', 'JPYC'）

  // 収益管理設定
  paymentSplitterAddress?: string; // PaymentSplitterコントラクトアドレス

  // デザインカスタマイズ設定
  design?: {
    headerImage?: string;        // ヘッダー画像URL（自販機上部）
    backgroundImage?: string;     // 背景画像URL
    primaryColor?: string;        // メインカラー
    secondaryColor?: string;      // サブカラー
    accentColor?: string;         // アクセントカラー
    textColor?: string;           // テキストカラー
    buttonColor?: string;         // ボタンカラー
    cardBackgroundColor?: string; // カード背景色
  };
}

export interface VendingStats {
  machineId: string;
  date: string;
  sales: number;
  accessCount: number;
  distributions: number;
  popularProducts: {
    productId: string;
    productName: string;
    count: number;
  }[];
}

export interface VendingContextType {
  machines: VendingMachine[];
  currentMachine: VendingMachine | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createMachine: (machine: Omit<VendingMachine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMachine: (id: string, updates: Partial<VendingMachine>) => Promise<void>;
  deleteMachine: (id: string) => Promise<void>;
  selectMachine: (id: string) => void;
  
  // Product actions
  addProduct: (machineId: string, product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (machineId: string, productId: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (machineId: string, productId: string) => Promise<void>;
}

// モックデータ用の型
export interface MockDataType {
  machines: VendingMachine[];
  stats: VendingStats[];
}