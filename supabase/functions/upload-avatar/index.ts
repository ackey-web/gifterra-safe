// supabase/functions/upload-avatar/index.ts
// CORS対応のアバター画像アップロードEdge Function

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 本番では特定のオリジンに制限することを推奨
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // プリフライトリクエスト（OPTIONS）に対応
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabaseクライアントの初期化（SERVICE_ROLE_KEYを使用して権限昇格）
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase環境変数が設定されていません");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // リクエストからFormDataを取得
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const walletAddress = formData.get("walletAddress") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "ファイルが指定されていません" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "ウォレットアドレスが指定されていません" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ファイルサイズチェック（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: "ファイルサイズは5MB以下にしてください" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // MIME typeチェック
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "JPG、PNG、GIF、WebP形式の画像のみアップロード可能です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ファイルパスを生成（ウォレットアドレスベース）
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${walletAddress.toLowerCase()}/avatar.${fileExt}`;

    console.log(`📤 Uploading avatar: ${fileName} (${file.size} bytes)`);

    // 既存のアバターがあれば削除
    const { data: existingFiles } = await supabase.storage
      .from("gh-avatars")
      .list(walletAddress.toLowerCase());

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(
        (f) => `${walletAddress.toLowerCase()}/${f.name}`
      );
      await supabase.storage.from("gh-avatars").remove(filesToDelete);
      console.log(`🗑️ Deleted ${filesToDelete.length} existing avatar(s)`);
    }

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 新しいアバターをアップロード
    const { data, error } = await supabase.storage
      .from("gh-avatars")
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
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
      .from("gh-avatars")
      .getPublicUrl(fileName);

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
