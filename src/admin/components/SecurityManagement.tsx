// src/admin/components/SecurityManagement.tsx
// セキュリティ管理画面（スーパーアドミン専用）

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface SecuritySettings {
  max_transaction_amount: number;
  daily_transaction_limit: number;
  hourly_transaction_limit: number;
  high_amount_threshold: number;
  enable_anomaly_detection: boolean;
  suspicious_transaction_count: number;
  suspicious_time_window: number;
}

interface AccountFreeze {
  id: string;
  wallet_address: string;
  is_frozen: boolean;
  freeze_reason: string;
  freeze_type: string;
  frozen_by: string | null;
  frozen_at: string;
  unfrozen_at: string | null;
}

interface SuspiciousTransaction {
  id: string;
  from_address: string;
  to_address: string;
  amount: number;
  anomaly_score: number;
  anomaly_reasons: string[];
  created_at: string;
}

export function SecurityManagement() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [frozenAccounts, setFrozenAccounts] = useState<AccountFreeze[]>([]);
  const [suspiciousTransactions, setSuspiciousTransactions] = useState<SuspiciousTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'frozen' | 'suspicious'>('settings');

  // データ取得
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // セキュリティ設定を取得
      const { data: settingsData } = await supabase
        .from('security_settings')
        .select('*')
        .eq('tenant_id', 'default')
        .single();

      if (settingsData) {
        setSettings(settingsData);
      }

      // 凍結アカウントを取得
      const { data: freezesData } = await supabase
        .from('account_freezes')
        .select('*')
        .eq('tenant_id', 'default')
        .eq('is_frozen', true)
        .order('frozen_at', { ascending: false });

      setFrozenAccounts(freezesData || []);

      // 疑わしいトランザクションを取得
      const { data: txData } = await supabase
        .from('transaction_history')
        .select('*')
        .eq('tenant_id', 'default')
        .eq('is_suspicious', true)
        .order('created_at', { ascending: false })
        .limit(50);

      setSuspiciousTransactions(txData || []);
    } catch (err) {
      console.error('Failed to fetch security data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 設定を保存
  const saveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('security_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', 'default');

      if (error) throw error;

      alert('設定を保存しました');
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // アカウント凍結
  const freezeAccount = async (walletAddress: string, reason: string) => {
    try {
      // account_freezesテーブルに記録
      const { error: freezeError } = await supabase
        .from('account_freezes')
        .upsert({
          tenant_id: 'default',
          wallet_address: walletAddress.toLowerCase(),
          is_frozen: true,
          freeze_reason: reason,
          freeze_type: 'manual',
          frozen_at: new Date().toISOString(),
        });

      if (freezeError) throw freezeError;

      // user_profilesテーブルも更新
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          is_frozen: true,
          frozen_at: new Date().toISOString(),
          freeze_reason: reason,
        })
        .eq('tenant_id', 'default')
        .eq('wallet_address', walletAddress.toLowerCase());

      if (profileError) throw profileError;

      alert('アカウントを凍結しました');
      fetchData();
    } catch (err) {
      console.error('Failed to freeze account:', err);
      alert('アカウント凍結に失敗しました');
    }
  };

  // アカウント凍結解除
  const unfreezeAccount = async (walletAddress: string, reason: string) => {
    try {
      // account_freezesテーブルを更新
      const { error: freezeError } = await supabase
        .from('account_freezes')
        .update({
          is_frozen: false,
          unfrozen_at: new Date().toISOString(),
          unfreeze_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', 'default')
        .eq('wallet_address', walletAddress.toLowerCase());

      if (freezeError) throw freezeError;

      // user_profilesテーブルも更新
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          is_frozen: false,
          freeze_reason: null,
        })
        .eq('tenant_id', 'default')
        .eq('wallet_address', walletAddress.toLowerCase());

      if (profileError) throw profileError;

      alert('アカウント凍結を解除しました');
      fetchData();
    } catch (err) {
      console.error('Failed to unfreeze account:', err);
      alert('凍結解除に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div>読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        🔒 セキュリティ管理
      </h1>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'settings' ? '#3b82f6' : 'transparent',
            color: activeTab === 'settings' ? '#fff' : '#374151',
            border: 'none',
            borderBottom: activeTab === 'settings' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          セキュリティ設定
        </button>
        <button
          onClick={() => setActiveTab('frozen')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'frozen' ? '#3b82f6' : 'transparent',
            color: activeTab === 'frozen' ? '#fff' : '#374151',
            border: 'none',
            borderBottom: activeTab === 'frozen' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          凍結アカウント ({frozenAccounts.length})
        </button>
        <button
          onClick={() => setActiveTab('suspicious')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'suspicious' ? '#3b82f6' : 'transparent',
            color: activeTab === 'suspicious' ? '#fff' : '#374151',
            border: 'none',
            borderBottom: activeTab === 'suspicious' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          疑わしい取引 ({suspiciousTransactions.length})
        </button>
      </div>

      {/* セキュリティ設定タブ */}
      {activeTab === 'settings' && settings && (
        <div>
          <div style={{ maxWidth: 800 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
              トランザクション制限
            </h2>

            <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  1回の最大送金額 (JPYC)
                </label>
                <input
                  type="number"
                  value={settings.max_transaction_amount}
                  onChange={(e) =>
                    setSettings({ ...settings, max_transaction_amount: Number(e.target.value) })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  1時間の送金上限 (JPYC)
                </label>
                <input
                  type="number"
                  value={settings.hourly_transaction_limit}
                  onChange={(e) =>
                    setSettings({ ...settings, hourly_transaction_limit: Number(e.target.value) })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  1日の送金上限 (JPYC)
                </label>
                <input
                  type="number"
                  value={settings.daily_transaction_limit}
                  onChange={(e) =>
                    setSettings({ ...settings, daily_transaction_limit: Number(e.target.value) })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  高額送金の閾値 (JPYC) - 追加確認が必要
                </label>
                <input
                  type="number"
                  value={settings.high_amount_threshold}
                  onChange={(e) =>
                    setSettings({ ...settings, high_amount_threshold: Number(e.target.value) })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
              異常検知設定
            </h2>

            <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.enable_anomaly_detection}
                    onChange={(e) =>
                      setSettings({ ...settings, enable_anomaly_detection: e.target.checked })
                    }
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ fontWeight: 500 }}>異常検知を有効化</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  疑わしい取引とみなす短時間の送金回数
                </label>
                <input
                  type="number"
                  value={settings.suspicious_transaction_count}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      suspicious_transaction_count: Number(e.target.value),
                    })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                  疑わしいとみなす時間窓 (秒)
                </label>
                <input
                  type="number"
                  value={settings.suspicious_time_window}
                  onChange={(e) =>
                    setSettings({ ...settings, suspicious_time_window: Number(e.target.value) })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
                <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#6b7280' }}>
                  例: 300秒（5分）以内に{settings.suspicious_transaction_count}回以上の送金で異常と判断
                </p>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={isSaving}
              style={{
                padding: '12px 24px',
                background: isSaving ? '#9ca3af' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      )}

      {/* 凍結アカウントタブ */}
      {activeTab === 'frozen' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>凍結アカウント一覧</h2>

          {frozenAccounts.length === 0 ? (
            <p style={{ color: '#6b7280' }}>凍結されているアカウントはありません</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {frozenAccounts.map((freeze) => (
                <div
                  key={freeze.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 16,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                        {freeze.wallet_address}
                      </div>
                      <div style={{ fontSize: 14, color: '#6b7280' }}>
                        凍結日時: {new Date(freeze.frozen_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        height: 'fit-content',
                      }}
                    >
                      {freeze.freeze_type === 'manual' ? '手動凍結' : '自動凍結'}
                    </span>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                      <strong>凍結理由:</strong> {freeze.freeze_reason}
                    </div>
                    {freeze.frozen_by && (
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        凍結実行者: {freeze.frozen_by}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const reason = prompt('凍結解除理由を入力してください:');
                      if (reason) {
                        unfreezeAccount(freeze.wallet_address, reason);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    凍結解除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 新規凍結 */}
          <div
            style={{
              marginTop: 32,
              padding: 20,
              border: '2px dashed #d1d5db',
              borderRadius: 8,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              新規アカウント凍結
            </h3>
            <button
              onClick={() => {
                const address = prompt('凍結するウォレットアドレスを入力してください:');
                if (address) {
                  const reason = prompt('凍結理由を入力してください:');
                  if (reason) {
                    freezeAccount(address, reason);
                  }
                }
              }}
              style={{
                padding: '12px 24px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              アカウントを凍結
            </button>
          </div>
        </div>
      )}

      {/* 疑わしい取引タブ */}
      {activeTab === 'suspicious' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>疑わしい取引一覧</h2>

          {suspiciousTransactions.length === 0 ? (
            <p style={{ color: '#6b7280' }}>疑わしい取引は検出されていません</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {suspiciousTransactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: 16,
                    background: '#fef2f2',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                        異常スコア: {tx.anomaly_score.toFixed(0)}点
                      </div>
                      <div style={{ fontSize: 14, color: '#6b7280' }}>
                        {new Date(tx.created_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>
                      {tx.amount.toLocaleString()} JPYC
                    </div>
                  </div>

                  <div style={{ marginBottom: 12, fontSize: 13 }}>
                    <div style={{ marginBottom: 4 }}>
                      <strong>送信元:</strong> {tx.from_address}
                    </div>
                    <div>
                      <strong>送信先:</strong> {tx.to_address}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 13 }}>検出理由:</strong>
                    <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                      {tx.anomaly_reasons.map((reason, idx) => (
                        <li key={idx} style={{ fontSize: 13, color: '#ef4444' }}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      const reason = prompt(`${tx.from_address} を凍結しますか？理由を入力してください:`);
                      if (reason) {
                        freezeAccount(tx.from_address, reason);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    このアカウントを凍結
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
