// src/hooks/useFlagNFTContract.ts
// FlagNFTコントラクトとのインタラクション用カスタムフック

import { useContract, useContractRead, useContractWrite } from '@thirdweb-dev/react';
import { FlagNFTCategory } from '../types/flagNFT';

// コントラクトアドレス（デプロイ後に設定）
const FLAG_NFT_CONTRACT_ADDRESS = import.meta.env.VITE_FLAG_NFT_CONTRACT_ADDRESS || '';

/**
 * カテゴリ名からSolidityのenum値へのマッピング
 */
export const categoryToEnum = (category: FlagNFTCategory): number => {
  const mapping: Record<FlagNFTCategory, number> = {
    'BENEFIT': 0,
    'MEMBERSHIP': 1,
    'ACHIEVEMENT': 2,
    'CAMPAIGN': 3,
    'ACCESS_PASS': 4,
    'COLLECTIBLE': 5,
  };
  return mapping[category];
};

/**
 * Solidityのenum値からカテゴリ名へのマッピング
 */
export const enumToCategory = (enumValue: number): FlagNFTCategory => {
  const mapping: Record<number, FlagNFTCategory> = {
    0: 'BENEFIT',
    1: 'MEMBERSHIP',
    2: 'ACHIEVEMENT',
    3: 'CAMPAIGN',
    4: 'ACCESS_PASS',
    5: 'COLLECTIBLE',
  };
  return mapping[enumValue];
};

/**
 * FlagNFTコントラクトとのインタラクション用フック
 */
export function useFlagNFTContract() {
  const { contract } = useContract(FLAG_NFT_CONTRACT_ADDRESS);

  return {
    contract,
    contractAddress: FLAG_NFT_CONTRACT_ADDRESS,
  };
}

/**
 * NFTをカテゴリ付きでミントする
 */
export function useMintFlagNFT() {
  const { contract } = useFlagNFTContract();
  const { mutateAsync: mintWithCategory, isLoading } = useContractWrite(
    contract,
    'mintWithCategory'
  );

  const mint = async (to: string, category: FlagNFTCategory) => {
    if (!contract) throw new Error('Contract not initialized');

    const categoryEnum = categoryToEnum(category);
    const tx = await mintWithCategory({ args: [to, categoryEnum] });
    return tx;
  };

  return {
    mint,
    isLoading,
  };
}

/**
 * NFTを一括ミントする
 */
export function useMintBatchFlagNFT() {
  const { contract } = useFlagNFTContract();
  const { mutateAsync: mintBatchWithCategory, isLoading } = useContractWrite(
    contract,
    'mintBatchWithCategory'
  );

  const mintBatch = async (recipients: string[], category: FlagNFTCategory) => {
    if (!contract) throw new Error('Contract not initialized');

    const categoryEnum = categoryToEnum(category);
    const tx = await mintBatchWithCategory({ args: [recipients, categoryEnum] });
    return tx;
  };

  return {
    mintBatch,
    isLoading,
  };
}

/**
 * カテゴリ設定を登録/更新する
 */
export function useConfigureCategory() {
  const { contract } = useFlagNFTContract();
  const { mutateAsync: configureCategory, isLoading } = useContractWrite(
    contract,
    'configureCategory'
  );

  const configure = async (
    category: FlagNFTCategory,
    usageLimit: number,
    validFrom: number, // UNIX timestamp
    validUntil: number, // UNIX timestamp (0 = 無期限)
    isTransferable: boolean,
    metadataURI: string
  ) => {
    if (!contract) throw new Error('Contract not initialized');

    const categoryEnum = categoryToEnum(category);
    const tx = await configureCategory({
      args: [categoryEnum, usageLimit, validFrom, validUntil, isTransferable, metadataURI],
    });
    return tx;
  };

  return {
    configure,
    isLoading,
  };
}

/**
 * NFTを使用する（使用回数をインクリメント）
 */
export function useNFTUsage() {
  const { contract } = useFlagNFTContract();
  const { mutateAsync: useNFT, isLoading } = useContractWrite(contract, 'useNFT');

  const use = async (tokenId: number) => {
    if (!contract) throw new Error('Contract not initialized');

    const tx = await useNFT({ args: [tokenId] });
    return tx;
  };

  return {
    use,
    isLoading,
  };
}

/**
 * トークンのカテゴリを取得
 */
export function useGetCategoryOf(tokenId: number | undefined) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'getCategoryOf', [tokenId]);

  return {
    category: data !== undefined ? enumToCategory(data) : undefined,
    isLoading,
    error,
  };
}

/**
 * トークンの使用状況を取得
 */
export function useGetUsageOf(tokenId: number | undefined) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'getUsageOf', [tokenId]);

  return {
    usedCount: data?.[0],
    lastUsedAt: data?.[1],
    isLoading,
    error,
  };
}

/**
 * NFTが有効か確認
 */
export function useIsValid(tokenId: number | undefined) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'isValid', [tokenId]);

  return {
    isValid: data,
    isLoading,
    error,
  };
}

/**
 * NFTが使用可能か確認
 */
export function useCanUse(tokenId: number | undefined) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'canUse', [tokenId]);

  return {
    canUse: data,
    isLoading,
    error,
  };
}

/**
 * カテゴリごとの総発行数を取得
 */
export function useTotalSupplyByCategory(category: FlagNFTCategory) {
  const { contract } = useFlagNFTContract();
  const categoryEnum = categoryToEnum(category);
  const { data, isLoading, error } = useContractRead(
    contract,
    'totalSupplyByCategory',
    [categoryEnum]
  );

  return {
    totalSupply: data,
    isLoading,
    error,
  };
}

/**
 * カテゴリ設定を取得
 */
export function useCategoryConfig(category: FlagNFTCategory) {
  const { contract } = useFlagNFTContract();
  const categoryEnum = categoryToEnum(category);
  const { data, isLoading, error } = useContractRead(
    contract,
    'categoryConfig',
    [categoryEnum]
  );

  return {
    config: data
      ? {
          category: enumToCategory(data.category),
          usageLimit: data.usageLimit,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
          isTransferable: data.isTransferable,
          metadataURI: data.metadataURI,
        }
      : undefined,
    isLoading,
    error,
  };
}

/**
 * トークンのフラグ（JourneyPass機能）を取得
 */
export function useTokenFlags(tokenId: number | undefined) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'flagsOf', [tokenId]);

  return {
    flags: data,
    isLoading,
    error,
  };
}

/**
 * 特定ビットのフラグが立っているか確認（JourneyPass機能）
 */
export function useHasFlag(tokenId: number | undefined, bit: number) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'hasFlag', [tokenId, bit]);

  return {
    hasFlag: data,
    isLoading,
    error,
  };
}

/**
 * フラグの進捗を取得（JourneyPass機能）
 */
export function useProgressOf(tokenId: number | undefined) {
  const { contract } = useFlagNFTContract();
  const { data, isLoading, error } = useContractRead(contract, 'progressOf', [tokenId]);

  return {
    setBits: data?.[0],
    totalBits: data?.[1],
    isLoading,
    error,
  };
}
