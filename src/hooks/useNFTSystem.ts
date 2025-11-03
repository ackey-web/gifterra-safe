// src/hooks/useNFTSystem.ts
import { useEffect, useMemo, useState } from "react";
import {
  useAddress,
  // useContract, // 🚧 将来実装時に有効化
  useContractRead,
  useContractWrite,
} from "@thirdweb-dev/react";
// 🚧 将来実装用 - NFTコントラクトデプロイ後に有効化
// import { NFT_CONTRACT, MANAGER_CONTRACT, NFT_ABI, MANAGER_ABI } from "../contract";

/* =========================================
   ✅ NFTシステム統合フック
   📝 SBT ⟷ NFT 変換、レベル管理、NFT操作
========================================= */

export interface NFTMetadata {
  tokenId: string;
  level: number;
  createdAt: number;
  isFromSBT: boolean;
  originalSBTId: number;
  tokenURI: string;
  owner: string;
}

export interface ConversionRecord {
  user: string;
  sbtLevel: number;
  nftTokenId: number;
  convertedAt: number;
  isActive: boolean;
}

export function useNFTSystem() {
  const address = useAddress();
  
  // 🔗 コントラクト接続（将来実装時に有効化）
  // const { contract: nftContract } = useContract(
  //   NFT_CONTRACT.ADDRESS, // NFTコントラクトデプロイ後に有効化
  //   NFT_ABI
  // );
  
  // const { contract: managerContract } = useContract(
  //   MANAGER_CONTRACT.ADDRESS, // Managerコントラクトデプロイ後に有効化
  //   MANAGER_ABI
  // );
  
  // 🚧 開発中 - コントラクト未デプロイのため一時的にnullを設定
  const nftContract = null;
  const managerContract = null;

  /* =========================================
     ✅ NFT関連データ読み取り
  ========================================= */
  
  // ユーザーのNFT残高
  const { data: nftBalance, isLoading: isLoadingBalance } = useContractRead(
    nftContract,
    "balanceOf",
    address ? [address] : undefined
  );

  // ユーザーの統合レベル（SBT + NFT）
  const { data: unifiedLevel, isLoading: isLoadingLevel } = useContractRead(
    managerContract,
    "getUserLevel",
    address ? [address] : undefined
  );

  // ユーザーの変換履歴
  const { data: conversions, isLoading: isLoadingConversions } = useContractRead(
    managerContract,
    "getUserConversions",
    address ? [address] : undefined
  );

  /* =========================================
     ✅ NFT操作関数
  ========================================= */
  
  // SBT → NFT 変換
  const { mutateAsync: convertSBTtoNFT, isLoading: isConverting } = useContractWrite(
    managerContract,
    "convertSBTtoNFT"
  );

  // NFT → SBT 変換
  const { mutateAsync: convertNFTtoSBT, isLoading: isReconverting } = useContractWrite(
    managerContract,
    "convertNFTtoSBT"
  );

  // 🚧 NFTレベルミント（管理者用）- 将来実装
  // const { mutateAsync: mintLevelNFT, isLoading: isMinting } = useContractWrite(
  //   nftContract,
  //   "mintLevelNFT"
  // );

  /* =========================================
     ✅ ローカル状態管理
  ========================================= */
  
  const [userNFTs] = useState<NFTMetadata[]>([]);
  const [isSystemAvailable, setIsSystemAvailable] = useState(false);

  // システム利用可能性チェック（現在は開発中のためfalse）
  useEffect(() => {
    // 🚧 開発中 - NFTコントラクトデプロイ後にtrueに変更
    const available = false; // !!(NFT_CONTRACT.ADDRESS && MANAGER_CONTRACT.ADDRESS && nftContract && managerContract);
    setIsSystemAvailable(available);
  }, [nftContract, managerContract]);

  /* =========================================
     ✅ データ処理
  ========================================= */
  
  const processedData = useMemo(() => {
    return {
      // NFT残高
      nftBalance: nftBalance ? Number(nftBalance) : 0,
      
      // 統合レベル
      userLevel: unifiedLevel ? Number(unifiedLevel) : 0,
      
      // 変換履歴
      conversionHistory: conversions as ConversionRecord[] || [],
      
      // アクティブな変換数
      activeConversions: conversions 
        ? (conversions as ConversionRecord[]).filter(c => c.isActive).length 
        : 0,
    };
  }, [nftBalance, unifiedLevel, conversions]);

  /* =========================================
     ✅ 変換機能
  ========================================= */
  
  const handleSBTtoNFT = async (sbtLevel: number) => {
    if (!managerContract || !address) {
      throw new Error("Manager contract not available or wallet not connected");
    }

    try {
      const result = await convertSBTtoNFT({
        args: [sbtLevel],
      });
      
      return result;
    } catch (error) {
      console.error("SBT to NFT conversion failed:", error);
      throw error;
    }
  };

  const handleNFTtoSBT = async (tokenId: number) => {
    if (!managerContract || !address) {
      throw new Error("Manager contract not available or wallet not connected");
    }

    try {
      const result = await convertNFTtoSBT({
        args: [tokenId],
      });
      
      return result;
    } catch (error) {
      console.error("NFT to SBT conversion failed:", error);
      throw error;
    }
  };

  /* =========================================
     ✅ NFT情報取得
  ========================================= */
  
  const getNFTMetadata = async (tokenId: number): Promise<NFTMetadata | null> => {
    if (!nftContract) return null;

    try {
      // 🚧 将来実装 - NFTコントラクトデプロイ後に有効化
      // const [owner, level, tokenURI, metadata] = await Promise.all([
      //   nftContract.call("ownerOf", [tokenId]),
      //   nftContract.call("getTokenLevel", [tokenId]),
      //   nftContract.call("tokenURI", [tokenId]),
      //   nftContract.call("getTokenMetadata", [tokenId]),
      // ]);

      // 現在は開発中のためダミーデータを返す
      return {
        tokenId: tokenId.toString(),
        level: 1,
        createdAt: Date.now() / 1000,
        isFromSBT: false,
        originalSBTId: 0,
        tokenURI: "",
        owner: "",
      };
    } catch (error) {
      console.error(`Failed to get NFT metadata for token ${tokenId}:`, error);
      return null;
    }
  };

  /* =========================================
     ✅ 戻り値
  ========================================= */
  
  return {
    // システム状態
    isSystemAvailable,
    isLoadingBalance,
    isLoadingLevel,
    isLoadingConversions,
    
    // データ
    ...processedData,
    userNFTs,
    
    // 操作状態
    isConverting,
    isReconverting,
    // isMinting, // 🚧 将来実装
    
    // 関数
    handleSBTtoNFT,
    handleNFTtoSBT,
    getNFTMetadata,
    
    // コントラクト
    nftContract,
    managerContract,
  };
}

/* =========================================
   ✅ NFT表示用フック
========================================= */

export function useNFTDisplay(tokenId?: number) {
  const { getNFTMetadata, nftContract } = useNFTSystem();
  const [nftData, setNftData] = useState<NFTMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tokenId || !nftContract) return;

    const fetchNFTData = async () => {
      setIsLoading(true);
      try {
        const metadata = await getNFTMetadata(tokenId);
        setNftData(metadata);
      } catch (error) {
        console.error("Failed to fetch NFT data:", error);
        setNftData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTData();
  }, [tokenId, nftContract, getNFTMetadata]);

  return {
    nftData,
    isLoading,
    refetch: () => {
      if (tokenId) {
        const fetchData = async () => {
          const metadata = await getNFTMetadata(tokenId);
          setNftData(metadata);
        };
        fetchData();
      }
    },
  };
}

/* =========================================
   ✅ レベルベースNFT管理フック
========================================= */

export function useLevelBasedNFT() {
  const { userLevel, handleSBTtoNFT, isConverting } = useNFTSystem();
  
  const canConvertToNFT = useMemo(() => {
    return userLevel > 0;
  }, [userLevel]);

  const getConversionOptions = useMemo(() => {
    if (!userLevel) return [];
    
    const options = [];
    for (let level = 1; level <= userLevel; level++) {
      options.push({
        level,
        title: `Level ${level} NFT`,
        description: `Convert your SBT to Level ${level} transferable NFT`,
        canConvert: true,
      });
    }
    
    return options;
  }, [userLevel]);

  return {
    userLevel,
    canConvertToNFT,
    conversionOptions: getConversionOptions,
    convertToNFT: handleSBTtoNFT,
    isConverting,
  };
}