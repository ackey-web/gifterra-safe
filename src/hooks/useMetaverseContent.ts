// src/hooks/useMetaverseContent.ts
import { useState, useEffect } from "react";
import type { VendingMachine } from "../types/vending";

// 文字列の類似度を計算（簡易版）
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

// 最も近い候補を提案
function findClosestMatch(input: string, candidates: string[]): string | null {
  let bestMatch = null;
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const score = calculateSimilarity(input.toLowerCase(), candidate.toLowerCase());
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

// 📦 localStorage から管理画面データを読み込む
const STORAGE_KEY = 'vending_machines_data';

function loadVendingMachinesFromStorage(): VendingMachine[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load vending machines:', error);
    return [];
  }
}

// 🔄 VendingMachine を MachineInfo + ContentSet に変換
function convertVendingMachineToContent(machine: VendingMachine): {
  machineInfo: MachineInfo;
  contentSet: ContentSet;
  vendingMachine: VendingMachine;
} {
  const machineInfo: MachineInfo = {
    machineId: machine.slug,
    machineName: machine.name,
    spaceId: 'default',
    contentSetId: machine.id
  };

  const contents: DigitalContent[] = machine.products.map(product => ({
    contentId: product.id,
    name: product.name,
    type: product.contentType as any,
    description: product.description,
    fileSize: product.fileSize,
    requiredTips: product.price,
    imageUrl: product.imageUrl,
    metadata: {
      author: 'Admin',
      createdAt: product.createdAt,
      tags: [product.category]
    }
  }));

  const contentSet: ContentSet = {
    contentSetId: machine.id,
    name: machine.name,
    description: machine.description,
    contents
  };

  return { machineInfo, contentSet, vendingMachine: machine };
}

// 🗄️ 型定義
interface SpaceInfo {
  spaceId: string;
  spaceName: string;
  description: string;
  isActive: boolean;
}

interface MachineInfo {
  machineId: string;
  machineName: string;
  spaceId: string;
  position?: { x: number; y: number; z: number };
  contentSetId: string;
}

interface DigitalContent {
  contentId: string;
  name: string;
  type: "GLB" | "MP3" | "PNG" | "PDF" | "ZIP";
  description?: string;
  fileSize?: string;
  requiredTips: number;
  imageUrl?: string;
  metadata?: {
    author?: string;
    createdAt?: string;
    tags?: string[];
  };
}

interface ContentSet {
  contentSetId: string;
  name: string;
  description: string;
  contents: DigitalContent[];
}

/* ========================================
   🎮 メタバースコンテンツ管理フック
   
   🎯 役割: 空間・マシン・コンテンツ情報の管理
   📦 機能: モックデータ提供 (将来的にAPI連携)
======================================== */

// 🏗️ モックデータ - 実際の実装では外部APIまたはコントラクトから取得
const MOCK_SPACES: Record<string, SpaceInfo> = {
  "world-1": {
    spaceId: "world-1",
    spaceName: "メインワールド",
    description: "ギフテラの中心となるメタバース空間",
    isActive: true,
  },
  "gallery-a": {
    spaceId: "gallery-a", 
    spaceName: "アートギャラリー",
    description: "クリエイター作品を展示するアート空間",
    isActive: true,
  },
  "game-zone": {
    spaceId: "game-zone",
    spaceName: "ゲームゾーン", 
    description: "ゲーム関連コンテンツの配布エリア",
    isActive: true,
  },
  "default": {
    spaceId: "default",
    spaceName: "デフォルト空間",
    description: "標準的なコンテンツ配布空間",
    isActive: true,
  }
};

const MOCK_MACHINES: Record<string, MachineInfo> = {
  "entrance-01": {
    machineId: "entrance-01",
    machineName: "エントランス自販機",
    spaceId: "world-1",
    position: { x: 0, y: 0, z: 5 },
    contentSetId: "starter-pack",
  },
  "vip-lounge": {
    machineId: "vip-lounge", 
    machineName: "VIPラウンジ",
    spaceId: "world-1",
    position: { x: 10, y: 2, z: -5 },
    contentSetId: "premium-collection",
  },
  "gallery-01": {
    machineId: "gallery-01",
    machineName: "ギャラリー自販機",
    spaceId: "gallery-a",
    position: { x: -5, y: 0, z: 0 },
    contentSetId: "art-collection",
  },
  "creator-corner": {
    machineId: "creator-corner",
    machineName: "クリエーターコーナー", 
    spaceId: "gallery-a",
    position: { x: 5, y: 1, z: 3 },
    contentSetId: "creator-pack",
  },
  "main": {
    machineId: "main",
    machineName: "メイン自販機",
    spaceId: "default", 
    contentSetId: "starter-pack",
  }
};

const MOCK_CONTENT_SETS: Record<string, ContentSet> = {
  "starter-pack": {
    contentSetId: "starter-pack",
    name: "スターターパック",
    description: "初心者向けの基本コンテンツセット",
    contents: [
      {
        contentId: "avatar-basic-001",
        name: "ベーシックアバター.glb",
        type: "GLB",
        description: "初心者向けの3Dアバターモデル",
        fileSize: "2.4MB",
        requiredTips: 50,
        metadata: {
          author: "Gifterra Team",
          createdAt: "2024-01-15",
          tags: ["avatar", "basic", "3d"]
        }
      },
      {
        contentId: "welcome-sound-001", 
        name: "ウェルカムサウンド.mp3",
        type: "MP3",
        description: "ギフテラへようこそのBGM",
        fileSize: "3.2MB",
        requiredTips: 25,
        metadata: {
          author: "Sound Designer",
          createdAt: "2024-01-10",
          tags: ["music", "welcome", "bgm"]
        }
      }
    ]
  },
  "premium-collection": {
    contentSetId: "premium-collection", 
    name: "プレミアムコレクション",
    description: "限定的なプレミアムコンテンツ",
    contents: [
      {
        contentId: "avatar-premium-001",
        name: "プレミアムアバター.glb", 
        type: "GLB",
        description: "高品質なプレミアム3Dアバター",
        fileSize: "8.7MB",
        requiredTips: 500,
        metadata: {
          author: "Premium Artist",
          createdAt: "2024-02-01",
          tags: ["avatar", "premium", "limited"]
        }
      },
      {
        contentId: "exclusive-bgm-001",
        name: "限定BGM.mp3",
        type: "MP3", 
        description: "VIP専用のオリジナルBGM",
        fileSize: "5.1MB",
        requiredTips: 300,
        metadata: {
          author: "Exclusive Composer",
          createdAt: "2024-02-05",
          tags: ["music", "exclusive", "vip"]
        }
      },
      {
        contentId: "special-item-001",
        name: "スペシャルアイテム.glb",
        type: "GLB",
        description: "特別な3Dアクセサリー",
        fileSize: "4.2MB", 
        requiredTips: 200,
        metadata: {
          author: "Item Designer",
          createdAt: "2024-02-10",
          tags: ["item", "accessory", "special"]
        }
      }
    ]
  },
  "art-collection": {
    contentSetId: "art-collection",
    name: "アートコレクション", 
    description: "アーティスト作品のデジタルコレクション",
    contents: [
      {
        contentId: "art-glb-001",
        name: "限定アート作品.glb",
        type: "GLB",
        description: "著名アーティストの3D作品",
        fileSize: "12.3MB",
        requiredTips: 100,
        metadata: {
          author: "Famous Artist",
          createdAt: "2024-01-20",
          tags: ["art", "sculpture", "limited"]
        }
      }
    ]
  },
  "creator-pack": {
    contentSetId: "creator-pack",
    name: "クリエーターパック",
    description: "クリエイター制作のオリジナルコンテンツ",
    contents: [
      {
        contentId: "creator-bgm-001",
        name: "制作者オリジナルBGM.mp3",
        type: "MP3",
        description: "クリエイターによるオリジナル楽曲",
        fileSize: "4.8MB",
        requiredTips: 150,
        metadata: {
          author: "Indie Creator",
          createdAt: "2024-01-25", 
          tags: ["music", "original", "creator"]
        }
      }
    ]
  }
};

export const useMetaverseContent = (spaceId: string, machineId: string) => {
  const [spaceInfo, setSpaceInfo] = useState<SpaceInfo | null>(null);
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null);
  const [contentSet, setContentSet] = useState<ContentSet | null>(null);
  const [vendingMachine, setVendingMachine] = useState<VendingMachine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 📦 管理画面から作成した自販機を読み込み
        const vendingMachines = loadVendingMachinesFromStorage();

        // slug で検索
        const vendingMachine = vendingMachines.find(m => m.slug === machineId);

        if (vendingMachine) {
          // ✅ 管理画面データが見つかった場合
          const { machineInfo: adminMachineInfo, contentSet: adminContentSet, vendingMachine: vm } = convertVendingMachineToContent(vendingMachine);

          setSpaceInfo({
            spaceId: 'default',
            spaceName: 'Admin Created Space',
            description: vendingMachine.location,
            isActive: vendingMachine.isActive
          });
          setMachineInfo(adminMachineInfo);
          setContentSet(adminContentSet);
          setVendingMachine(vm);
          setIsLoading(false);
          return;
        }

        // 🏰 モックデータから取得（後方互換性）
        const space = MOCK_SPACES[spaceId];
        if (!space) {
          console.error(`❌ Space not found: ${spaceId}`);
          const suggestion = findClosestMatch(spaceId, Object.keys(MOCK_SPACES));
          const errorMsg = suggestion
            ? `Space not found: ${spaceId}. Did you mean "${suggestion}"?`
            : `Space not found: ${spaceId}`;
          throw new Error(errorMsg);
        }
        setSpaceInfo(space);

        // 🏪 マシン情報取得
        const machine = MOCK_MACHINES[machineId];
        if (!machine) {
          console.error(`❌ Machine not found: ${machineId}`);
          const suggestion = findClosestMatch(machineId, Object.keys(MOCK_MACHINES));
          const errorMsg = suggestion
            ? `Machine not found: ${machineId}. Did you mean "${suggestion}"?`
            : `Machine not found: ${machineId}`;
          throw new Error(errorMsg);
        }

        // マシンが指定された空間に属しているかチェック
        if (machine.spaceId !== spaceId && spaceId !== "default") {
          console.warn(`Machine ${machineId} belongs to space ${machine.spaceId}, but requested space is ${spaceId}`);
        }
        setMachineInfo(machine);

        // 📦 コンテンツセット取得
        const content = MOCK_CONTENT_SETS[machine.contentSetId];
        if (!content) {
          console.error(`❌ Content set not found: ${machine.contentSetId}`);
          throw new Error(`Content set not found: ${machine.contentSetId}`);
        }
        setContentSet(content);

      } catch (err) {
        console.error("🚨 Hook Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [spaceId, machineId]);

  return {
    spaceInfo,
    machineInfo,
    contentSet,
    vendingMachine,
    isLoading,
    error
  };
};