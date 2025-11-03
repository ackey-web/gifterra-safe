// src/components/PurchaseSuccessModal.tsx

interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadToken: string;
  productName: string;
}

export function PurchaseSuccessModal({
  isOpen,
  onClose,
  downloadToken,
  productName,
}: PurchaseSuccessModalProps) {
  if (!isOpen) return null;

  const handleDownload = () => {
    // ダウンロードページへ遷移
    window.location.href = `/download?token=${downloadToken}`;
    onClose();
  };

  const downloadUrl = `${window.location.origin}/download?token=${downloadToken}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 成功アイコン */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 p-3">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* タイトル */}
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
          購入完了！
        </h2>

        <p className="text-center text-gray-600 mb-6">
          「{productName}」の購入が完了しました
        </p>

        {/* ダウンロードボタン */}
        <button
          onClick={handleDownload}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200 mb-4"
        >
          今すぐダウンロード
        </button>

        {/* ダウンロードリンク（コピー用） */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-600 mb-2">ダウンロードリンク（保存用）</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={downloadUrl}
              readOnly
              className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-700"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(downloadUrl);
                alert('リンクをコピーしました');
              }}
              className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition"
            >
              コピー
            </button>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-bold text-sm text-yellow-800 mb-2">⚠️ 重要</h3>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• ダウンロードリンクは<strong>1回限り</strong>有効です</li>
            <li>• 有効期限は発行から<strong>15分間</strong>です</li>
            <li>• リンクを他人と共有しないでください</li>
            <li>• ダウンロードに失敗した場合はサポートにお問い合わせください</li>
          </ul>
        </div>

        {/* 購入履歴へのリンク */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              window.location.href = '/my-purchases';
              onClose();
            }}
            className="text-sm text-blue-500 hover:text-blue-600 underline"
          >
            購入履歴を見る
          </button>
        </div>
      </div>
    </div>
  );
}
