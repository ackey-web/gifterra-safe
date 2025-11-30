// api/admin/score-params/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase クライアント（サービスロール）
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ 環境変数が設定されていません', {
    hasUrl: !!supabaseUrl,
    hasServiceRole: !!supabaseServiceRole
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

interface ScoreParamsRequest {
  weightEconomic: number;
  weightResonance: number;
  curve: 'Linear' | 'Sqrt' | 'Log';
  nhtWeight?: number;
  streakWeight?: number;
  aiQualityWeight?: number;
  messageQualityWeight?: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ========================================
  // POST: スコアパラメータを保存
  // ========================================
  if (req.method === 'POST') {
    try {
      const params: ScoreParamsRequest = req.body;

      // バリデーション
      if (typeof params.weightEconomic !== 'number' ||
          typeof params.weightResonance !== 'number' ||
          !['Linear', 'Sqrt', 'Log'].includes(params.curve)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      console.log('💾 Saving score params:', params);

      // 新しいパラメータレコードをINSERT（履歴として保存）
      const { data, error} = await supabase
        .from('score_params')
        .insert({
          weight_economic: params.weightEconomic,
          weight_resonance: params.weightResonance,
          curve: params.curve,
          nht_weight: params.nhtWeight ?? 2.0,
          streak_weight: params.streakWeight ?? 10.0,
          ai_quality_weight: params.aiQualityWeight ?? 1.0,
          message_quality_weight: params.messageQualityWeight ?? 1.0,
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to save score params:', error);
        return res.status(500).json({
          error: 'Failed to save score params',
          details: error.message
        });
      }

      console.log('✅ Score params saved successfully');

      return res.status(200).json({
        params: {
          id: data.id,
          weightEconomic: data.weight_economic,
          weightResonance: data.weight_resonance,
          curve: data.curve,
          nhtWeight: data.nht_weight,
          streakWeight: data.streak_weight,
          aiQualityWeight: data.ai_quality_weight,
          messageQualityWeight: data.message_quality_weight,
          lastUpdated: data.last_updated,
        }
      });
    } catch (error) {
      console.error('❌ Score params save error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
