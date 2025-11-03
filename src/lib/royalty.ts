// src/lib/royalty.ts
// EIP-2981 NFT Royalty Standard 対応ヘルパー関数

/**
 * EIP-2981 Royalty Standard の最小ABI
 * @see https://eips.ethereum.org/EIPS/eip-2981
 */
export const EIP2981_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'salePrice', type: 'uint256' },
    ],
    name: 'royaltyInfo',
    outputs: [
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'uint256', name: 'royaltyAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes4', name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * EIP-165 Interface ID for EIP-2981
 * bytes4(keccak256("royaltyInfo(uint256,uint256)")) = 0x2a55205a
 */
export const EIP2981_INTERFACE_ID = '0x2a55205a';

export interface RoyaltyInfo {
  receiver: string;
  royaltyAmount: bigint;
  royaltyBasisPoints: number; // 10000分率（例: 1000 = 10%）
}

export interface PaymentSplit {
  payees: string[];
  shares: number[];
  royalty_source: 'EIP2981' | 'manual' | 'none';
  nft_address?: string;
}

/**
 * NFTコントラクトがEIP-2981をサポートしているか確認
 */
export async function supportsEIP2981(
  nftAddress: string,
  publicClient: any
): Promise<boolean> {
  try {
    const supports = await publicClient.readContract({
      address: nftAddress as `0x${string}`,
      abi: EIP2981_ABI,
      functionName: 'supportsInterface',
      args: [EIP2981_INTERFACE_ID as `0x${string}`],
    });
    return supports as boolean;
  } catch (error) {
    console.warn(`❌ EIP-2981 check failed for ${nftAddress}:`, error);
    return false;
  }
}

/**
 * EIP-2981経由でロイヤリティ情報を取得
 * @param nftAddress NFTコントラクトアドレス
 * @param tokenId トークンID（0を推奨、コレクション全体のデフォルトロイヤリティ）
 * @param salePrice 販売価格（wei単位）
 * @param publicClient viem publicClient
 * @returns ロイヤリティ情報（受取人、金額、ベーシスポイント）
 */
export async function getRoyaltyInfo(
  nftAddress: string,
  tokenId: bigint,
  salePrice: bigint,
  publicClient: any
): Promise<RoyaltyInfo | null> {
  try {
    // 1. EIP-2981サポート確認
    const isSupported = await supportsEIP2981(nftAddress, publicClient);
    if (!isSupported) {
      console.warn(`⚠️ NFT ${nftAddress} does not support EIP-2981`);
      return null;
    }

    // 2. ロイヤリティ情報取得
    const result = await publicClient.readContract({
      address: nftAddress as `0x${string}`,
      abi: EIP2981_ABI,
      functionName: 'royaltyInfo',
      args: [tokenId, salePrice],
    });

    const [receiver, royaltyAmount] = result as [string, bigint];

    // 3. ベーシスポイント計算（10000分率）
    const royaltyBasisPoints =
      salePrice > 0n
        ? Number((royaltyAmount * 10000n) / salePrice)
        : 0;

    return {
      receiver,
      royaltyAmount,
      royaltyBasisPoints,
    };
  } catch (error) {
    console.error(`❌ Failed to get royalty info from ${nftAddress}:`, error);
    return null;
  }
}

/**
 * ロイヤリティ情報からPaymentSplitter用の分配設定を生成
 * @param royaltyInfo EIP-2981から取得したロイヤリティ情報
 * @param tenantOwner テナントオーナーアドレス
 * @param salePrice 販売価格（wei単位）
 * @returns PaymentSplitter用の設定（payees, shares）
 */
export function createPaymentSplit(
  royaltyInfo: RoyaltyInfo | null,
  tenantOwner: string
): PaymentSplit {
  // ロイヤリティなし → テナントオーナー100%
  if (!royaltyInfo || royaltyInfo.royaltyBasisPoints === 0) {
    return {
      payees: [tenantOwner],
      shares: [100],
      royalty_source: 'none',
    };
  }

  // クリエイター = テナントオーナー → 100%
  if (royaltyInfo.receiver.toLowerCase() === tenantOwner.toLowerCase()) {
    return {
      payees: [tenantOwner],
      shares: [100],
      royalty_source: 'EIP2981',
    };
  }

  // クリエイター ≠ テナントオーナー → 分配
  const creatorShare = royaltyInfo.royaltyBasisPoints; // 例: 1000 = 10%
  const tenantShare = 10000 - creatorShare; // 例: 9000 = 90%

  return {
    payees: [royaltyInfo.receiver, tenantOwner],
    shares: [creatorShare, tenantShare],
    royalty_source: 'EIP2981',
  };
}

/**
 * 手動設定のPaymentSplitを作成（EIP-2981非対応NFT用）
 * @param creatorAddress クリエイターアドレス
 * @param tenantOwner テナントオーナーアドレス
 * @param creatorShareBasisPoints クリエイターシェア（10000分率、例: 1000 = 10%）
 * @returns PaymentSplitter用の設定
 */
export function createManualPaymentSplit(
  creatorAddress: string,
  tenantOwner: string,
  creatorShareBasisPoints: number
): PaymentSplit {
  // バリデーション
  if (creatorShareBasisPoints < 0 || creatorShareBasisPoints > 10000) {
    throw new Error('Creator share must be between 0 and 10000 basis points');
  }

  // クリエイター = テナントオーナー → 100%
  if (creatorAddress.toLowerCase() === tenantOwner.toLowerCase()) {
    return {
      payees: [tenantOwner],
      shares: [100],
      royalty_source: 'manual',
    };
  }

  const tenantShareBasisPoints = 10000 - creatorShareBasisPoints;

  return {
    payees: [creatorAddress, tenantOwner],
    shares: [creatorShareBasisPoints, tenantShareBasisPoints],
    royalty_source: 'manual',
  };
}

/**
 * PaymentSplit設定のバリデーション
 */
export function validatePaymentSplit(split: PaymentSplit): boolean {
  // payees と shares の長さが一致
  if (split.payees.length !== split.shares.length) {
    console.error('❌ Payees and shares length mismatch');
    return false;
  }

  // 最低1人の受益者
  if (split.payees.length === 0) {
    console.error('❌ At least one payee is required');
    return false;
  }

  // 全シェアが0以上
  if (split.shares.some(share => share < 0)) {
    console.error('❌ Shares must be non-negative');
    return false;
  }

  // 合計シェアが0より大きい
  const totalShares = split.shares.reduce((sum, share) => sum + share, 0);
  if (totalShares === 0) {
    console.error('❌ Total shares must be greater than 0');
    return false;
  }

  return true;
}

/**
 * PaymentSplit設定を読みやすい形式に変換（UI表示用）
 */
export function formatPaymentSplit(split: PaymentSplit): string {
  if (split.payees.length === 1) {
    return `100% → ${split.payees[0].slice(0, 6)}...${split.payees[0].slice(-4)}`;
  }

  const totalShares = split.shares.reduce((sum, share) => sum + share, 0);
  const parts = split.payees.map((payee, i) => {
    const percentage = ((split.shares[i] / totalShares) * 100).toFixed(1);
    return `${percentage}% → ${payee.slice(0, 6)}...${payee.slice(-4)}`;
  });

  return parts.join(' / ');
}
