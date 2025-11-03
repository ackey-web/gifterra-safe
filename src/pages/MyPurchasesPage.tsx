// src/pages/MyPurchasesPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAddress, useConnectionStatus } from '@thirdweb-dev/react';

interface Purchase {
  purchase_id: string;
  product_id: string;
  product_name: string;
  purchased_at: string;
  has_valid_token: boolean;
}

export function MyPurchasesPage() {
  const address = useAddress();
  const connectionStatus = useConnectionStatus();
  const isConnected = connectionStatus === 'connected';

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    loadPurchases();
  }, [address, isConnected]);

  const loadPurchases = async () => {
    if (!address) return;

    try {
      setLoading(true);
      setError(null);

      // ストアドプロシージャを呼び出して購入履歴を取得
      const { data, error } = await supabase
        .rpc('get_user_purchases', { p_buyer: address.toLowerCase() });

      if (error) {
        console.error('購入履歴取得エラー:', error);
        setError('購入履歴の取得に失敗しました');
        return;
      }

      setPurchases(data || []);
    } catch (err) {
      console.error('エラー:', err);
      setError('予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 個別ダウンロード処理
   */
  const handleDownload = async (purchaseId: string) => {
    if (!address) return;

    try {
      // ダウンロードトークンを取得
      const { data: tokens, error } = await supabase
        .from('download_tokens')
        .select('token')
        .eq('purchase_id', purchaseId)
        .eq('is_consumed', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error || !tokens || tokens.length === 0) {
        console.error('トークン取得エラー:', error);
        alert('ダウンロードトークンの取得に失敗しました');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
      const downloadUrl = `${apiUrl}/api/download/${tokens[0].token}`;

      // 新しいタブでダウンロード
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('ダウンロードエラー:', error);
      alert('ダウンロードに失敗しました');
    }
  };

  const handleRedownload = async (_purchaseId: string, _productName: string) => {
    if (!address) return;

    try {
      // 新しいダウンロードトークンを発行
      // TODO: 再ダウンロード用APIを実装
      alert('再ダウンロード機能は準備中です。サポートにお問い合わせください。');
    } catch (error) {
      console.error('再ダウンロードエラー:', error);
      alert('再ダウンロードに失敗しました');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">ウォレット接続が必要です</h2>
          <p className="text-gray-600 mb-6">購入履歴を表示するには、ウォレットを接続してください。</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">購入履歴</h1>
              <p className="text-gray-600">
                ウォレット: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="text-gray-600 hover:text-gray-800 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadPurchases}
              className="mt-4 text-red-600 hover:text-red-700 underline"
            >
              再試行
            </button>
          </div>
        )}

        {/* 購入履歴リスト */}
        {!loading && !error && purchases.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h2 className="text-xl font-bold text-gray-800 mb-2">購入履歴がありません</h2>
            <p className="text-gray-600 mb-6">まだ商品を購入していません</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
            >
              商品を見る
            </button>
          </div>
        )}

        {!loading && !error && purchases.length > 0 && (
          <>
            {purchases.map((purchase) => (
              <div
                key={purchase.purchase_id}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {purchase.product_name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      購入日: {new Date(purchase.purchased_at).toLocaleString('ja-JP')}
                    </p>
                    <p className="text-sm text-gray-600">
                      購入ID: {purchase.purchase_id.slice(0, 8)}...
                    </p>
                  </div>

                  <div className="ml-4">
                    {purchase.has_valid_token ? (
                      <button
                        onClick={() => handleDownload(purchase.purchase_id)}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        ダウンロード
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRedownload(purchase.purchase_id, purchase.product_name)}
                        className="bg-gray-500 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition duration-200"
                      >
                        再ダウンロード
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 注意事項 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-sm text-blue-800 mb-2">ℹ️ 購入履歴について</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• ダウンロードリンクは購入完了時にのみ発行されます</li>
            <li>• 再ダウンロードが必要な場合はサポートにお問い合わせください</li>
            <li>• 購入履歴はブロックチェーン上に永続的に記録されています</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
