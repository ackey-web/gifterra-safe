// src/admin/DiagnosticsPage.tsx
// Supabase 接続診断ページ
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { bucket, getAllBucketNames } from '../lib/storageBuckets';

export default function DiagnosticsPage() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // 環境変数チェック
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const hasSupabaseUrl = !!supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co';
  const hasSupabaseAnonKey = !!supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-key-here';

  // Supabase 接続テスト
  const testSupabaseConnection = async () => {
    setIsLoading(true);
    setTestResult('');

    try {
      // products テーブルにアクセス
      const { error } = await supabase
        .from('products')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      setTestResult('✅ Supabase 接続成功！products テーブルにアクセスできました。');
    } catch (err) {
      console.error('❌ Supabase 接続テスト失敗:', err);
      setTestResult(`❌ 接続失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Storage バケット一覧取得
  const testStorageBuckets = async () => {
    setIsLoading(true);
    setTestResult('');

    try {
      const { data, error } = await supabase.storage.listBuckets();

      if (error) {
        console.error('⚠️ listBuckets エラー:', error);
        setTestResult(
          `⚠️ バケット一覧取得に失敗しました\n\n` +
          `理由: anon key では listBuckets() が制限されている可能性があります。\n\n` +
          `これは正常です。実際のファイルアップロードは問題なく動作するはずです。\n\n` +
          `💡 解決策:\n` +
          `1. Supabase Dashboard → Storage を開いて、作成済みのバケット名を確認してください\n` +
          `2. 以下のバケット名が必要です:\n` +
          `   - product-images (サムネイル画像用)\n` +
          `   - product-files (配布ファイル用)\n\n` +
          `3. もし異なる名前のバケットを作成している場合は、その名前を教えてください。コードを修正します。\n\n` +
          `エラー詳細: ${error.message}`
        );
        return;
      }

      if (data && data.length > 0) {
        const bucketNames = data.map(b => b.name).join(', ');
        setTestResult(`✅ Storage バケット一覧:\n${bucketNames}`);
      } else {
        setTestResult('⚠️ Storage バケットが1つも作成されていません。');
      }
    } catch (err) {
      console.error('❌ Storage バケット取得失敗:', err);
      setTestResult(`❌ 取得失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ファイルアップロードテスト（実際にアップロードして確認）
  const testFileUpload = async () => {
    setIsLoading(true);
    setTestResult('');

    try {
      // 小さなテストファイルを作成
      const testContent = 'Supabase Storage Test File';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testFile = new File([testBlob], 'test.txt', { type: 'text/plain' });

      const fileName = `test-${Date.now()}.txt`;

      // PUBLIC バケットにアップロード
      const publicBucket = bucket('PUBLIC');
      const { error } = await supabase.storage
        .from(publicBucket)
        .upload(fileName, testFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // 公開URLを取得
      const { data: publicData } = supabase.storage
        .from(publicBucket)
        .getPublicUrl(fileName);

      // アップロードしたファイルを削除（クリーンアップ）
      await supabase.storage
        .from(publicBucket)
        .remove([fileName]);

      setTestResult(
        `✅ ファイルアップロードテスト成功！\n\n` +
        `バケット: ${publicBucket}\n` +
        `ファイル名: ${fileName}\n` +
        `公開URL: ${publicData.publicUrl}\n\n` +
        `※ テストファイルは自動削除されました`
      );

    } catch (err) {
      console.error('❌ ファイルアップロードテスト失敗:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      const publicBucket = bucket('PUBLIC');
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('bucket')) {
        setTestResult(
          `❌ ファイルアップロードテスト失敗\n\n` +
          `原因: バケット "${publicBucket}" が見つかりません、またはアクセスできません。\n\n` +
          `解決策:\n` +
          `1. Supabase Dashboard → Storage\n` +
          `2. "${publicBucket}" バケットが存在するか確認\n` +
          `3. バケットのポリシー設定を確認:\n` +
          `   - Public bucket として作成されているか\n` +
          `   - Storage Policies で SELECT, INSERT 権限があるか\n\n` +
          `エラー詳細: ${errorMessage}`
        );
      } else {
        setTestResult(`❌ テスト失敗: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // バケット名探索テスト（よくあるバケット名でアクセステスト）
  const testBucketNames = async () => {
    setIsLoading(true);
    setTestResult('');

    try {
      // 実際の運用バケット名を使用
      const commonBucketNames = getAllBucketNames();

      const results: string[] = [];

      for (const bucketName of commonBucketNames) {
        try {
          // list() を使ってバケットの存在確認
          const { error } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 1 });

          if (!error) {
            results.push(`✅ ${bucketName} - 存在する（アクセス可能）`);
          } else if (error.message.includes('not found')) {
            results.push(`❌ ${bucketName} - 存在しない`);
          } else {
            results.push(`⚠️ ${bucketName} - ${error.message}`);
          }
        } catch (err) {
          results.push(`⚠️ ${bucketName} - エラー: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const existingBuckets = results.filter(r => r.startsWith('✅'));

      if (existingBuckets.length > 0) {
        setTestResult(
          `🔍 バケット探索結果:\n\n` +
          `【アクセス可能なバケット】\n` +
          existingBuckets.join('\n') +
          `\n\n【すべての結果】\n` +
          results.join('\n') +
          `\n\n💡 ヒント:\n` +
          `- ✅マークのバケットが実際に使用できます\n` +
          `- コードで使用するバケット名を確認してください`
        );
      } else {
        setTestResult(
          `⚠️ アクセス可能なバケットが見つかりませんでした\n\n` +
          `【テスト結果】\n` +
          results.join('\n') +
          `\n\n【推奨アクション】\n` +
          `1. Supabase Dashboard → Storage で実際のバケット名を確認\n` +
          `2. バケットのポリシー設定を確認（Public設定が必要）\n` +
          `3. 必要に応じて "product-images" と "product-files" バケットを作成`
        );
      }

    } catch (err) {
      console.error('❌ バケット名探索テスト失敗:', err);
      setTestResult(`❌ テスト失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🔧 Supabase 診断ツール</h1>

      {/* 環境変数チェック */}
      <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-700">環境変数チェック</h2>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-2xl ${hasSupabaseUrl ? 'text-green-600' : 'text-red-600'}`}>
              {hasSupabaseUrl ? '✅' : '❌'}
            </span>
            <span className="font-mono text-sm">VITE_SUPABASE_URL</span>
            <span className="text-gray-500 text-xs">
              {hasSupabaseUrl ? '設定済み' : '未設定または初期値'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-2xl ${hasSupabaseAnonKey ? 'text-green-600' : 'text-red-600'}`}>
              {hasSupabaseAnonKey ? '✅' : '❌'}
            </span>
            <span className="font-mono text-sm">VITE_SUPABASE_ANON_KEY</span>
            <span className="text-gray-500 text-xs">
              {hasSupabaseAnonKey ? '設定済み' : '未設定または初期値'}
            </span>
          </div>
        </div>

        {(!hasSupabaseUrl || !hasSupabaseAnonKey) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
            <p className="text-yellow-800 font-semibold">⚠️ 環境変数が未設定です</p>
            <p className="text-sm text-yellow-700 mt-2">
              .env ファイルを確認して、以下を設定してください：
            </p>
            <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here`}
            </pre>
          </div>
        )}
      </div>

      {/* 接続テスト */}
      <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-700">接続テスト</h2>

        <div className="space-y-3">
          <button
            onClick={testSupabaseConnection}
            disabled={isLoading || !hasSupabaseUrl || !hasSupabaseAnonKey}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ テスト中...' : '🔍 Supabase 接続テスト'}
          </button>

          <button
            onClick={testBucketNames}
            disabled={isLoading || !hasSupabaseUrl || !hasSupabaseAnonKey}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {isLoading ? '⏳ テスト中...' : '🔎 バケット名探索テスト（推奨）'}
          </button>

          <button
            onClick={testStorageBuckets}
            disabled={isLoading || !hasSupabaseUrl || !hasSupabaseAnonKey}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ テスト中...' : '📦 Storage バケット一覧取得'}
          </button>

          <button
            onClick={testFileUpload}
            disabled={isLoading || !hasSupabaseUrl || !hasSupabaseAnonKey}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ テスト中...' : '🚀 ファイルアップロードテスト'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-3 rounded whitespace-pre-wrap ${
            testResult.startsWith('✅')
              ? 'bg-green-50 border border-green-300 text-green-800'
              : testResult.startsWith('⚠️')
              ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
              : 'bg-red-50 border border-red-300 text-red-800'
          }`}>
            {testResult}
          </div>
        )}
      </div>

      {/* ログ確認 */}
      <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
        <h2 className="text-xl font-bold mb-2 text-gray-700">📝 ログ確認</h2>
        <p className="text-sm text-gray-600">
          詳細なログはブラウザのコンソールを確認してください：
        </p>
        <ul className="mt-2 text-sm text-gray-700 list-disc list-inside">
          <li>Chrome: F12 → Console タブ</li>
          <li>Firefox: F12 → Console タブ</li>
          <li>Safari: Option+Cmd+C</li>
        </ul>
      </div>
    </div>
  );
}
