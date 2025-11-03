// src/admin/reward/RewardUIManagementPage.tsx
// リワードUI管理ページ - タブ切り替え式（GIFT HUB管理画面と統一）
import React, { useState, useRef } from 'react';
import { uploadImage, deleteFileFromUrl } from '../../lib/supabase';
import { TOKEN, CONTRACT_ADDRESS } from '../../contract';
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
  const [activeTab, setActiveTab] = useState<TabType>('contract');
  const [rewardBgImage, setRewardBgImage] = useState<string>(() => {
    return localStorage.getItem('reward-bg-image') || '';
  });

  // 以前の背景画像URLを追跡（古い画像削除用）
  const previousRewardBgRef = useRef<string>(localStorage.getItem('reward-bg-image') || '');

  const handleSaveDesign = () => {
    saveAdData(editingAds);
    // 背景画像も保存
    if (rewardBgImage) {
      localStorage.setItem('reward-bg-image', rewardBgImage);
    } else {
      localStorage.removeItem('reward-bg-image');
    }
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

        {/* Reward UI URL（右上に配置） */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 500 }}>
          <input
            type="text"
            value={typeof window !== 'undefined' ? `${window.location.origin}/reward` : '/reward'}
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
              minWidth: 200
            }}
          />
          <button
            onClick={() => {
              const url = typeof window !== 'undefined' ? `${window.location.origin}/reward` : '/reward';
              navigator.clipboard.writeText(url);
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
                      `${Number(contractBalance) / 1e18} ${TOKEN.SYMBOL}`
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
                      `${Number(currentDailyReward) / 1e18} ${TOKEN.SYMBOL}`
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
                  ※ コントラクトアドレス: {CONTRACT_ADDRESS}
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

            {/* 広告管理セクション */}
            <div style={{ marginBottom: 20, padding: 16, background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 16 }}>🎯 広告画像管理</h4>
              <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.8, fontSize: 14 }}>
                <li>最大3つの広告スロットを設定できます</li>
                <li>広告画像: ローカルフォルダから画像を選択してアップロード</li>
                <li>リンクURL: クリック時に開くWebサイトのURL</li>
              </ul>
            </div>

            {editingAds.map((ad, index) => (
              <div key={index} style={{
                marginBottom: 16,
                padding: 16,
                background: "rgba(255,255,255,.06)",
                borderRadius: 8,
                position: "relative",
                display: "flex",
                gap: 16
              }}>
                {/* 画像プレビュー */}
                <div style={{
                  width: 80,
                  height: 80,
                  background: "rgba(255,255,255,.1)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden"
                }}>
                  {ad.src ? (
                    <img
                      src={ad.src}
                      alt={`広告プレビュー ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 6
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const nextSibling = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (nextSibling) {
                          nextSibling.style.display = "flex";
                        }
                      }}
                    />
                  ) : null}
                  <div style={{
                    display: ad.src ? "none" : "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "rgba(255,255,255,.5)",
                    textAlign: "center",
                    padding: 8
                  }}>
                    画像なし
                  </div>
                </div>

                {/* 入力フィールド */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 16 }}>広告スロット {index + 1}</h4>
                    {editingAds.length > 1 && (
                      <button
                        onClick={() => removeAdSlot(index)}
                        style={{
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          padding: "4px 8px",
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        削除
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 14, opacity: 0.8 }}>
                      広告画像:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, index)}
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

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 14, opacity: 0.8 }}>
                      リンクURL:
                    </label>
                    <input
                      type="text"
                      value={ad.href}
                      onChange={(e) => updateAd(index, 'href', e.target.value)}
                      placeholder="https://example.com/"
                      style={{
                        width: "100%",
                        padding: 8,
                        background: "rgba(255,255,255,.1)",
                        border: "1px solid rgba(255,255,255,.2)",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 14
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {editingAds.length < 3 && (
              <button
                onClick={addAdSlot}
                style={{
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: 24
                }}
              >
                ➕ 広告スロット追加
              </button>
            )}

            {/* 背景画像設定セクション */}
            <div style={{ marginTop: 32, padding: 16, background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 16 }}>🎨 Reward UI 背景画像設定</h4>
              <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, opacity: 0.8, fontSize: 14 }}>
                <li>Reward UI の背景画像を設定できます</li>
              </ul>

              <div style={{ marginBottom: 12 }}>
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

              {/* プレビュー */}
              {rewardBgImage && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>プレビュー:</div>
                  <div style={{
                    width: "100%",
                    height: 200,
                    background: `url(${rewardBgImage}) center/cover`,
                    borderRadius: 8,
                    border: "2px solid rgba(255,255,255,.2)"
                  }} />
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
