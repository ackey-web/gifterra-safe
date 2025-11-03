// src/vending-ui/components/PurchaseCompleteAnimation.tsx
// 購入完了アニメーション画面
import { useEffect, useState } from "react";

interface PurchaseCompleteAnimationProps {
  product: {
    id: string;
    name: string;
    image_url: string | null;
  };
  downloadUrl: string;
  onClose: () => void;
}

export default function PurchaseCompleteAnimation({
  product,
  downloadUrl,
  onClose
}: PurchaseCompleteAnimationProps) {
  const [animationPhase, setAnimationPhase] = useState<"zoom" | "message">("zoom");

  useEffect(() => {
    // 1秒後にメッセージフェーズへ移行
    const timer = setTimeout(() => {
      setAnimationPhase("message");
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
        animation: "fadeIn 0.3s ease-out"
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-10deg);
          }
          50% {
            transform: scale(1.1) rotate(5deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      <div
        style={{
          maxWidth: 600,
          width: "100%",
          textAlign: "center"
        }}
      >
        {/* 商品画像（ズームアップアニメーション） */}
        <div
          style={{
            marginBottom: 30,
            display: "flex",
            justifyContent: "center",
            animation: animationPhase === "zoom" ? "zoomIn 1s ease-out" : "bounce 2s ease-in-out infinite"
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                width: 250,
                height: 250,
                objectFit: "cover",
                borderRadius: 20,
                boxShadow: "0 20px 60px rgba(138, 43, 226, 0.6)",
                border: "5px solid #FFD700"
              }}
            />
          ) : (
            <div
              style={{
                width: 250,
                height: 250,
                borderRadius: 20,
                boxShadow: "0 20px 60px rgba(138, 43, 226, 0.6)",
                border: "5px solid #FFD700",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700
              }}
            >
              特典画像なし
            </div>
          )}
        </div>

        {/* メッセージ部分（遅れて表示） */}
        {animationPhase === "message" && (
          <div
            style={{
              animation: "slideUpFadeIn 0.5s ease-out"
            }}
          >
            {/* 完了メッセージ */}
            <h1
              style={{
                margin: "0 0 15px 0",
                fontSize: 36,
                fontWeight: 700,
                color: "#FFD700",
                textShadow: "0 0 20px rgba(255, 215, 0, 0.5)"
              }}
            >
              特典受け取り完了！
            </h1>

            {/* 商品名 */}
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#fff",
                marginBottom: 30
              }}
            >
              「{product.name}」
            </div>

            {/* 誘導メッセージ */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 15,
                padding: 25,
                marginBottom: 20,
                boxShadow: "0 10px 30px rgba(102, 126, 234, 0.3)"
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#fff",
                  marginBottom: 15,
                  lineHeight: 1.6
                }}
              >
                特典取り出し口から
                <br />
                ダウンロードしてください
              </div>

              {/* 注意事項 */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  borderRadius: 10,
                  padding: 15,
                  fontSize: 14,
                  color: "rgba(255, 255, 255, 0.9)",
                  lineHeight: 1.6,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(10px)"
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8, color: "#FFD700" }}>
                  ⚠️ 重要な注意事項
                </div>
                <div style={{ textAlign: "left", paddingLeft: 10 }}>
                  • ダウンロードは<strong>1回限り</strong>です
                  <br />
                  • ダウンロードURLの有効期限は<strong>24時間</strong>です
                  <br />
                  • 期限切れの場合は、画面下部の「受け取り履歴」から再発行できます
                </div>
              </div>
            </div>

            {/* ダウンロードボタン */}
            <button
              onClick={() => {
                window.open(downloadUrl, "_blank");
                // 少し待ってから閉じる
                setTimeout(() => onClose(), 500);
              }}
              style={{
                width: "100%",
                padding: "18px 30px",
                fontSize: 18,
                fontWeight: 700,
                color: "#667eea",
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                border: "none",
                borderRadius: 15,
                cursor: "pointer",
                marginBottom: 15,
                boxShadow: "0 8px 25px rgba(255, 215, 0, 0.4)",
                animation: "pulse 2s ease-in-out infinite"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 12px 35px rgba(255, 215, 0, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 25px rgba(255, 215, 0, 0.4)";
              }}
            >
              今すぐダウンロード
            </button>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.7)",
                background: "transparent",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              }}
            >
              後で取り出し口から受け取る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
