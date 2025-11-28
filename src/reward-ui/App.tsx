// src/reward-ui/App.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ConnectWallet,
  useAddress,
  useChain,
  useContract,
  useContractRead,
} from "@thirdweb-dev/react";
import { usePrivy } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { useEmergency } from "../lib/emergency";
import { AdCarousel } from "../components/AdCarousel";
import { rewardSuccessConfetti } from "../utils/confetti";
import type { TokenId } from "../config/tokens";
import { getTokenConfig } from "../config/tokens";
import { useTenantRankPlan } from '../hooks/useTenantRankPlan';
import flowImage from '../assets/flow.png';
import studioImage from '../assets/studio.png';
import studioProImage from '../assets/studio-pro.png';
import studioProMaxImage from '../assets/studio-pro-max.png';

/* ---------- 安全イベントパーサ（修正版） ---------- */
function getEventArgsFromReceipt(
  receipt: any,
  eventName: string,
  contractAddress: string,
  abi: any
) {
  try {
    // ethers v5 互換性を考慮したインターフェース作成
    const iface = new ethers.utils.Interface(abi);
    const topic = iface.getEventTopic(eventName);
    const logs = receipt?.logs || receipt?.events || [];
    const hit = logs.find(
      (l: any) =>
        (((l?.topics?.[0] || "") + "").toLowerCase() ===
          (topic + "").toLowerCase()) &&
        (((l?.address || "") + "").toLowerCase() ===
          (contractAddress + "").toLowerCase())
    );
    if (!hit) return null;
    const parsed = iface.parseLog({ topics: hit.topics, data: hit.data });
    return parsed?.args || null;
  } catch (error) {
    console.warn("Event parsing failed:", error);
    return null;
  }
}

export default function App() {
  const thirdwebAddress = useAddress();
  const chain = useChain();
  const { contract } = useContract(CONTRACT_ADDRESS, CONTRACT_ABI);

  // Privy hooks
  const { login, authenticated, user } = usePrivy();

  // 統合アドレス: Privy埋め込みウォレット優先、なければThirdweb
  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const address = privyEmbeddedWalletAddress || thirdwebAddress;

  // テナントオーナー情報取得（URLパラメータ優先、次にlocalStorage）
  const [tenantOwnerId] = useState<string | null>(() => {
    // URLからtenantパラメータを取得
    const params = new URLSearchParams(window.location.search);
    const tenantFromUrl = params.get('tenant');

    if (tenantFromUrl) {
      // URLにtenantパラメータがある場合はlocalStorageに保存
      localStorage.setItem('reward-tenant-id', tenantFromUrl);
      return tenantFromUrl;
    }

    // URLにない場合はlocalStorageから取得
    return localStorage.getItem('reward-tenant-id');
  });

  // テナントオーナーのプラン情報を取得
  const { plan: tenantRankPlan } = useTenantRankPlan(tenantOwnerId);

  // プランに応じたロゴ画像を取得
  const getHeaderLogo = () => {
    if (tenantRankPlan && tenantRankPlan.is_active) {
      const planType = tenantRankPlan.rank_plan;
      switch (planType) {
        case 'STUDIO':
          return studioImage;
        case 'STUDIO_PRO':
          return studioProImage;
        case 'STUDIO_PRO_MAX':
          return studioProMaxImage;
        case 'FLOW':
          return flowImage;
        default:
          return flowImage;
      }
    }
    return flowImage; // デフォルト
  };

  // Rewardトークン設定（ユーティリティトークン限定）
  // TODO: 将来的にTenantContextから取得
  const rewardTokenId: TokenId = 'NHT'; // デフォルトはNHT（ユーティリティトークン）
  const rewardTokenConfig = useMemo(() => getTokenConfig(rewardTokenId), [rewardTokenId]);

  // 背景画像をlocalStorageから取得（テナント専用キー優先）
  const [customBgImage] = useState<string>(() => {
    if (tenantOwnerId) {
      // テナント専用の背景画像を取得
      return localStorage.getItem(`reward-bg-image-${tenantOwnerId}`) || '/ads/ui-wallpeaper.png';
    }
    // デフォルト背景画像
    return localStorage.getItem('reward-bg-image') || '/ads/ui-wallpeaper.png';
  });

  // スモーク濃度をlocalStorageから取得（テナント専用キー優先）
  const [smokeOpacity] = useState<number>(() => {
    if (tenantOwnerId) {
      const saved = localStorage.getItem(`reward-smoke-opacity-${tenantOwnerId}`);
      return saved ? parseFloat(saved) : 0.9;
    }
    // デフォルトスモーク濃度
    const saved = localStorage.getItem('reward-smoke-opacity');
    return saved ? parseFloat(saved) : 0.9;
  });

  // ---- 読み取り（エラーハンドリング強化）----
  const { data: dailyRewardRaw, error: dailyRewardError } = useContractRead(
    contract,
    "dailyRewardAmount"
  );
  
  // ユーザー情報はアドレスがある場合のみ読み取り
  const { data: userInfoRaw, error: userInfoError } = useContractRead(
    contract && address ? contract : undefined,
    "userInfo",
    address ? [address] : undefined
  );

  // エラーログ出力（デバッグ用）
  useEffect(() => {
    if (dailyRewardError) {
      console.warn("💥 dailyRewardAmount読み取りエラー:", dailyRewardError);
    }
    if (userInfoError) {
      console.warn("💥 userInfo読み取りエラー:", userInfoError);
    }
  }, [dailyRewardError, userInfoError]);

  // チェーン確認とデータ表示
  const isCorrectChain = chain?.chainId === 137; // Polygon Mainnet
  
  const dailyReward = useMemo(() => {
    if (dailyRewardError) {
      console.warn("dailyRewardAmount エラー:", dailyRewardError);
      return "読み込みエラー";
    }
    if (!isCorrectChain) {
      return "ネットワーク未接続";
    }
    return dailyRewardRaw !== undefined
      ? `${Number(dailyRewardRaw) / Math.pow(10, rewardTokenConfig.decimals)} ${rewardTokenConfig.symbol}/day`
      : "loading...";
  }, [dailyRewardRaw, dailyRewardError, isCorrectChain, rewardTokenConfig]);

  // ★ ダッシュボードと同期するローカル緊急停止フラグのみ使用
  const isMaintenance = useEmergency();

  // ---- 最終請求時刻 → カウントダウン（エラーハンドリング強化）----
  const lastClaimedSec = useMemo<number | undefined>(() => {
    if (userInfoError) {
      console.warn("userInfo エラー:", userInfoError);
      return undefined;
    }
    if (!userInfoRaw || !isCorrectChain) return undefined;
    try {
      const arr = userInfoRaw as any[];
      return Number(BigInt(arr[0] ?? 0n));
    } catch (error) {
      console.warn("userInfo データ解析エラー:", error);
      return undefined;
    }
  }, [userInfoRaw, userInfoError, isCorrectChain]);

  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const nextAvailable = useMemo(() => {
    if (!lastClaimedSec) return 0;
    return lastClaimedSec + 24 * 60 * 60;
  }, [lastClaimedSec]);

  const remain = Math.max(0, nextAvailable - now);
  const [isWriting, setIsWriting] = useState(false);

  // ★メンテ中は請求不可（それ以外は元UIのまま）
  const canClaim = !!address && remain === 0 && !isWriting && !isMaintenance;

  // ---- ウォレット接続時は常時ウォレット追加を表示（レイアウト固定）----
  const [showAddToken, setShowAddToken] = useState(false);
  
  // ウォレット接続状態でトークン追加ボタンを表示
  useEffect(() => {
    if (address) {
      setShowAddToken(true);
    } else {
      setShowAddToken(false);
    }
  }, [address]);
  
  // ---- 成功メッセージ表示用ステート ----
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const addTokenToWallet = async () => {
    try {
      // モバイルデバイス検出
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const eth = (window as any).ethereum;
      
      // Web3プロバイダーの存在確認
      if (!eth) {
        if (isMobileDevice) {
          alert("⚠️ モバイルではウォレットアプリ内のブラウザをお使いください。\n\nMetaMaskアプリ → ブラウザタブからアクセスしてください。");
        } else {
          alert("⚠️ MetaMaskが見つかりません。拡張機能をインストールしてください。");
        }
        return;
      }
      
      // wallet_watchAssetサポート確認
      const supportsWatchAsset = typeof eth.request === 'function';
      if (!supportsWatchAsset) {
        alert(`⚠️ お使いのウォレットはトークン自動追加に対応していません。\n\n手動でトークンを追加してください:\nアドレス: ${rewardTokenConfig.currentAddress}\nシンボル: ${rewardTokenConfig.symbol}`);
        return;
      }

      // モバイルでは画像なしでトークン追加を試行
      const tokenParams = {
        type: "ERC20",
        options: {
          address: rewardTokenConfig.currentAddress,
          symbol: rewardTokenConfig.symbol,
          decimals: rewardTokenConfig.decimals,
          // モバイルでは画像を省略（安定性向上）
          ...(isMobileDevice ? {} : { image: rewardTokenConfig.icon || undefined })
        },
      };

      const wasAdded = await eth.request({
        method: "wallet_watchAsset",
        params: tokenParams,
      });

      if (wasAdded) {
        alert(`✅ ${rewardTokenConfig.symbol} をウォレットに追加しました！`);
      } else {
        alert("ℹ️ 追加はキャンセルされました。");
      }
    } catch (e: any) {
      console.error('🚨 トークン追加エラー:', e);
      
      // エラーの種類に応じた詳細メッセージ
      let errorMessage = "⚠️ トークン追加に失敗しました。";
      
      if (e?.code === -32602) {
        errorMessage += "\n\nパラメータエラー: ウォレットがこの操作に対応していない可能性があります。";
      } else if (e?.code === -32601) {
        errorMessage += "\n\nメソッドエラー: wallet_watchAssetがサポートされていません。";
      } else if (e?.code === 4001) {
        errorMessage = "ℹ️ ユーザーによってキャンセルされました。";
      } else if (e?.message?.includes('User rejected')) {
        errorMessage = "ℹ️ ユーザーによって拒否されました。";
      } else {
        errorMessage += `\n\n手動でトークンを追加してください:\nアドレス: ${rewardTokenConfig.currentAddress}\nシンボル: ${rewardTokenConfig.symbol}`;
      }
      
      alert(errorMessage);
    }
  };

  const fmt = (s: number) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const onClaim = async () => {
    if (!canClaim || !contract) return;

    // 事前チェック（モバイル対応改善）
    try {
      // ThirdWebの接続状態を優先チェック
      if (!address) {
        throw new Error("ウォレットが接続されていません。接続ボタンをクリックしてください。");
      }
      
      // Web3プロバイダー検知（モバイルアプリ対応改善）
      const eth = (window as any).ethereum;
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      if (!eth) {
        if (isMobileDevice) {
          // モバイルデバイスでWeb3プロバイダーがない場合
          throw new Error("モバイルではウォレットアプリからアクセスしてください。\n\n推奨手順:\n1. MetaMaskアプリをインストール\n2. アプリ内ブラウザでこのサイトを開く\n3. アプリ内でウォレットを接続");
        } else {
          throw new Error("MetaMaskまたは対応ウォレットが見つかりません。\n\nMetaMask拡張機能をインストールしてください。");
        }
      }
      
      // アカウント確認（モバイルでは異なるアプローチ）
      try {
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (!accounts || accounts.length === 0) {
          throw new Error("ウォレットアカウントが見つかりません");
        }
      } catch (accountError: any) {
        // モバイルアプリではアカウント取得が異なる場合がある
        console.warn("アカウント確認エラー:", accountError);
        // ThirdWebが既に接続されている場合は続行
        if (!address) {
          throw new Error("ウォレットのアカウントアクセスに失敗しました。ウォレットアプリで接続を確認してください。");
        }
      }
      
      // チェーン確認と切り替え
      const currentChainId = await eth.request({ method: "eth_chainId" });
      if ((currentChainId || "").toLowerCase() !== "0x13882") {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x13882" }],
          });
          // チェーン切り替え後の待機
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // ネットワークが存在しない場合は追加
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x13882",
                chainName: "Polygon Amoy Testnet",
                nativeCurrency: {
                  name: "MATIC",
                  symbol: "MATIC",
                  decimals: 18
                },
                rpcUrls: ["https://rpc-amoy.polygon.technology/"],
                blockExplorerUrls: ["https://amoy.polygonscan.com/"]
              }]
            });
          } else {
            throw switchError;
          }
        }
      }
    } catch (e: any) {
      console.error("事前チェック失敗:", e);
      const errorMsg = e?.message || "不明なエラー";
      
      // モバイルユーザー向けの具体的なエラーメッセージ
      let userFriendlyMessage = "";
      
      if (errorMsg.includes("モバイルではウォレットアプリ")) {
        userFriendlyMessage = "📱 モバイルでのアクセス方法\n\n";
        userFriendlyMessage += "🔄 以下の手順でアクセスしてください:\n\n";
        userFriendlyMessage += "1️⃣ MetaMaskアプリをインストール\n";
        userFriendlyMessage += "2️⃣ アプリを開いてウォレットを作成/インポート\n";
        userFriendlyMessage += "3️⃣ アプリ内のブラウザタブをタップ\n";
        userFriendlyMessage += "4️⃣ このサイトのURLを入力してアクセス\n\n";
        userFriendlyMessage += "⚠️ 通常のブラウザではウォレット接続できません";
      } else if (errorMsg.includes("チェーン切り替えを拒否")) {
        userFriendlyMessage = "🔗 ネットワーク切り替えが必要です\n\n";
        userFriendlyMessage += "• ウォレットで 'Polygon Amoy' ネットワークを選択\n";
        userFriendlyMessage += "• ネットワーク切り替えを承認してください";
      } else {
        userFriendlyMessage = "🚫 ウォレット接続エラー\n\n";
        userFriendlyMessage += `エラー: ${errorMsg}\n\n`;
        userFriendlyMessage += "🔍 解決方法:\n";
        userFriendlyMessage += "• ウォレットアプリが正しく接続されているか確認\n";
        userFriendlyMessage += "• Polygon Amoy テストネットに接続しているか確認";
      }
      
      alert(userFriendlyMessage);
      return;
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const maxTry = 3;
    let lastErr: any = null;
    setIsWriting(true);

    // まずethers直接経由を試す（より安定）
    try {
      const provider = new ethers.providers.Web3Provider(
        (window as any).ethereum
      );
      const signer = provider.getSigner();
      const directContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI as any,
        signer
      );
      
      // ガス見積もりを事前に実行
      const gasEstimate = await directContract.estimateGas.claimDailyReward();
      
      const tx = await directContract.claimDailyReward({
        gasLimit: gasEstimate.mul(120).div(100) // 20%のバッファ
      });
      
      const receipt = await tx.wait();
      
      // 成功時の処理
      const tryEvents = ["DailyRewardClaimed", "DailyClaimed", "RewardClaimed"];
      let args: any = null;
      for (const ev of tryEvents) {
        args = getEventArgsFromReceipt(
          receipt,
          ev,
          CONTRACT_ADDRESS,
          CONTRACT_ABI
        );
        if (args) break;
      }

      if (args) {
        // 🎉 リワード受け取り成功エフェクト
        rewardSuccessConfetti().catch(console.warn);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else {
        // 🎉 取引送信成功エフェクト
        rewardSuccessConfetti().catch(console.warn);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
      
      // showAddTokenは常時表示のため削除
      setIsWriting(false);
      return;
      
    } catch (directError: any) {
      console.warn("Direct ethers failed, trying ThirdWeb:", directError);
      lastErr = directError;
    }

    // ethersが失敗した場合のThirdWebフォールバック
    for (let i = 0; i < maxTry; i++) {
      try {
        // ThirdWeb経由でのトランザクション送信
        const res: any = await (contract as any).call("claimDailyReward", []);
        let receipt =
          res?.receipt ??
          (typeof res?.wait === "function" ? await res.wait() : undefined) ??
          res;

        if (!receipt && res?.hash && (window as any).ethereum) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          receipt = await provider.getTransactionReceipt(res.hash);
        }

        // 受領イベント（元UIのまま）
        const tryEvents = ["DailyRewardClaimed", "DailyClaimed", "RewardClaimed"];
        let args: any = null;
        for (const ev of tryEvents) {
          args = getEventArgsFromReceipt(
            receipt,
            ev,
            CONTRACT_ADDRESS,
            CONTRACT_ABI
          );
          if (args) break;
        }

        if (args) {
          // 🎉 リワード受け取り成功エフェクト
          // 1. コンフェッティ（紙吹雪）
          rewardSuccessConfetti().catch(console.warn);

          // 2. 成功メッセージ表示
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);

          // showAddTokenは常時表示のため削除
        } else {
          // 🎉 取引送信成功エフェクト
          rewardSuccessConfetti().catch(console.warn);
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);

          // showAddTokenは常時表示のため削除
        }
        setIsWriting(false);
        return;
      } catch (err: any) {
        console.warn(`[ThirdWeb try ${i + 1}/${maxTry}] failed:`, err);
        lastErr = err;
        
        const msg = (err?.message || "").toLowerCase();
        const isRetriable =
          msg.includes("parse") ||
          msg.includes("json") ||
          msg.includes("rate") ||
          msg.includes("429") ||
          msg.includes("network") ||
          msg.includes("timeout") ||
          msg.includes("connection");
          
        // 致命的なエラーの場合は即座に終了
        if (msg.includes("insufficient funds") || 
            msg.includes("execution reverted") ||
            msg.includes("already claimed")) {
          break;
        }
        
        if (i < maxTry - 1 && isRetriable) {
          const waitTime = 1000 * (i + 1); // 1s, 2s, 3s
          await sleep(waitTime);
          continue;
        }
      }
    }

    setIsWriting(false);
    
    // 詳細なエラー分析と適切なユーザーメッセージ
    const errorReason = lastErr?.reason || lastErr?.data?.message || lastErr?.message || "不明なエラー";
    const errorCode = lastErr?.code;
    const errorMsg = errorReason.toLowerCase();
    
    let userMessage = "";
    
    if (errorMsg.includes("internal json-rpc error")) {
      userMessage = `🔧 RPC接続エラーが発生しました\n\n原因と対処法:\n• Polygon Amoyネットワークの一時的な混雑\n• RPCエンドポイントの問題\n• ウォレットの接続状態\n\n⏰ 数分待ってから再度お試しください\n💡 他のRPCエンドポイントも自動で試行済みです`;
    } else if (errorMsg.includes("insufficient funds") || errorCode === -32000) {
      userMessage = `💰 ガス代不足エラー\n\nMATICが不足しています:\n• Polygon Amoy testnet用のMATICが必要\n• 最低 0.01 MATIC以上を推奨\n\n🚰 Faucetから無料でMATICを取得:\nhttps://faucet.polygon.technology/`;
    } else if (errorMsg.includes("already claimed") || errorMsg.includes("too early")) {
      userMessage = `⏰ 請求制限エラー\n\n既に本日分を受け取り済みです\n次の請求まで: ${remain > 0 ? fmt(remain) : '計算中...'}\n\n📅 24時間に1回のみ請求可能です`;
    } else if (errorMsg.includes("execution reverted")) {
      userMessage = `❌ スマートコントラクト実行エラー\n\n考えられる原因:\n• 請求条件を満たしていない\n• コントラクトの一時的な問題\n• ネットワークの不安定\n\n🔄 時間をおいて再度お試しください`;
    } else if (errorMsg.includes("user rejected") || errorCode === 4001) {
      userMessage = `🚫 ユーザーキャンセル\n\nトランザクションがキャンセルされました\n再度お試しいただけます`;
    } else if (errorMsg.includes("network") || errorMsg.includes("timeout")) {
      userMessage = `🌐 ネットワークエラー\n\n接続に問題があります:\n• インターネット接続を確認\n• VPNを使用している場合は無効化\n• 時間をおいて再度お試し`;
    } else if (errorMsg.includes("401") || errorMsg.includes("unauthorized")) {
      userMessage = `🔑 認証エラー\n\nThirdWeb APIの認証に失敗:\n• 一時的なAPIの問題\n• 設定の不具合\n\n⏰ しばらく待ってから再度お試しください`;
    } else {
      userMessage = `❓ 予期しないエラー\n\nエラー内容: ${errorReason}\n\n対処法:\n• ページを再読み込み\n• ウォレットを再接続\n• 時間をおいて再試行\n\n問題が続く場合はサポートまでお問い合わせください`;
    }
    
    alert(userMessage);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100vw",
        maxWidth: "100vw",
        background: "#0a0e27",
        backgroundImage: `linear-gradient(135deg, rgba(10,14,39,${smokeOpacity}) 0%, rgba(26,32,53,${smokeOpacity * 0.95}) 100%), url(${customBgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: 0,
        margin: 0,
        overflowX: "hidden",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* ヘッダー - テナントオーナーのプランロゴ */}
      <header
        style={{
          width: "100%",
          padding: "16px 20px",
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={getHeaderLogo()}
            alt="Tenant Plan Logo"
            style={{
              height: 50,
              width: "auto",
              maxWidth: "280px",
              objectFit: "contain",
              filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))",
            }}
          />
        </div>
      </header>

      {/* 中央コンテンツ */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 20px 32px",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
          gap: 32,
        }}
      >
        {/* タイトルセクション */}
        <div style={{ textAlign: "center", marginBottom: 0 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              margin: "0 0 12px",
              lineHeight: 1.2,
              fontWeight: 800,
              background: "linear-gradient(135deg, #fff 0%, #a5b4fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
              letterSpacing: "-0.02em",
            }}
          >
            💎 Daily Reward
          </h1>
          <p
            style={{
              fontSize: 15,
              opacity: 0.7,
              margin: 0,
              fontWeight: 400,
              letterSpacing: "0.01em",
            }}
          >
            毎日プレミアムトークンを受け取ろう
          </p>
        </div>

        {/* アクションボタングループ */}
        <div
          style={{
            width: "100%",
            maxWidth: "600px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            alignItems: "center",
          }}
        >
          {/* 接続ボタングループ（未接続時のみ表示） */}
          {!address && (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: "center",
                width: "100%",
              }}
            >
              {!authenticated && (
                <button
                  onClick={login}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 56,
                    padding: "0 28px",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#fff",
                    borderRadius: 16,
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.3s",
                    boxShadow: "0 6px 20px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                    letterSpacing: "0.01em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 28px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
                  }}
                >
                  📧 メールでログイン
                </button>
              )}

              <div style={{ display: "flex", alignItems: "center", minHeight: 56 }}>
                <ConnectWallet
                  theme="dark"
                  modalTitle="外部ウォレット接続"
                  modalTitleIconUrl=""
                />
              </div>
            </div>
          )}

          {/* 統合情報カード（ウォレット + リワード情報） */}
          <div
            style={{
              width: "100%",
              maxWidth: "450px",
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)",
              backdropFilter: "blur(16px)",
              padding: "16px 20px",
              borderRadius: 16,
              border: "1px solid rgba(148, 163, 184, 0.15)",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.5,
              display: "grid",
              rowGap: 8,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.4)",
                marginBottom: 2,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Reward Information
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "start" }}>
              <strong style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 12 }}>Wallet:</strong>
              <span style={{
                color: address ? "#a5f3fc" : "rgba(255,255,255,0.5)",
                fontFamily: "monospace",
                fontSize: 12,
                wordBreak: "break-all",
                fontWeight: address ? 600 : 500,
              }}>
                {address ? (
                  privyEmbeddedWalletAddress
                    ? `📧 ${address.slice(0, 6)}...${address.slice(-4)}`
                    : `🦊 ${address.slice(0, 6)}...${address.slice(-4)}`
                ) : "未接続"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
              <strong style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 12 }}>Chain:</strong>
              <span style={{ color: "#a5f3fc", fontSize: 12 }}>
                {chain ? `${chain.name} (${chain.chainId})` : "—"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
              <strong style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 12 }}>Daily Reward:</strong>
              <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 13 }}>{dailyReward}</span>
            </div>
            {(!!dailyRewardError || !!userInfoError) && (
              <div
                style={{
                  color: "#fbbf24",
                  fontSize: 12,
                  marginTop: 4,
                  padding: "8px 12px",
                  background: "rgba(251, 191, 36, 0.1)",
                  borderRadius: 8,
                  border: "1px solid rgba(251, 191, 36, 0.2)",
                }}
              >
                ⚠️ データ読み込みエラーが発生しました
              </div>
            )}
          </div>

          {/* メインクレームボタン */}
          <button
            onClick={isMaintenance ? undefined : onClaim}
            disabled={!canClaim}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 64,
              padding: "0 40px",
              background: canClaim
                ? "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)"
                : "linear-gradient(135deg, rgba(71, 85, 105, 0.5) 0%, rgba(51, 65, 85, 0.5) 100%)",
              color: "#fff",
              borderRadius: 20,
              border: canClaim ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255,255,255,0.1)",
              cursor: canClaim ? "pointer" : "not-allowed",
              fontSize: 17,
              fontWeight: 800,
              lineHeight: 1,
              opacity: canClaim ? 1 : 0.5,
              boxShadow: canClaim
                ? "0 8px 32px rgba(239, 68, 68, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.2)"
                : "0 4px 12px rgba(0, 0, 0, 0.3)",
              transition: "all 0.3s ease",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              width: "100%",
              maxWidth: "400px",
            }}
            onMouseEnter={(e) => {
              if (canClaim) {
                e.currentTarget.style.transform = "translateY(-3px) scale(1.02)";
                e.currentTarget.style.boxShadow = "0 12px 40px rgba(239, 68, 68, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (canClaim) {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(239, 68, 68, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.2)";
              }
            }}
          >
            {isMaintenance
              ? "⛔ メンテナンス中"
              : isWriting
              ? "⏳ 送信中…"
              : canClaim
              ? "💎 リワードを請求する"
              : "⏰ カウントダウン中"}
          </button>
        </div>

        {/* カウントダウン表示 */}
        <div
          style={{
            width: "100%",
            maxWidth: "450px",
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.04) 100%)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(96, 165, 250, 0.15)",
            borderRadius: 16,
            padding: "20px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.5)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Status
          </div>
          <div
            style={{
              fontSize: remain > 0 ? 32 : 20,
              fontWeight: 800,
              color: !address
                ? "rgba(255, 255, 255, 0.5)"
                : isMaintenance
                ? "#fbbf24"
                : remain > 0
                ? "#60a5fa"
                : "#4ade80",
              fontFamily: "monospace",
              letterSpacing: remain > 0 ? "0.05em" : "0.01em",
            }}
          >
            {!address
              ? "ウォレット未接続"
              : isMaintenance
              ? "⛔ 現在メンテナンス中"
              : remain > 0
              ? fmt(remain)
              : "✨ 受け取り可能です"}
          </div>
          {!address || isMaintenance || remain === 0 ? null : (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255, 255, 255, 0.4)",
                marginTop: 8,
                fontWeight: 500,
              }}
            >
              次の受け取りまで
            </div>
          )}
        </div>

        {/* トークン追加セクション */}
        {showAddToken && (
          <div
            style={{
              width: "100%",
              maxWidth: "450px",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(52, 211, 153, 0.15)",
              borderRadius: 16,
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.6)",
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              💡 初めて {rewardTokenConfig.symbol} を受け取る方はこちら
            </div>
            <button
              onClick={addTokenToWallet}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                padding: "0 24px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                transition: "all 0.3s ease",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
              }}
            >
              🪙 {rewardTokenConfig.symbol} をウォレットに追加
            </button>
          </div>
        )}

        {/* 広告カルーセル */}
        <div
          style={{
            width: "100%",
            maxWidth: "350px",
            marginTop: 8,
          }}
        >
          <AdCarousel
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
            }}
          />
        </div>
      </div>

      {/* フッター */}
      <footer
        style={{
          width: "100%",
          padding: "20px",
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.4)",
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          Powered by <strong style={{ color: "rgba(255, 255, 255, 0.6)" }}>GIFTERRA</strong>
        </div>
      </footer>

      {/* 成功メッセージオーバーレイ */}
      {showSuccessMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
              borderRadius: 24,
              padding: "32px 48px",
              textAlign: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "#fff",
              boxShadow: "0 16px 48px rgba(239, 68, 68, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)",
              animation: "scaleIn 0.4s ease-out",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              letterSpacing: "0.01em",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
            <div>本日のリワードを受け取りました！</div>
          </div>
        </div>
      )}

      {/* CSS アニメーション */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </main>
  );
}