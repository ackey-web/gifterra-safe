// src/adapters/dbClient.ts
/**
 * Unified Database Client Interface
 *
 * Abstracts Supabase operations with feature flag control
 * Enables gradual database integration without breaking legacy code
 */

import { supabase } from '../lib/supabase';
import type { SentimentAnalysis } from '../lib/ai_analysis';

export interface DatabaseConfig {
  enableReads: boolean;
  enableWrites: boolean;
}

/**
 * Unified Database Client
 */
export class DatabaseClient {
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig = { enableReads: true, enableWrites: true }) {
    this.config = config;
  }

  /**
   * Save transaction message with sentiment analysis
   */
  async saveTransactionMessage(
    txHash: string,
    userAddress: string,
    message: string,
    sentiment?: SentimentAnalysis
  ): Promise<boolean> {
    if (!this.config.enableWrites) {
      console.warn('Database writes are disabled by feature flag');
      return false;
    }

    try {
      const tx = txHash.toLowerCase();
      const addr = userAddress.toLowerCase();
      const msg = message.trim();

      const sentimentScore = sentiment ? sentiment.score : 50;
      const sentimentLabel = sentiment ? sentiment.label : 'neutral';

      // Update score_transactions table
      const { error: txError } = await supabase
        .from('score_transactions')
        .update({
          message: msg,
          sentiment_score: sentimentScore,
          sentiment_label: sentimentLabel,
        })
        .eq('trace_id', tx);

      if (txError) {
        console.error('Failed to save transaction message:', txError);
        return false;
      }

      // Update user AI quality score
      await this.updateUserAIQualityScore(addr);

      return true;
    } catch (error) {
      console.error('Database operation failed:', error);
      return false;
    }
  }

  /**
   * Update user AI quality score (aggregate sentiment)
   */
  private async updateUserAIQualityScore(userAddress: string): Promise<void> {
    if (!this.config.enableWrites) {
      return;
    }

    try {
      const addr = userAddress.toLowerCase();

      // Calculate average sentiment score
      const { data: transactions, error: fetchError } = await supabase
        .from('score_transactions')
        .select('sentiment_score')
        .eq('user_address', addr)
        .not('sentiment_score', 'is', null);

      if (fetchError) {
        console.error('Failed to fetch user transactions:', fetchError);
        return;
      }

      if (!transactions || transactions.length === 0) {
        return;
      }

      const avgSentiment =
        transactions.reduce((sum, tx) => sum + (tx.sentiment_score || 0), 0) /
        transactions.length;

      // Update user_scores table
      const { error: updateError } = await supabase
        .from('user_scores')
        .upsert({
          user_address: addr,
          ai_quality_score: Math.round(avgSentiment),
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        console.error('Failed to update user AI quality score:', updateError);
      }
    } catch (error) {
      console.error('Failed to update user AI quality score:', error);
    }
  }

  /**
   * Get user score data
   */
  async getUserScore(userAddress: string): Promise<{
    tipCount: number;
    aiQualityScore: number;
    kodomi: number;
  } | null> {
    if (!this.config.enableReads) {
      console.warn('Database reads are disabled by feature flag');
      return null;
    }

    try {
      const addr = userAddress.toLowerCase();

      const { data, error } = await supabase
        .from('user_scores')
        .select('tip_count, ai_quality_score, kodomi')
        .eq('user_address', addr)
        .single();

      if (error) {
        console.error('Failed to fetch user score:', error);
        return null;
      }

      return {
        tipCount: data?.tip_count || 0,
        aiQualityScore: data?.ai_quality_score || 50,
        kodomi: data?.kodomi || 0,
      };
    } catch (error) {
      console.error('Failed to get user score:', error);
      return null;
    }
  }

  /**
   * Get transaction history with messages
   */
  async getTransactionHistory(
    userAddress: string,
    limit: number = 20
  ): Promise<
    Array<{
      txHash: string;
      message: string;
      sentimentScore: number;
      sentimentLabel: string;
      timestamp: string;
    }>
  > {
    if (!this.config.enableReads) {
      console.warn('Database reads are disabled by feature flag');
      return [];
    }

    try {
      const addr = userAddress.toLowerCase();

      const { data, error } = await supabase
        .from('score_transactions')
        .select('trace_id, message, sentiment_score, sentiment_label, created_at')
        .eq('user_address', addr)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch transaction history:', error);
        return [];
      }

      return (
        data?.map((tx) => ({
          txHash: tx.trace_id,
          message: tx.message || '',
          sentimentScore: tx.sentiment_score || 50,
          sentimentLabel: tx.sentiment_label || 'neutral',
          timestamp: tx.created_at,
        })) || []
      );
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Update configuration (feature flags)
   */
  updateConfig(config: Partial<DatabaseConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Factory function to create database client with feature flags
 */
export function createDatabaseClient(): DatabaseClient {
  const enableReads = import.meta.env.VITE_ENABLE_NEW_REWARDS !== 'false';
  const enableWrites = import.meta.env.VITE_ENABLE_NEW_REWARDS !== 'false';

  return new DatabaseClient({
    enableReads,
    enableWrites,
  });
}
