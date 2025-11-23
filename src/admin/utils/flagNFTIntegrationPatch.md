# FlagNFTManagementPage Integration Plan

## Changes Needed in FlagNFTManagementPage.tsx

### 1. Add Imports (at the top)

```typescript
import {
  BenefitConfigForm,
  MembershipConfigForm,
  AchievementConfigForm,
  CampaignConfigForm,
  AccessPassConfigForm,
  CollectibleConfigForm,
} from './FlagNFTCategoryForms';
import { useConfigureCategory } from '../../hooks/useFlagNFTContract';
import { executeSaveFlagNFTWorkflow } from '../utils/flagNFTSaveWorkflow';
import { estimateGasCost, getSuccessMessage } from '../utils/flagNFTContractIntegration';
```

### 2. Add Hook for Contract Configuration (in component body)

```typescript
const { configure: configureCategory, isLoading: isConfiguringCategory } = useConfigureCategory();
```

### 3. Replace saveFlagNFT Function

Replace the existing `saveFlagNFT` function (lines 297-432) with this new implementation:

```typescript
const saveFlagNFT = async (categoryConfig: any) => {
  if (!adminSupabase) {
    alert('管理者Supabaseクライアントが初期化されていません');
    return;
  }

  if (!tenantId) {
    alert('テナントIDが取得できません');
    return;
  }

  if (!selectedCategory) {
    alert('カテゴリが選択されていません');
    return;
  }

  setIsSaving(true);

  try {
    console.log('💾 FlagNFT作成ワークフロー開始:', {
      category: selectedCategory,
      name: formData.name,
    });

    // ガス代推定を表示
    const gasCost = estimateGasCost('configure');
    console.log('⛽ 推定ガス代:', gasCost);

    // ワークフロー実行
    const result = await executeSaveFlagNFTWorkflow({
      tenantId,
      category: selectedCategory,
      name: formData.name,
      description: formData.description,
      image: formData.image,
      categoryConfig: {
        ...categoryConfig,
        // formDataから基本設定も含める
        maxSupply: formData.maxSupply ? parseInt(formData.maxSupply) : null,
        autoDistribute: formData.autoDistributionEnabled,
        requiredTipAmount: formData.requiredTipAmount ? parseFloat(formData.requiredTipAmount) : null,
        targetToken: formData.targetToken,
        isBurnable: formData.isBurnable,
      },
      supabaseClient: adminSupabase,
      configureCategory: async (cat, usageLimit, validFrom, validUntil, isTransferable, metadataURI) => {
        return await configureCategory(cat, usageLimit, validFrom, validUntil, isTransferable, metadataURI);
      },
    });

    if (result.success) {
      const successMsg = getSuccessMessage('configure', selectedCategory);
      alert(`${successMsg}\n\nトランザクションハッシュ: ${result.transactionHash}`);

      // リストビューに戻ってリロード
      setView('list');
      loadFlagNFTs(); // 既存のロード関数を呼ぶ
    } else {
      alert(`作成に失敗しました:\n${result.error}`);
    }

  } catch (err: any) {
    console.error('❌ 予期しないエラー:', err);
    alert(`エラーが発生しました: ${err.message || err}`);
  } finally {
    setIsSaving(false);
  }
};
```

### 4. Replace Detail Step Forms

Replace the entire `{createStep === 'detail' && selectedCategory && (` section (lines 1328-2550)
with the new category form components:

```typescript
{createStep === 'detail' && selectedCategory && (
  <div style={{ maxWidth: 800 }}>
    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
      詳細設定 - {CATEGORY_OPTIONS.find(c => c.id === selectedCategory)?.label}
    </h2>

    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: 32,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* ガス代推定表示 */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
      }}>
        <p style={{ fontSize: 14, color: '#10b981', marginBottom: 4 }}>
          ⛽ 推定ガス代: {estimateGasCost('configure')}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(16, 185, 129, 0.7)' }}>
          カテゴリ設定をブロックチェーンに登録します
        </p>
      </div>

      {/* カテゴリ別フォーム */}
      {selectedCategory === 'BENEFIT' && (
        <BenefitConfigForm
          onSubmit={saveFlagNFT}
          onCancel={() => setCreateStep('basic')}
          isLoading={isSaving || isConfiguringCategory}
        />
      )}

      {selectedCategory === 'MEMBERSHIP' && (
        <MembershipConfigForm
          onSubmit={saveFlagNFT}
          onCancel={() => setCreateStep('basic')}
          isLoading={isSaving || isConfiguringCategory}
        />
      )}

      {selectedCategory === 'ACHIEVEMENT' && (
        <AchievementConfigForm
          onSubmit={saveFlagNFT}
          onCancel={() => setCreateStep('basic')}
          isLoading={isSaving || isConfiguringCategory}
        />
      )}

      {selectedCategory === 'CAMPAIGN' && (
        <CampaignConfigForm
          onSubmit={saveFlagNFT}
          onCancel={() => setCreateStep('basic')}
          isLoading={isSaving || isConfiguringCategory}
        />
      )}

      {selectedCategory === 'ACCESS_PASS' && (
        <AccessPassConfigForm
          onSubmit={saveFlagNFT}
          onCancel={() => setCreateStep('basic')}
          isLoading={isSaving || isConfiguringCategory}
        />
      )}

      {selectedCategory === 'COLLECTIBLE' && (
        <CollectibleConfigForm
          onSubmit={saveFlagNFT}
          onCancel={() => setCreateStep('basic')}
          isLoading={isSaving || isConfiguringCategory}
        />
      )}
    </div>
  </div>
)}
```

### 5. Remove Old State Variables (if not needed elsewhere)

These states are now handled inside the form components:
- benefitData
- stampRallyData
- membershipData
- achievementData
- collectibleData

Check if they're used elsewhere before removing.

## Summary of Changes

1. ✅ Import new form components
2. ✅ Import contract hook and workflow utilities
3. ✅ Replace saveFlagNFT to use new workflow
4. ✅ Replace inline forms with new components
5. ✅ Add gas cost estimates
6. ✅ Add better error handling

## Next Steps After Integration

1. Test each category form submission
2. Verify contract configuration is called correctly
3. Verify Supabase metadata is saved
4. Test the complete flow: Select Category → Basic Info → Category Config → Contract Setup → Ready for Minting
