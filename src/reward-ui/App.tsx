// src/reward-ui/App.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ConnectWallet,
  useAddress,
  useChain,
  useContract,
  useContractRead,
} from "@thirdweb-dev/react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract";
import { useEmergency } from "../lib/emergency";
import { AdCarousel } from "../components/AdCarousel";
import { rewardSuccessConfetti } from "../utils/confetti";
import type { TokenId } from "../config/tokens";
import { getTokenConfig } from "../config/tokens";

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
  const address = useAddress();
  const chain = useChain();
  const { contract } = useContract(CONTRACT_ADDRESS, CONTRACT_ABI);

  // Rewardトークン設定（ユーティリティトークン限定）
  // TODO: 将来的にTenantContextから取得
  const rewardTokenId: TokenId = 'NHT'; // デフォルトはNHT（ユーティリティトークン）
  const rewardTokenConfig = useMemo(() => getTokenConfig(rewardTokenId), [rewardTokenId]);

  // 背景画像をlocalStorageから取得（管理画面で設定可能）
  const [customBgImage] = useState<string>(() => {
    return localStorage.getItem('reward-bg-image') || '/ads/ui-wallpeaper.png';
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
  const isCorrectChain = chain?.chainId === 80002; // Polygon Amoy
  
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
        background: "#0b1620",
        backgroundImage: `url(${customBgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        color: "#fff",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        alignContent: "start",
        padding: "14px 10px 16px",
        margin: 0,
        overflowX: "hidden",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* タイトル（ロゴなし・モダンフォント） */}
      <div style={{ textAlign: "center", marginTop: 8, marginBottom: 20 }}>
        <h1
          style={{
            fontSize: "clamp(24px, 3vw, 32px)",
            margin: "0 0 8px",
            lineHeight: 1.2,
            fontWeight: 800,
            textShadow: "0 2px 12px rgba(0,0,0,0.5)"
          }}
        >
          🎁 Daily Reward
        </h1>
        <p style={{
          fontSize: 14,
          opacity: 0.85,
          margin: 0,
          fontWeight: 500
        }}>
          毎日トークンを受け取ろう
        </p>
      </div>

      {/* 中央コンテンツ */}
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 12,
          paddingTop: 4
        }}
      >
        {/* 接続状態 */}
        <p
          style={{
            margin: "0 0 6px 0",
            fontSize: 13,
            fontWeight: address ? 700 : 400,
            color: address ? "#4ade80" : "rgba(255,255,255,0.75)"
          }}
        >
          {address ? `接続済み: ${address.slice(0, 6)}...${address.slice(-4)}` : "ウォレットを接続してください"}
        </p>

        {/* ボタン行（高さ統一・配置修正） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 8
          }}
        >
          <div style={{ 
            display: "flex", 
            alignItems: "center",
            height: 48 // ウォレット接続ボタンの高さ基準
          }}>
            <ConnectWallet 
              theme="dark" 
              modalTitle="リワード受け取り用ウォレット接続"
              modalTitleIconUrl=""
            />
          </div>
          <button
            onClick={isMaintenance ? undefined : onClaim}
            disabled={!canClaim}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 20px",
              background: canClaim
                ? "linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)"
                : "rgba(58, 63, 70, 0.8)",
              color: "#fff",
              borderRadius: 12,
              border: canClaim ? "none" : "1px solid rgba(255,255,255,0.1)",
              cursor: canClaim ? "pointer" : "not-allowed",
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1,
              opacity: canClaim ? 1 : 0.7,
              boxShadow: canClaim ? "0 4px 16px rgba(255,107,107,0.3)" : "none",
              transition: "all 0.2s ease"
            }}
          >
            {isMaintenance
              ? "メンテナンス中"
              : isWriting
              ? "送信中…"
              : canClaim
              ? "リワードを請求する"
              : "カウントダウン中"}
          </button>
        </div>

        {/* 状態表示（元レイアウト） */}
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4, minHeight: 16 }}>
          {!address
            ? "ウォレット未接続"
            : isMaintenance
            ? "⛔ 現在メンテナンス中"
            : remain > 0
            ? `次の受け取りまで: ${fmt(remain)}`
            : "受け取り可能です ✨"}
        </div>

        {/* ウォレット追加（成功時のみ表示） */}
        <div style={{ height: 56, display: "grid", placeItems: "center" }}>
          {showAddToken && (
            <div style={{ display: "grid", justifyItems: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                💡 初めて {rewardTokenConfig.symbol} を受け取る方はこちら
              </div>
              <button
                onClick={addTokenToWallet}
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
                  transition: "all 0.2s ease"
                }}
              >
                {rewardTokenConfig.symbol} をウォレットに追加 🪙
              </button>
            </div>
          )}
        </div>

        {/* 情報カード（モダンスタイル） */}
        <div
          style={{
            boxSizing: "border-box",
            width: "min(88vw, 520px)",
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            textAlign: "left",
            fontSize: 13,
            lineHeight: 1.5,
            display: "grid",
            rowGap: 6,
            marginTop: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
          }}
        >
          <div><strong>Address:</strong> {address ?? "—"}</div>
          <div><strong>Chain:</strong> {chain ? `${chain.name} (${chain.chainId})` : "—"}</div>
          <div><strong>Daily Reward:</strong> {dailyReward}</div>
          {(!!dailyRewardError || !!userInfoError) && (
            <div style={{ color: "#ff6b6b", fontSize: 11, marginTop: 4 }}>
              ⚠️ データ読み込みエラーが発生しました
            </div>
          )}
        </div>

        {/* 特許回避NFTウィジェット（オプション） */}
        {/*
        <PatentSafeNFTWidget 
          systemId={1}
          className="patent-safe-integration"
        />
        */}

        {/* 広告スライドショー（localStorageから自動読み込み） */}
        <AdCarousel
          style={{
            width: "clamp(200px, 28vw, 240px)",
            height: "auto",
            marginTop: 18,
          }}
        />
      </div>

      {/* フッター */}
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          opacity: 0.6,
          marginTop: 16,
          marginBottom: 6
        }}
      >
        Presented by <strong>METATRON.</strong>
      </div>

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
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            animation: "fadeIn 0.3s ease-in-out"
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              borderRadius: "16px",
              padding: "24px 32px",
              textAlign: "center",
              fontSize: "18px",
              fontWeight: 800,
              color: "#fff",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              animation: "scaleIn 0.4s ease-out"
            }}
          >
            💎本日のリワードを受け取りました！
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