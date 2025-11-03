// src/pages/DownloadPage.tsx
import { useEffect, useState } from 'react';

interface DownloadState {
  status: 'loading' | 'ready' | 'downloading' | 'error' | 'expired' | 'consumed';
  message: string;
  downloadUrl?: string;
}

export function DownloadPage() {
  const [state, setState] = useState<DownloadState>({
    status: 'loading',
    message: 'ダウンロードを準備しています...',
  });

  // URLパラメータからトークンを取得
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) {
      setState({
        status: 'error',
        message: 'トークンが指定されていません',
      });
      return;
    }

    // ダウンロードURL（自動リダイレクト）を構築
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
    const downloadUrl = `${apiUrl}/api/download/${token}`;

    setState({
      status: 'ready',
      message: 'ダウンロードの準備ができました',
      downloadUrl,
    });

    // 3秒後に自動ダウンロード開始
    const timer = setTimeout(() => {
      handleDownload(downloadUrl);
    }, 3000);

    return () => clearTimeout(timer);
  }, [token]);

  const handleDownload = async (url: string) => {
    try {
      setState({
        status: 'downloading',
        message: 'ダウンロードを開始しています...',
      });

      // ダウンロードAPIにリダイレクト
      // APIは302リダイレクトで署名URLへ転送
      window.location.href = url;

      // ダウンロード開始後、5秒待ってから完了メッセージ
      setTimeout(() => {
        setState({
          status: 'ready',
          message: 'ダウンロードが開始されました。ブラウザのダウンロードフォルダをご確認ください。',
        });
      }, 5000);

    } catch (error) {
      console.error('ダウンロードエラー:', error);
      setState({
        status: 'error',
        message: 'ダウンロードに失敗しました',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* ステータスアイコン */}
        <div className="flex justify-center mb-6">
          {state.status === 'loading' && (
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500" />
          )}
          {state.status === 'ready' && (
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {state.status === 'downloading' && (
            <svg className="w-16 h-16 text-blue-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          )}
          {(state.status === 'error' || state.status === 'expired' || state.status === 'consumed') && (
            <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* メッセージ */}
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {state.status === 'loading' && '準備中'}
          {state.status === 'ready' && 'ダウンロード準備完了'}
          {state.status === 'downloading' && 'ダウンロード開始'}
          {state.status === 'error' && 'エラー'}
          {state.status === 'expired' && '有効期限切れ'}
          {state.status === 'consumed' && '使用済み'}
        </h2>

        <p className="text-center text-gray-600 mb-6">
          {state.message}
        </p>

        {/* アクションボタン */}
        {state.status === 'ready' && state.downloadUrl && (
          <div className="space-y-3">
            <button
              onClick={() => handleDownload(state.downloadUrl!)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              今すぐダウンロード
            </button>
            <p className="text-xs text-center text-gray-500">
              ※ このリンクは1回限り有効です
            </p>
          </div>
        )}

        {(state.status === 'error' || state.status === 'expired' || state.status === 'consumed') && (
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            ホームに戻る
          </button>
        )}

        {/* 注意事項 */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-bold text-sm text-yellow-800 mb-2">⚠️ 重要な注意事項</h3>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• ダウンロードリンクは1回限り有効です</li>
            <li>• ダウンロード後、このリンクは無効になります</li>
            <li>• リンクの有効期限は発行から24時間です</li>
            <li>• ダウンロードが完了するまでブラウザを閉じないでください</li>
          </ul>
        </div>

        {/* セキュリティ情報 */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            🔒 このダウンロードは購入者専用です
          </p>
        </div>
      </div>
    </div>
  );
}
