// src/admin/reward/RewardUIManagementPage.tsx
// リワードUI管理ページ - タブ切り替え式（GIFT HUB管理画面と統一）
import React, { useState, useRef } from 'react';
import { uploadImage, deleteFileFromUrl } from '../../lib/supabase';
import { getGifterraAddress } from '../../contract';
import { getDefaultToken } from '../../config/tokenHelpers';
import { RewardDistributionHistoryTab } from './components/RewardDistributionHistoryTab';

export interface AdData {
  src: string;
  href: string;
}

export interface RewardUIManagementPageProps {
  editingAds: AdData[];
  updateAd: (index: number, field: 'src' | 'href', value: string) => void;
  addAdSlot: () => void;
  removeAdSlot: (index: number) => void;
  saveAdData: (ads: AdData[]) => void;
  previousAdImagesRef: React.MutableRefObject<string[]>;
  contractBalance: any;
  contractBalanceError: any;
  dailyRewardError: any;
  currentDailyReward: any;
  RewardTokenChargeSection: () => JSX.Element;
  RewardAmountSettingSection: () => JSX.Element;
}

type TabType = 'contract' | 'design' | 'distribution-history';

export function RewardUIManagementPage({
  editingAds,
  updateAd,
  addAdSlot,
  removeAdSlot,
  saveAdData,
  previousAdImagesRef,
  contractBalance,
  contractBalanceError,
  dailyRewardError,
  currentDailyReward,
  RewardTokenChargeSection,
  RewardAmountSettingSection
}: RewardUIManagementPageProps) {
  // マルチトークン対応：環境に応じたトークン設定
  const defaultToken = getDefaultToken();
  const [activeTab, setActiveTab] = useState<TabType>('contract');
  // テナントオーナーのアドレスを取得（ウォレット接続されている場合）
  const tenantAddress = getGifterraAddress();

  // テナント専用のlocalStorageキーを生成
  const rewardBgImageKey = `reward-bg-image-${tenantAddress}`;
  const rewardSmokeOpacityKey = `reward-smoke-opacity-${tenantAddress}`;

  const [rewardBgImage, setRewardBgImage] = useState<string>(() => {
    return localStorage.getItem(rewardBgImageKey) || '';
  });

  // スモーク濃度（0.0 〜 1.0、デフォルト0.9）
  const [smokeOpacity, setSmokeOpacity] = useState<number>(() => {
    const saved = localStorage.getItem(rewardSmokeOpacityKey);
    return saved ? parseFloat(saved) : 0.9;
  });

  // テナント専用Reward UIのURLを生成
  const rewardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/reward?tenant=${tenantAddress}`
    : `/reward?tenant=${tenantAddress}`;

  // 以前の背景画像URLを追跡（古い画像削除用）
  const previousRewardBgRef = useRef<string>(localStorage.getItem(rewardBgImageKey) || '');

  const handleSaveDesign = () => {
    // 背景画像を保存（テナント専用キー）
    if (rewardBgImage) {
      localStorage.setItem(rewardBgImageKey, rewardBgImage);
    } else {
      localStorage.removeItem(rewardBgImageKey);
    }
    // スモーク濃度を保存
    localStorage.setItem(rewardSmokeOpacityKey, smokeOpacity.toString());
    alert('✅ デザイン設定を保存しました！');
  };

  // 画像アップロードハンドラー（ProductFormと同じパターン）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      // 新しい画像をアップロード
      const imageUrl = await uploadImage(file, 'gh-public');

      if (imageUrl) {
        // 古い画像を削除（差し替えの場合）
        const previousUrl = previousAdImagesRef.current[index];
        if (previousUrl && previousUrl !== imageUrl) {
          await deleteFileFromUrl(previousUrl);
        }

        // 新しい画像を設定
        updateAd(index, 'src', imageUrl);
        previousAdImagesRef.current[index] = imageUrl;
        alert('✅ 画像のアップロードが完了しました！\n保存ボタンを押して設定を保存してください。');
      }
    } catch (error: any) {
      console.error('❌ 画像アップロードエラー:', error);
      alert(`❌ 画像のアップロードに失敗しました。\n\nエラー: ${error?.message || '不明なエラー'}\n\n詳細はコンソールを確認してください。`);
    } finally {
      // ファイル入力をリセット（同じファイルを再度選択できるようにする）
      e.target.value = '';
    }
  };

  // 背景画像アップロードハンドラー
  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      // 新しい背景画像をアップロード
      const imageUrl = await uploadImage(file, 'gh-public');

      if (imageUrl) {
        // 古い背景画像を削除（差し替えの場合）
        const previousUrl = previousRewardBgRef.current;
        if (previousUrl && previousUrl !== imageUrl) {
          await deleteFileFromUrl(previousUrl);
        }

        // 新しい背景画像を設定
        setRewardBgImage(imageUrl);
        previousRewardBgRef.current = imageUrl;
        alert('✅ 背景画像のアップロードが完了しました！\n保存ボタンを押して設定を保存してください。');
      }
    } catch (error: any) {
      console.error('❌ 背景画像アップロードエラー:', error);
      alert(`❌ 背景画像のアップロードに失敗しました。\n\nエラー: ${error?.message || '不明なエラー'}\n\n詳細はコンソールを確認してください。`);
    } finally {
      // ファイル入力をリセット
      e.target.value = '';
    }
  };

  return (
    <div style={{
      width: "min(1200px, 96vw)",
      margin: "20px auto",
      background: "rgba(255,255,255,.04)",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minHeight: "calc(100vh - 200px)"
    }}>
      {/* ヘッダー：タイトルとURL */}
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid rgba(255,255,255,.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
          📱 リワードUI 総合管理
        </h2>

        {/* Reward UI URL（右上に配置） - テナント専用URL */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 600 }}>
          <input
            type="text"
            value={rewardUrl}
            readOnly
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              borderRadius: 6,
              fontFamily: 'monospace',
              outline: 'none',
              minWidth: 250
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(rewardUrl);
              const btn = document.activeElement as HTMLButtonElement;
              if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => {
                  btn.textContent = originalText;
                }, 1500);
              }
            }}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(124, 58, 237, 0.8)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            📋 コピー
          </button>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div
        style={{
          padding: '0 20px',
          borderBottom: '1px solid rgba(255,255,255,.1)',
          display: 'flex',
          gap: 4
        }}
      >
        <button
          onClick={() => setActiveTab('contract')}
          role="tab"
          aria-selected={activeTab === 'contract'}
          style={{
            padding: '12px 24px',
            background: activeTab === 'contract' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: activeTab === 'contract' ? '#3B82F6' : 'rgba(255,255,255,0.6)',
            border: 'none',
            borderBottom: activeTab === 'contract' ? '2px solid #3B82F6' : '2px solid transparent',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ⚙️ Contract Settings
        </button>
        <button
          onClick={() => setActiveTab('design')}
          role="tab"
          aria-selected={activeTab === 'design'}
          style={{
            padding: '12px 24px',
            background: activeTab === 'design' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: activeTab === 'design' ? '#3B82F6' : 'rgba(255,255,255,0.6)',
            border: 'none',
            borderBottom: activeTab === 'design' ? '2px solid #3B82F6' : '2px solid transparent',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🎨 Design Settings
        </button>
        <button
          onClick={() => setActiveTab('distribution-history')}
          role="tab"
          aria-selected={activeTab === 'distribution-history'}
          style={{
            padding: '12px 24px',
            background: activeTab === 'distribution-history' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: activeTab === 'distribution-history' ? '#3B82F6' : 'rgba(255,255,255,0.6)',
            border: 'none',
            borderBottom: activeTab === 'distribution-history' ? '2px solid #3B82F6' : '2px solid transparent',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🎁 Distribution History
        </button>
      </div>

      {/* タブコンテンツ */}
      <div
        style={{
          flex: 1,
          padding: 24,
          overflowY: 'auto',
          color: '#fff'
        }}
      >
        {/* Contract Settings タブ */}
        {activeTab === 'contract' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
              コントラクト設定
            </h3>

            {/* 現在の状態表示 */}
            <div style={{ marginBottom: 24, padding: 16, background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: 16 }}>📊 現在の状態</h4>
              <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                <div>
                  <strong>コントラクト残高:</strong> {
                    contractBalanceError ? (
                      <span style={{ color: "#ff6b6b" }}>読み込みエラー (Amoyネットワーク制限の可能性)</span>
                    ) : contractBalance ? (
                      `${Number(contractBalance) / 1e18} ${defaultToken.symbol}`
                    ) : (
                      "読み込み中..."
                    )
                  }
                </div>
                <div>
                  <strong>日次リワード量:</strong> {
                    dailyRewardError ? (
                      <span style={{ color: "#ff6b6b" }}>読み込みエラー</span>
                    ) : currentDailyReward ? (
                      `${Number(currentDailyReward) / 1e18} ${defaultToken.symbol}`
                    ) : (
                      "読み込み中..."
                    )
                  }
                </div>
                {(!!contractBalanceError || !!dailyRewardError) && (
                  <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 8, padding: 8, background: "rgba(251, 191, 36, 0.1)", borderRadius: 4 }}>
                    ⚠️ 読み込みエラーの詳細:<br/>
                    {!!contractBalanceError && <span>• 残高エラー: {(contractBalanceError as any)?.message || String(contractBalanceError)}</span>}<br/>
                    {!!dailyRewardError && <span>• リワードエラー: {(dailyRewardError as any)?.message || String(dailyRewardError)}</span>}<br/>
                    <br/>
                    💡 Amoyテストネットの制限により、データ読み込みが失敗する場合があります。<br/>
                    ページを再読み込みするか、数分後に再度お試しください。
                  </div>
                )}
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  ※ コントラクトアドレス: {getGifterraAddress()}
                </div>
              </div>
            </div>

            {/* トークンチャージセクション */}
            <RewardTokenChargeSection />

            {/* 日次リワード量変更セクション */}
            <RewardAmountSettingSection />
          </div>
        )}

        {/* Design Settings タブ */}
        {activeTab === 'design' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
              デザイン設定
            </h3>

            {/* 背景画像設定セクション */}
            <div style={{ padding: 16, background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 16 }}>🎨 Reward UI 背景画像設定</h4>
              <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, opacity: 0.8, fontSize: 14 }}>
                <li>Reward UI の背景画像を設定できます</li>
                <li>スモーク濃度でテキストの可読性を調整できます</li>
              </ul>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                  背景画像をアップロード:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBgImageUpload}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "rgba(255,255,255,.1)",
                    border: "1px solid rgba(255,255,255,.2)",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                />
              </div>
            </div>

            {/* スモーク濃度調整 & プレビュー統合セクション */}
            <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 16 }}>💨 スモーク濃度調整</h4>
              <p style={{ margin: "0 0 16px 0", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
                背景画像の上に重ねるスモークエフェクトの濃さを調整できます。<br />
                濃度が高いほど背景が暗くなり、テキストが読みやすくなります。
              </p>

              {/* スライダーコントロール */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>
                    スモーク濃度:
                  </label>
                  <span style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#3B82F6",
                    padding: "4px 12px",
                    background: "rgba(59, 130, 246, 0.1)",
                    borderRadius: 6
                  }}>
                    {Math.round(smokeOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={smokeOpacity * 100}
                  onChange={(e) => setSmokeOpacity(parseFloat(e.target.value) / 100)}
                  style={{
                    width: "100%",
                    height: 10,
                    borderRadius: 5,
                    outline: "none",
                    cursor: "pointer",
                    accentColor: "#3B82F6"
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.5, marginTop: 8 }}>
                  <span>🌅 透明 (0%)</span>
                  <span>🌙 濃い (100%)</span>
                </div>
              </div>

              {/* リアルタイムプレビュー */}
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: 0.9,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  👁️ リアルタイムプレビュー
                  <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>
                    （スライダーを動かすと即座に反映されます）
                  </span>
                </div>
                <div style={{
                  width: "100%",
                  height: 300,
                  background: rewardBgImage
                    ? `linear-gradient(135deg, rgba(10,14,39,${smokeOpacity}) 0%, rgba(26,32,53,${smokeOpacity * 0.95}) 100%), url(${rewardBgImage}) center/cover`
                    : `linear-gradient(135deg, rgba(10,14,39,${smokeOpacity}) 0%, rgba(26,32,53,${smokeOpacity * 0.95}) 100%)`,
                  borderRadius: 12,
                  border: "3px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  color: "#fff",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
                }}>
                  {/* プレビューコンテンツ */}
                  <div style={{
                    fontSize: 32,
                    fontWeight: 800,
                    textShadow: "0 4px 16px rgba(0,0,0,0.6)",
                    background: "linear-gradient(135deg, #fff 0%, #a5b4fc 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    letterSpacing: "-0.02em"
                  }}>
                    💎 Daily Reward
                  </div>
                  <div style={{
                    fontSize: 14,
                    opacity: 0.9,
                    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    textAlign: "center",
                    maxWidth: "80%"
                  }}>
                    毎日プレミアムトークンを受け取ろう
                  </div>

                  {/* 角に濃度表示 */}
                  <div style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(8px)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    スモーク: {Math.round(smokeOpacity * 100)}%
                  </div>
                </div>

                {!rewardBgImage && (
                  <div style={{
                    fontSize: 12,
                    opacity: 0.6,
                    marginTop: 12,
                    textAlign: "center",
                    padding: "8px",
                    background: "rgba(251, 191, 36, 0.1)",
                    borderRadius: 6,
                    border: "1px solid rgba(251, 191, 36, 0.2)"
                  }}>
                    💡 背景画像をアップロードすると、実際の見え方を確認できます
                  </div>
                )}

                {rewardBgImage && (
                  <div style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginTop: 12,
                    textAlign: "center",
                    color: "#4ade80"
                  }}>
                    ✅ 実際のReward UIでの見え方です
                  </div>
                )}
              </div>

              {/* 設定した背景画像のプレビュー */}
              {rewardBgImage && (
                <div style={{ marginTop: 24 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: 0.9,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}>
                    🖼️ 設定した背景画像
                    <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>
                      （スモークなし）
                    </span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: 200,
                    background: `url(${rewardBgImage}) center/cover`,
                    borderRadius: 12,
                    border: "2px solid rgba(148, 163, 184, 0.3)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
                  }} />
                  <div style={{
                    fontSize: 12,
                    opacity: 0.6,
                    marginTop: 8,
                    textAlign: "center"
                  }}>
                    この画像の上にスモークエフェクトが重なります
                  </div>
                </div>
              )}
            </div>

            {/* 保存ボタン（Designタブのみ） */}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleSaveDesign}
                style={{
                  background: "#0ea5e9",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: 16
                }}
              >
                💾 デザイン設定を保存
              </button>
            </div>
          </div>
        )}

        {/* Distribution History タブ */}
        {activeTab === 'distribution-history' && (
          <RewardDistributionHistoryTab />
        )}
      </div>
    </div>
  );
}
