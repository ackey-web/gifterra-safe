# フラグNFT手動ミント機能 実装ガイド

## 実装状況

### ✅ 完了している部分

1. **型定義**: フラグNFT型に`isBurnable`と自動配布設定フィールドを追加済み
2. **データベース**: Supabaseマイグレーションファイル作成済み
3. **フォーム**: 全カテゴリ(BENEFIT, MEMBERSHIP, ACHIEVEMENT, CAMPAIGN, ACCESS_PASS, COLLECTIBLE)の保存処理実装済み
4. **状態管理**: FlagNFTManagementPage.tsxに以下を追加済み:
   - `useEffect`, `useMintFlagNFT`のimport
   - NFTリスト管理用の状態変数
   - ミントモーダル用の状態変数
   - ミント用フックの初期化

### 🚧 実装が必要な部分

#### 1. NFTリスト取得用useEffect
ファイル: `/src/admin/components/FlagNFTManagementPage.tsx`

`isBasicFormValid()`関数の後に追加:

```typescript
// フラグNFTリストをSupabaseから取得
useEffect(() => {
  const loadFlagNFTs = async () => {
    if (!adminSupabase || !tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await adminSupabase
        .from('flag_nfts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('フラグNFT取得エラー:', error);
        setFlagNFTs([]);
      } else {
        setFlagNFTs(data || []);
      }
    } catch (err) {
      console.error('予期しないエラー:', err);
      setFlagNFTs([]);
    } finally {
      setIsLoading(false);
    }
  };

  loadFlagNFTs();
}, [tenantId, adminSupabase, refreshTrigger]);
```

#### 2. 手動ミント処理関数
`saveFlagNFT()`関数の後に追加:

```typescript
// 手動ミント処理
const handleManualMint = async () => {
  if (!selectedNFTForMint || !mintToAddress) {
    alert('ミント先アドレスを入力してください');
    return;
  }

  setIsMinting(true);
  try {
    // 1. コントラクトでNFTをミント
    console.log('🎨 NFTミント開始:', {
      category: selectedNFTForMint.category,
      toAddress: mintToAddress,
    });

    const tx = await mintNFT(mintToAddress, selectedNFTForMint.category);
    console.log('✅ NFTミント成功:', tx);

    // 2. 配布履歴をSupabaseに保存
    if (adminSupabase) {
      const { error: historyError } = await adminSupabase
        .from('flag_nft_distributions')
        .insert({
          flag_nft_id: selectedNFTForMint.id,
          user_address: mintToAddress,
          distribution_type: 'MANUAL',
          distributed_at: new Date().toISOString(),
        });

      if (historyError) {
        console.error('配布履歴保存エラー:', historyError);
      }

      // 3. total_mintedをインクリメント
      const { error: updateError } = await adminSupabase
        .from('flag_nfts')
        .update({
          total_minted: (selectedNFTForMint.total_minted || 0) + 1
        })
        .eq('id', selectedNFTForMint.id);

      if (updateError) {
        console.error('発行数更新エラー:', updateError);
      }
    }

    alert(`✅ NFTをミントしました！\nアドレス: ${mintToAddress.slice(0, 6)}...${mintToAddress.slice(-4)}`);

    // モーダルを閉じてリフレッシュ
    setShowMintModal(false);
    setMintToAddress('');
    setSelectedNFTForMint(null);
    setRefreshTrigger(prev => prev + 1);
  } catch (error) {
    console.error('❌ ミントエラー:', error);
    alert(`ミントに失敗しました: ${error}`);
  } finally {
    setIsMinting(false);
  }
};
```

#### 3. リスト表示UIの更新
現在の`if (view === 'list')`セクション（行386-494）を以下に置き換え:

```typescript
if (view === 'list') {
  // フィルタリング処理
  const filteredNFTs = categoryFilter === 'ALL'
    ? flagNFTs
    : flagNFTs.filter(nft => nft.category === categoryFilter);

  return (
    <div style={{ padding: 24 }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>
            フラグNFT管理
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '8px 0 0 0' }}>
            特典NFT、スタンプラリー、会員証などを作成・管理
          </p>
        </div>
        <button
          onClick={() => {
            setView('create');
            setCreateStep('category');
            setSelectedCategory(null);
          }}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          }}
        >
          <span style={{ fontSize: 18 }}>➕</span>
          新規作成
        </button>
      </div>

      {/* カテゴリフィルター */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setCategoryFilter('ALL')}
          style={{
            padding: '8px 16px',
            background: categoryFilter === 'ALL' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
            border: categoryFilter === 'ALL' ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: categoryFilter === 'ALL' ? '#fff' : 'rgba(255,255,255,0.7)',
            fontSize: 14,
            fontWeight: categoryFilter === 'ALL' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          全て
        </button>
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            style={{
              padding: '8px 16px',
              background: categoryFilter === cat.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              border: categoryFilter === cat.id ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: categoryFilter === cat.id ? '#fff' : 'rgba(255,255,255,0.7)',
              fontSize: 14,
              fontWeight: categoryFilter === cat.id ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* NFTリスト */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.7)' }}>
          読み込み中...
        </div>
      ) : filteredNFTs.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
          border: '2px dashed rgba(255,255,255,0.2)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚩</div>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            {categoryFilter === 'ALL'
              ? 'まだフラグNFTが作成されていません'
              : `${CATEGORY_OPTIONS.find(c => c.id === categoryFilter)?.label}がありません`
            }
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '8px 0 24px 0' }}>
            「新規作成」ボタンから最初のフラグNFTを作成しましょう
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {filteredNFTs.map((nft) => {
            const categoryInfo = CATEGORY_OPTIONS.find(c => c.id === nft.category);
            return (
              <div
                key={nft.id}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'all 0.3s',
                }}
              >
                {/* NFT画像 */}
                <div style={{
                  width: '100%',
                  height: 200,
                  backgroundImage: `url(${nft.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    padding: '6px 12px',
                    background: categoryInfo?.color || '#666',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span>{categoryInfo?.icon}</span>
                    <span>{categoryInfo?.label}</span>
                  </div>
                </div>

                {/* NFT情報 */}
                <div style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
                    {nft.name}
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {nft.description.length > 80
                      ? nft.description.substring(0, 80) + '...'
                      : nft.description
                    }
                  </p>

                  {/* 統計情報 */}
                  <div style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 16,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.7)',
                  }}>
                    <div>
                      <span style={{ opacity: 0.6 }}>発行数: </span>
                      <span style={{ fontWeight: 600 }}>{nft.total_minted || 0}</span>
                      {nft.max_supply && <span style={{ opacity: 0.6 }}> / {nft.max_supply}</span>}
                    </div>
                    <div>
                      <span style={{ opacity: 0.6 }}>使用回数: </span>
                      <span style={{ fontWeight: 600 }}>{nft.total_used || 0}</span>
                    </div>
                  </div>

                  {/* ミントボタン */}
                  <button
                    onClick={() => {
                      setSelectedNFTForMint(nft);
                      setShowMintModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  >
                    🎨 手動ミント
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ミントモーダル */}
      {showMintModal && selectedNFTForMint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#1a1a2e',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>
              NFTを手動ミント
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 24px 0' }}>
              {selectedNFTForMint.name}
            </p>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                ミント先アドレス
              </label>
              <input
                type="text"
                value={mintToAddress}
                onChange={(e) => setMintToAddress(e.target.value)}
                placeholder="0x..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowMintModal(false);
                  setMintToAddress('');
                  setSelectedNFTForMint(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleManualMint}
                disabled={isMinting || !mintToAddress}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: isMinting || !mintToAddress
                    ? 'rgba(102, 126, 234, 0.3)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isMinting || !mintToAddress ? 'not-allowed' : 'pointer',
                  opacity: isMinting || !mintToAddress ? 0.6 : 1,
                }}
              >
                {isMinting ? 'ミント中...' : 'ミント実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 次のステップ

1. 上記のコードを`FlagNFTManagementPage.tsx`に追加
2. 開発サーバーで動作確認
3. テストミントを実行
4. 配布履歴が正しく記録されることを確認

## 今後の拡張機能

- 配布履歴一覧表示
- 自動配布トリガー（チップ額に応じた自動ミント）
- 一括ミント機能
- NFTバーン機能

## 参考ファイル

- コントラクト: `/contracts/FlagNFT.sol`
- フック: `/src/hooks/useFlagNFTContract.ts`
- 型定義: `/src/types/flagNFT.ts`
- マイグレーション: `/supabase/migrations/20240101000000_add_flag_nft_distribution_fields.sql`
