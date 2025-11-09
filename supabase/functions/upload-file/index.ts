// supabase/functions/upload-file/index.ts
// CORS対応の汎用ファイルアップロードEdge Function

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // プリフライトリクエスト（OPTIONS）に対応
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabaseクライアントの初期化
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase環境変数が設定されていません");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // リクエストからFormDataを取得
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bucketName = formData.get("bucketName") as string;
    const filePath = formData.get("filePath") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "ファイルが指定されていません" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!bucketName) {
      return new Response(
        JSON.stringify({ error: "バケット名が指定されていません" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ファイルパスが指定されていない場合は自動生成
    const finalFilePath = filePath || `${Date.now()}-${Math.random().toString(36).substring(2)}.${file.name.split(".").pop()}`;

    console.log(`📤 Uploading file: ${finalFilePath} to bucket: ${bucketName} (${file.size} bytes)`);

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // ファイルをアップロード
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(finalFilePath, uint8Array, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("❌ Upload error:", error);
      return new Response(
        JSON.stringify({ error: `アップロードに失敗しました: ${error.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 公開URLを取得
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(finalFilePath);

    console.log(`✅ Upload successful: ${publicData.publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicData.publicUrl,
        path: data.path,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "サーバーエラーが発生しました",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
