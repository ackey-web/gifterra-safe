// ========================================
// DB Adapter: Supabase読み書き制御
// ========================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { canWriteToDB, FEATURE_FLAGS } from '../utils/featureFlags';

export interface DBAdapter {
  query: <T>(table: string, options?: QueryOptions) => Promise<T[]>;
  queryOne: <T>(table: string, options?: QueryOptions) => Promise<T | null>;
  insert: <T>(table: string, data: T, source: 'mvp' | 'legacy') => Promise<void>;
  update: <T>(table: string, id: string, data: Partial<T>, source: 'mvp' | 'legacy') => Promise<void>;
  delete: (table: string, id: string, source: 'mvp' | 'legacy') => Promise<void>;
}

export interface QueryOptions {
  select?: string;
  filter?: Record<string, any>;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
}

let supabaseClient: SupabaseClient | null = null;

// Supabaseクライアント取得（シングルトン）
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log('[DBClient] Supabase client initialized');
    }
  }

  return supabaseClient;
}

export function useDBClient(): DBAdapter {
  const client = getSupabaseClient();

  return {
    // ─────────────────────────────────────
    // 読み取り（複数）- 新旧共通
    // ─────────────────────────────────────
    query: async <T>(table: string, options?: QueryOptions) => {
      try {
        let query = client.from(table).select(options?.select || '*');

        // フィルタ適用
        if (options?.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        // ソート
        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending !== false,
          });
        }

        // リミット
        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log(`[DBClient] Query ${table}:`, data?.length || 0, 'rows');
        }

        return (data || []) as T[];
      } catch (error) {
        console.error(`[DBClient] query error (${table}):`, error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // 読み取り（単一）- 新旧共通
    // ─────────────────────────────────────
    queryOne: async <T>(table: string, options?: QueryOptions) => {
      try {
        let query = client.from(table).select(options?.select || '*');

        // フィルタ適用
        if (options?.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        const { data, error } = await query.single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found
            return null;
          }
          throw error;
        }

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log(`[DBClient] QueryOne ${table}:`, data ? 'found' : 'not found');
        }

        return data as T;
      } catch (error) {
        console.error(`[DBClient] queryOne error (${table}):`, error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // 挿入 - MVPのみ許可（Legacyは制限）
    // ─────────────────────────────────────
    insert: async <T>(table: string, data: T, source: 'mvp' | 'legacy') => {
      if (!canWriteToDB(source)) {
        const msg = `[DBClient] Write blocked from ${source} source`;
        console.warn(msg);
        throw new Error('Write operation not allowed from legacy code');
      }

      try {
        const { error } = await client.from(table).insert(data as any);

        if (error) throw error;

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log(`[DBClient] Insert ${table}:`, source);
        }
      } catch (error) {
        console.error(`[DBClient] insert error (${table}):`, error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // 更新 - MVPのみ許可（Legacyは制限）
    // ─────────────────────────────────────
    update: async <T>(table: string, id: string, data: Partial<T>, source: 'mvp' | 'legacy') => {
      if (!canWriteToDB(source)) {
        const msg = `[DBClient] Update blocked from ${source} source`;
        console.warn(msg);
        throw new Error('Update operation not allowed from legacy code');
      }

      try {
        const { error } = await client
          .from(table)
          .update(data as any)
          .eq('id', id);

        if (error) throw error;

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log(`[DBClient] Update ${table}:`, id, source);
        }
      } catch (error) {
        console.error(`[DBClient] update error (${table}):`, error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // 削除 - MVPのみ許可（Legacyは制限）
    // ─────────────────────────────────────
    delete: async (table: string, id: string, source: 'mvp' | 'legacy') => {
      if (!canWriteToDB(source)) {
        const msg = `[DBClient] Delete blocked from ${source} source`;
        console.warn(msg);
        throw new Error('Delete operation not allowed from legacy code');
      }

      try {
        const { error } = await client.from(table).delete().eq('id', id);

        if (error) throw error;

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log(`[DBClient] Delete ${table}:`, id, source);
        }
      } catch (error) {
        console.error(`[DBClient] delete error (${table}):`, error);
        throw error;
      }
    },
  };
}
