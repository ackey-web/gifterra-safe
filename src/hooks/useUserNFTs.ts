// src/hooks/useUserNFTs.ts
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SBT_CONTRACT, CONTRACT_ABI, getGifterraAddress } from '../contract';

export interface NFTItem {
  tokenId: string;
  name: string;
  image: string;
  description: string;
  rank: string;
  isSBT: boolean;
}

export function useUserNFTs(address: string | undefined, signer: ethers.Signer | null) {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !signer) {
      setNfts([]);
      setLoading(false);
      return;
    }

    const fetchNFTs = async () => {
      try {
        const provider = signer.provider;
        if (!provider) return;

        const gifterraAddress = getGifterraAddress();
        const sbtContract = new ethers.Contract(gifterraAddress, CONTRACT_ABI, provider);

        // ユーザーのSBTレベルを取得
        const userLevel = await sbtContract.userNFTLevel(address);

        if (userLevel.toNumber() > 0) {
          // レベルに応じたSBT情報を取得
          const ranks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
          const rank = ranks[Math.min(userLevel.toNumber() - 1, ranks.length - 1)];

          setNfts([{
            tokenId: userLevel.toString(),
            name: `GIFTERRA ${rank} SBT`,
            image: `/sbt-${rank.toLowerCase()}.png`, // TODO: 実際の画像パス
            description: `レベル ${userLevel} の貢献者SBT`,
            rank: rank,
            isSBT: true,
          }]);
        } else {
          setNfts([]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch NFTs:', error);
        setNfts([]);
        setLoading(false);
      }
    };

    fetchNFTs();

    // 60秒ごとに更新
    const interval = setInterval(fetchNFTs, 60000);
    return () => clearInterval(interval);
  }, [address, signer]);

  return { nfts, loading };
}
