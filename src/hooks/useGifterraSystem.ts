// src/hooks/useGifterraSystem.ts
// 一時的に全体をコメントアウト - ABI整備後に有効化

export const useGifterraSystem = (_adminAddress?: string | number) => {
  // モック実装
  return {
    isLoading: false,
    error: null,
    systemInfo: null,
    stats: null,
    mintSBT: async () => ({ success: false, error: 'Not implemented' }),
    distributeReward: async () => ({ success: false, error: 'Not implemented' }),
    mintStandardNFT: async () => ({ success: false, error: 'Not implemented' }),
    publicMintStandardNFT: async () => ({ success: false, error: 'Not implemented' }),
    getTokenInfo: async () => null,
    deployedSystems: [],
    deploySystem: async () => ({ success: false, error: 'Not implemented' }),
    getSystemInfo: async () => null,
    isSystemReady: false,
    isUserOwner: false
  };
};

export const useSystemManagement = () => {
  // モック実装
  return {
    systems: [],
    isLoading: false,
    totalSystems: 0
  };
};