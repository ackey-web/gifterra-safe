// src/vending-ui/components/PurchaseConfirmDialog.tsx
// 購入確認ダイアログ
import { formatUnits } from "viem";
import { TOKEN } from "../../contract";

interface PurchaseConfirmDialogProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price_amount_wei: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PurchaseConfirmDialog({
  product,
  onConfirm,
  onCancel
}: PurchaseConfirmDialogProps) {
  const tipAmount = formatUnits(BigInt(product.price_amount_wei), TOKEN.DECIMALS);
  const tipAmountInt = Math.floor(Number(tipAmount));

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
        animation: "fadeIn 0.2s ease-out"
      }}
      onClick={(e) => {
        // 背景クリックでキャンセル
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: 20,
          padding: 30,
          maxWidth: 500,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          animation: "slideUp 0.3s ease-out"
        }}
      >
        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)"
            }}
          >
            特典受け取り確認
          </h2>
        </div>

        {/* 商品画像 */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 20
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                width: 200,
                height: 200,
                objectFit: "cover",
                borderRadius: 15,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
                border: "4px solid rgba(255, 255, 255, 0.3)"
              }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 15,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
                border: "4px solid rgba(255, 255, 255, 0.3)",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600
              }}
            >
              特典画像なし
            </div>
          )}
        </div>

        {/* 商品名 */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 10
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)"
            }}
          >
            {product.name}
          </h3>
        </div>

        {/* 説明文 */}
        {product.description && (
          <div
            style={{
              textAlign: "center",
              marginBottom: 20,
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: 14,
              lineHeight: 1.6
            }}
          >
            {product.description}
          </div>
        )}

        {/* TIP金額と確認メッセージ */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 25,
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)"
          }}
        >
          <div
            style={{
              textAlign: "center",
              color: "#fff",
              fontSize: 16,
              lineHeight: 1.8
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "#FFD700" }}>
                {tipAmountInt}
              </span>
              <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 5 }}>
                {TOKEN.SYMBOL}
              </span>
            </div>
            <div>をTIPして、この特典を受け取ります。</div>
          </div>
        </div>

        {/* ボタン */}
        <div
          style={{
            display: "flex",
            gap: 15,
            justifyContent: "center"
          }}
        >
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              background: "rgba(255, 255, 255, 0.2)",
              border: "2px solid rgba(255, 255, 255, 0.4)",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.2s",
              backdropFilter: "blur(10px)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            キャンセル
          </button>

          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 700,
              color: "#667eea",
              background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 15px rgba(255, 215, 0, 0.4)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 215, 0, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(255, 215, 0, 0.4)";
            }}
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
