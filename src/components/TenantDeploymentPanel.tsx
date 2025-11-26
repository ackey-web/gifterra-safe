// src/components/TenantDeploymentPanel.tsx
// テナントコントラクトデプロイパネル

import { useState } from 'react';
import { useContract, useContractWrite } from '@thirdweb-dev/react';
import type { TenantApplication } from '../types/tenantApplication';
import { rankPlanToContractValue } from '../types/tenantApplication';
import { GIFTERRA_FACTORY_ADDRESS, GIFTERRA_FACTORY_ABI, TNHT_TOKEN } from '../contract';
import { supabase } from '../lib/supabase';

interface TenantDeploymentPanelProps {
  application: TenantApplication;
  onUpdate: () => void;
}

export function TenantDeploymentPanel({ application, onUpdate }: TenantDeploymentPanelProps) {
  const { contract: factoryContract } = useContract(GIFTERRA_FACTORY_ADDRESS, GIFTERRA_FACTORY_ABI);
  const { mutateAsync: createTenant } = useContractWrite(factoryContract, 'createTenant');

  const [deploying, setDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<{
    step: string;
    message: string;
    type: 'info' | 'success' | 'error';
  } | null>(null);

  // 必須: Factoryデプロイ（Gifterraのみ）
  const handleFactoryDeploy = async () => {
    try {
      setDeploying(true);
      setDeploymentStatus({
        step: 'factory',
        message: 'GifterraFactory.createTenant() を実行中...',
        type: 'info'
      });

      // createTenant トランザクション実行
      const rankPlanValue = rankPlanToContractValue(application.rank_plan);
      const tx = await createTenant({
        args: [
          application.tenant_name,
          application.applicant_address,
          TNHT_TOKEN.address, // rewardTokenAddress: TNHT固定
          rankPlanValue,
        ],
      });

      setDeploymentStatus({
        step: 'factory',
        message: 'トランザクションを確認中...',
        type: 'info'
      });

      // トランザクションからテナントIDとコントラクトアドレスを取得
      const receipt = tx.receipt;
      const event = receipt.events?.find((e: any) => e.event === 'TenantCreated');

      const tenantId = event?.args?.tenantId;
      const gifterraAddress = event?.args?.gifterra;
      const paymentGatewayAddress = event?.args?.paymentGateway;

      // DB更新: 承認済みに変更 + コントラクトアドレスを保存
      const { error: updateError } = await supabase
        .from('tenant_applications')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          tenant_id: tenantId ? Number(tenantId) : null,
          gifterra_address: gifterraAddress || null,
          // paymentGatewayは全テナント共有なので参照のみ保存（オプション）
        })
        .eq('id', application.id);

      if (updateError) throw updateError;

      setDeploymentStatus({
        step: 'factory',
        message: `✅ Factory デプロイ完了！テナントID: ${tenantId}`,
        type: 'success'
      });

      // 親コンポーネントに通知
      onUpdate();

    } catch (error: any) {
      console.error('❌ Factoryデプロイエラー:', error);
      setDeploymentStatus({
        step: 'factory',
        message: `❌ デプロイ失敗: ${error.message}`,
        type: 'error'
      });
    } finally {
      setDeploying(false);
    }
  };

  // オプション: RewardNFT デプロイ
  const handleRewardNFTDeploy = async () => {
    setDeploymentStatus({
      step: 'reward_nft',
      message: '🚧 RewardNFT個別デプロイ機能は実装中です',
      type: 'info'
    });
    // TODO: RewardNFT個別デプロイ実装
  };

  // オプション: FlagNFT デプロイ
  const handleFlagNFTDeploy = async () => {
    setDeploymentStatus({
      step: 'flag_nft',
      message: '🚧 FlagNFT個別デプロイ機能は実装中です',
      type: 'info'
    });
    // TODO: FlagNFT個別デプロイ実装
  };

  // オプション: PaySplitter デプロイ
  const handlePaySplitterDeploy = async () => {
    setDeploymentStatus({
      step: 'pay_splitter',
      message: '🚧 PaySplitter個別デプロイ機能は実装中です',
      type: 'info'
    });
    // TODO: PaySplitter個別デプロイ実装
  };

  // 承認済み（デプロイ完了）の場合
  if (application.status === 'approved') {
    return (
      <div style={{
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 12,
        padding: 24
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#22c55e' }}>
          ✅ デプロイ完了
        </h3>

        {/* 必須コントラクト */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#fff' }}>
            必須コントラクト
          </h4>
          <ContractRow
            label="Gifterra (SBT)"
            address={application.gifterra_address}
            deployed={!!application.gifterra_address}
            required
          />
        </div>

        {/* オプションコントラクト */}
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#fff' }}>
            オプションコントラクト
          </h4>
          <ContractRow
            label="RewardNFT"
            address={application.reward_nft_address}
            deployed={!!application.reward_nft_address}
            onDeploy={handleRewardNFTDeploy}
          />
          <ContractRow
            label="FlagNFT"
            address={application.flag_nft_address}
            deployed={!!application.flag_nft_address}
            onDeploy={handleFlagNFTDeploy}
          />
          <ContractRow
            label="PaySplitter"
            address={application.pay_splitter_address}
            deployed={!!application.pay_splitter_address}
            onDeploy={handlePaySplitterDeploy}
          />
        </div>

        {/* ステータスメッセージ */}
        {deploymentStatus && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: deploymentStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                       deploymentStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                       'rgba(251, 191, 36, 0.1)',
            border: `1px solid ${deploymentStatus.type === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                                 deploymentStatus.type === 'success' ? 'rgba(34, 197, 94, 0.3)' :
                                 'rgba(251, 191, 36, 0.3)'}`,
            borderRadius: 8,
            fontSize: 13,
            color: '#fff'
          }}>
            {deploymentStatus.message}
          </div>
        )}
      </div>
    );
  }

  // 承認待ちの場合（デプロイUIを表示）
  return (
    <div style={{
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: 12,
      padding: 24
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#fbbf24' }}>
        🚀 コントラクトデプロイ
      </h3>

      {/* デプロイ手順説明 */}
      <div style={{
        marginBottom: 24,
        padding: 16,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 1.6,
        color: '#fff'
      }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          📋 デプロイ手順
        </h4>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>STEP 1: Factoryデプロイ（必須）</strong>
            <br />
            GifterraFactory.createTenant() を実行してテナント作成 + Gifterraコントラクトをデプロイ
          </li>
          <li style={{ marginTop: 8 }}>
            <strong>STEP 2: オプションコントラクト（任意）</strong>
            <br />
            テナントの要望に応じて、RewardNFT、FlagNFT、PaySplitterを個別にデプロイ
          </li>
        </ol>
      </div>

      {/* Factory デプロイボタン */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleFactoryDeploy}
          disabled={deploying}
          style={{
            width: '100%',
            padding: '16px',
            background: deploying ? 'rgba(251, 191, 36, 0.3)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: deploying ? 'not-allowed' : 'pointer',
            opacity: deploying ? 0.6 : 1,
            boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          {deploying ? '⏳ デプロイ中...' : '🚀 STEP 1: Factoryデプロイを実行'}
        </button>
      </div>

      {/* デプロイ情報 */}
      <div style={{
        padding: 12,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)'
      }}>
        <div style={{ marginBottom: 4 }}>
          <strong>デプロイされるコントラクト:</strong>
        </div>
        <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
          <li>Gifterra (SBT) - TIP + ランク管理</li>
          <li>PaymentGateway（全テナント共有）への参照設定</li>
        </ul>
        <div style={{ marginTop: 12 }}>
          <strong>ガス代見積もり:</strong> 約 0.5 MATIC
        </div>
      </div>

      {/* ステータスメッセージ */}
      {deploymentStatus && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: deploymentStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                     deploymentStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                     'rgba(251, 191, 36, 0.1)',
          border: `1px solid ${deploymentStatus.type === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                               deploymentStatus.type === 'success' ? 'rgba(34, 197, 94, 0.3)' :
                               'rgba(251, 191, 36, 0.3)'}`,
          borderRadius: 8,
          fontSize: 13,
          color: '#fff'
        }}>
          {deploymentStatus.message}
        </div>
      )}
    </div>
  );
}

// コントラクト行コンポーネント
function ContractRow({
  label,
  address,
  deployed,
  required = false,
  onDeploy
}: {
  label: string;
  address: string | null;
  deployed: boolean;
  required?: boolean;
  onDeploy?: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      marginBottom: 8
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#fff' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </div>
        {deployed && address ? (
          <a
            href={`https://polygonscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: '#667eea',
              textDecoration: 'none',
              fontFamily: 'monospace'
            }}
          >
            {address.slice(0, 10)}...{address.slice(-8)} ↗
          </a>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
            {required ? '未デプロイ（必須）' : 'オプション'}
          </div>
        )}
      </div>

      {!deployed && onDeploy && (
        <button
          onClick={onDeploy}
          style={{
            padding: '6px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          デプロイ
        </button>
      )}

      {deployed && (
        <div style={{
          padding: '4px 12px',
          background: 'rgba(34, 197, 94, 0.2)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 6,
          color: '#22c55e',
          fontSize: 12,
          fontWeight: 600
        }}>
          ✅ 完了
        </div>
      )}
    </div>
  );
}
