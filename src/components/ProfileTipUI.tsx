// src/components/ProfileTipUI.tsx
// プロフィールページ用 TIP-UI コンポーネント
// テナント所有者のプロフィールページに統合されるチップ受け取りUI

import { useState, useEffect, useMemo } from 'react';
import { useAddress, useContract, useContractWrite } from '@thirdweb-dev/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { CONTRACT_ABI, getGifterraAddress } from '../contract';
import { getActiveTokens } from '../config/tokenHelpers';
import { type TokenId } from '../config/tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTenantKodomi } from '../hooks/useTenantKodomi';
import { useRankUpDetection } from '../hooks/useRankUpDetection';
import { useRankThresholds } from '../hooks/useRankThresholds';
import { RankUpAnimation } from './RankUpAnimation';

interface ProfileTipUIProps {
  // プロフィール所有者のアドレス（受け取り側）
  profileOwnerAddress: string;
  // 表示モード: 'owner' = 自分のプロフィール（受け取り統計表示）, 'visitor' = 他人のプロフィール（送信UI表示）
  mode: 'owner' | 'visitor';
  // 所有者の表示名
  ownerDisplayName?: string;
}

export function ProfileTipUI({
  profileOwnerAddress,
  mode,
  ownerDisplayName,
}: ProfileTipUIProps) {
  const isMobile = useIsMobile();
  const address = useAddress();
  const { authenticated: privyAuthenticated } = usePrivy();
  const { wallets } = useWallets();

  // テナントのkodomi値を監視（オーナーモード時のみ）
  const { kodomi: tenantKodomi } = useTenantKodomi(
    mode === 'owner' ? profileOwnerAddress : '',
    5000
  );

  // ランク閾値とラベルを取得
  const { thresholds } = useRankThresholds(profileOwnerAddress);
  const rankLabels = useMemo(() => {
    const labels: Record<number, { icon: string; label: string }> = {};
    for (let i = 1; i <= 5; i++) {
      const storageKey = `tip-rank-${i}-${profileOwnerAddress.toLowerCase()}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          labels[i] = JSON.parse(stored);
        } catch {
          // デフォルト値
          labels[i] = { icon: '🌱', label: `ランク${i}` };
        }
      } else {
        labels[i] = { icon: '🌱', label: `ランク${i}` };
      }
    }
    return labels;
  }, [profileOwnerAddress]);

  // ランクアップ検知（オーナーモード時のみ）
  const { showAnimation, currentRankInfo, hideAnimation } = useRankUpDetection(
    mode === 'owner' ? tenantKodomi : 0,
    thresholds,
    rankLabels
  );

  // SBT画像URLを取得
  const sbtImageUrl = useMemo(() => {
    if (!currentRankInfo) return undefined;
    const storageKey = `tip-rank-${currentRankInfo.rank}-image-${profileOwnerAddress.toLowerCase()}`;
    return localStorage.getItem(storageKey) || undefined;
  }, [currentRankInfo, profileOwnerAddress]);

  // 背景画像をlocalStorageから取得（管理画面で設定可能）
  // テナント所有者ごとに `tip-bg-image-{address}` として保存
  const [customBgImage] = useState<string>(() => {
    const ownerSpecificKey = `tip-bg-image-${profileOwnerAddress.toLowerCase()}`;
    const ownerImage = localStorage.getItem(ownerSpecificKey);
    if (ownerImage) return ownerImage;

    // フォールバック: グローバル設定
    return localStorage.getItem('tip-bg-image') || '/ads/ui-wallpeaper.png';
  });

  // Privy wallet address
  const [privyAddress, setPrivyAddress] = useState<string>('');

  // Get Privy wallet address
  useEffect(() => {
    async function getPrivyAddress() {
      if (!privyAuthenticated || !wallets || wallets.length === 0) {
        setPrivyAddress('');
        return;
      }

      try {
        const wallet = wallets[0];
        if (wallet.address) {
          setPrivyAddress(wallet.address);
          return;
        }

        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        const signer = ethersProvider.getSigner();
        const addr = await signer.getAddress();
        setPrivyAddress(addr);
      } catch (error) {
        console.error('❌ Failed to get Privy address:', error);
        setPrivyAddress('');
      }
    }
    getPrivyAddress();
  }, [privyAuthenticated, wallets]);

  // Combined address: prefer Thirdweb, fallback to Privy
  const currentUserAddress = address || privyAddress;

  // コントラクト接続
  const gifterraAddress = getGifterraAddress();
  const { contract } = useContract(gifterraAddress, CONTRACT_ABI);

  // トークン選択（NHT/JPYCから選択可能、デフォルトはNHT）
  const [selectedTokenId, setSelectedTokenId] = useState<TokenId>('NHT');
  const selectedTokenConfig = getActiveTokens().find(t => t.id === selectedTokenId) || getActiveTokens()[0];

  // チップ金額
  const [amount, setAmount] = useState<string>('');

  // チップ送信
  const { mutateAsync: sendTip, isLoading: isSending } = useContractWrite(contract, 'tip');

  const handleSendTip = async () => {
    if (!contract || !currentUserAddress || !amount || parseFloat(amount) <= 0) {
      alert('チップ金額を入力してください');
      return;
    }

    try {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await sendTip({
        args: [profileOwnerAddress, amountWei, selectedTokenId],
      });

      console.log('✅ Tip sent:', tx);
      alert(`✅ ${amount} ${selectedTokenConfig.symbol} のチップを送信しました！`);
      setAmount('');
    } catch (error) {
      console.error('❌ Tip failed:', error);
      alert('チップ送信に失敗しました');
    }
  };

  // オーナーモード: 受け取り統計表示
  if (mode === 'owner') {
    return (
      <>
        {/* ランクアップアニメーション */}
        <RankUpAnimation
          show={showAnimation}
          rankLevel={currentRankInfo?.rank || 1}
          rankIcon={currentRankInfo?.icon || '🌱'}
          rankLabel={currentRankInfo?.label || 'ランク1'}
          sbtImageUrl={sbtImageUrl}
          onComplete={hideAnimation}
        />

        <div
          style={{
            marginTop: 24,
            padding: isMobile ? 20 : 32,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: isMobile ? 16 : 20,
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px 0',
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              color: '#EAF2FF',
              textAlign: 'center',
            }}
          >
            💰 チップ受け取りUI
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? 13 : 14,
              color: 'rgba(255, 255, 255, 0.7)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            テナント承認済みユーザー専用のチップ受け取り機能です。
            <br />
            訪問者はこの画面からあなたにチップを送信できます。
          </p>
        </div>
      </>
    );
  }

  // ビジターモード: チップ送信UI
  return (
    <div
      style={{
        marginTop: 24,
        background: '#0b1620',
        backgroundImage: `url(${customBgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: isMobile ? 16 : 20,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* オーバーレイ */}
      <div
        style={{
          background: 'rgba(11, 22, 32, 0.85)',
          backdropFilter: 'blur(10px)',
          padding: isMobile ? 24 : 32,
        }}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            color: '#EAF2FF',
            textAlign: 'center',
          }}
        >
          💰 チップを贈る
        </h3>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: isMobile ? 13 : 14,
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
          }}
        >
          {ownerDisplayName || `${profileOwnerAddress.slice(0, 6)}...${profileOwnerAddress.slice(-4)}`} に送信
        </p>

        {/* トークン選択 */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: 'block',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: 12,
            }}
          >
            トークンを選択
          </label>
          <div
            style={{
              display: 'flex',
              gap: 8,
              width: '100%',
            }}
          >
            {getActiveTokens().map((token) => (
              <button
                key={token.id}
                onClick={() => setSelectedTokenId(token.id as TokenId)}
                disabled={token.currentAddress === '0x0000000000000000000000000000000000000000'}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px' : '12px',
                  background:
                    selectedTokenId === token.id
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'rgba(255, 255, 255, 0.1)',
                  border:
                    selectedTokenId === token.id
                      ? '2px solid rgba(102, 126, 234, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 10,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  cursor:
                    token.currentAddress === '0x0000000000000000000000000000000000000000'
                      ? 'not-allowed'
                      : 'pointer',
                  transition: 'all 0.2s',
                  opacity:
                    token.currentAddress === '0x0000000000000000000000000000000000000000'
                      ? 0.5
                      : 1,
                }}
                onMouseEnter={(e) => {
                  if (
                    selectedTokenId !== token.id &&
                    token.currentAddress !== '0x0000000000000000000000000000000000000000'
                  ) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTokenId !== token.id) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                {token.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* 固定金額選択 */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: 'block',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: 12,
            }}
          >
            💡 金額を選択
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
              gap: 8,
            }}
          >
            {[100, 500, 1000, 3000, 5000].map((presetAmount) => (
              <button
                key={presetAmount}
                onClick={() => setAmount(presetAmount.toString())}
                style={{
                  padding: isMobile ? '12px' : '14px',
                  background:
                    amount === presetAmount.toString()
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'rgba(255, 255, 255, 0.08)',
                  border:
                    amount === presetAmount.toString()
                      ? '2px solid rgba(16, 185, 129, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 10,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  if (amount !== presetAmount.toString()) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (amount !== presetAmount.toString()) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <span>{presetAmount.toLocaleString()}</span>
                <span
                  style={{
                    fontSize: isMobile ? 10 : 11,
                    opacity: 0.8,
                  }}
                >
                  {selectedTokenConfig.symbol}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* カスタム金額入力 */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'block',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: 12,
            }}
          >
            または自由に金額を入力
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="金額を入力"
              value={amount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d.]/g, '');
                const parts = value.split('.');
                if (parts.length > 2) return;
                setAmount(value);
              }}
              style={{
                width: '100%',
                padding: isMobile ? '14px 60px 14px 16px' : '16px 70px 16px 20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                color: '#EAF2FF',
                fontSize: isMobile ? 16 : 18,
                fontWeight: 600,
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: isMobile ? '16px' : '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: isMobile ? 14 : 16,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.5)',
                pointerEvents: 'none',
              }}
            >
              {selectedTokenConfig.symbol}
            </span>
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSendTip}
          disabled={!amount || parseFloat(amount) <= 0 || isSending || !currentUserAddress}
          style={{
            width: '100%',
            padding: isMobile ? '14px' : '16px',
            background:
              !amount || parseFloat(amount) <= 0 || isSending || !currentUserAddress
                ? 'rgba(102, 126, 234, 0.3)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 12,
            color: '#EAF2FF',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 700,
            cursor:
              !amount || parseFloat(amount) <= 0 || isSending || !currentUserAddress
                ? 'not-allowed'
                : 'pointer',
            transition: 'all 0.2s',
            opacity:
              !amount || parseFloat(amount) <= 0 || isSending || !currentUserAddress ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (amount && parseFloat(amount) > 0 && !isSending && currentUserAddress) {
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseLeave={(e) => {
            if (amount && parseFloat(amount) > 0 && !isSending && currentUserAddress) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {isSending ? '送信中...' : !currentUserAddress ? 'ウォレットを接続してください' : 'チップを贈る'}
        </button>
      </div>
    </div>
  );
}
