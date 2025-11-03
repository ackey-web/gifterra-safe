/**
 * @file スコアインデクサ メインオーケストレーター
 * @description イベントリスナー、データベース、APIサーバーを統合管理
 */

import { ethers } from 'ethers';
import {
  GifterraEventListener,
  ScoreEventListener,
  backfillEvents,
  backfillGifterraEvents
} from './eventListener';
import { ScoreDatabase } from './database';
import { createScoreApiServer } from '../api/scoreApi';
import type {
  TippedEvent,
  ScoreIncrementedEvent,
  ScoreParamsUpdatedEvent,
  TokenAxisUpdatedEvent
} from './types';

// ========================================
// 設定
// ========================================

export interface IndexerConfig {
  // Blockchain
  rpcUrl: string;
  scoreRegistryAddress: string;
  startBlock?: number; // 開始ブロック（バックフィル用）

  // Supabase
  supabaseUrl: string;
  supabaseKey: string;

  // API
  apiPort?: number;
  adminApiKey?: string;

  // オプション
  enableBackfill?: boolean; // 起動時にバックフィル実行
  backfillChunkSize?: number; // バックフィルのチャンクサイズ
  enableDailySnapshot?: boolean; // デイリースナップショット有効化
  snapshotCron?: string; // スナップショット実行時刻（例: "00:00"）
}

// ========================================
// インデクサクラス
// ========================================

export class ScoreIndexer {
  private config: IndexerConfig;
  private provider: ethers.providers.JsonRpcProvider;
  private database: ScoreDatabase;
  private listener: ScoreEventListener;
  private apiServer?: ReturnType<typeof createScoreApiServer>;
  private isRunning: boolean = false;

  constructor(config: IndexerConfig) {
    this.config = config;

    // Provider初期化
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

    // Database初期化
    this.database = new ScoreDatabase(config.supabaseUrl, config.supabaseKey);

    // EventListener初期化
    this.listener = new ScoreEventListener(
      this.provider,
      config.scoreRegistryAddress,
      {
        onScoreIncremented: this.handleScoreIncremented.bind(this),
        onScoreParamsUpdated: this.handleScoreParamsUpdated.bind(this),
        onTokenAxisUpdated: this.handleTokenAxisUpdated.bind(this),
      }
    );
  }

  // ========================================
  // 起動・停止
  // ========================================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Indexer is already running');
      return;
    }

    console.log('🚀 Starting Score Indexer...');

    try {
      // 1. データベース初期化
      console.log('📊 Initializing database...');
      await this.database.initialize();

      // 2. バックフィル（オプション）
      if (this.config.enableBackfill && this.config.startBlock !== undefined) {
        console.log('🔄 Running backfill...');
        await this.runBackfill(this.config.startBlock);
      }

      // 3. イベントリスナー開始
      console.log('👂 Starting event listener...');
      await this.listener.start();

      // 4. APIサーバー起動（オプション）
      if (this.config.apiPort) {
        console.log(`🌐 Starting API server on port ${this.config.apiPort}...`);
        this.startApiServer();
      }

      // 5. デイリースナップショット（オプション）
      if (this.config.enableDailySnapshot) {
        console.log('📸 Scheduling daily snapshots...');
        this.scheduleDailySnapshot();
      }

      this.isRunning = true;
      console.log('✅ Score Indexer started successfully');
    } catch (error) {
      console.error('❌ Failed to start indexer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ Indexer is not running');
      return;
    }

    console.log('🛑 Stopping Score Indexer...');

    try {
      // イベントリスナー停止
      await this.listener.stop();

      // APIサーバー停止（実装は簡略化）
      if (this.apiServer) {
        console.log('🌐 Stopping API server...');
        // TODO: Graceful shutdown
      }

      this.isRunning = false;
      console.log('✅ Score Indexer stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping indexer:', error);
      throw error;
    }
  }

  // ========================================
  // イベントハンドラ
  // ========================================

  private async handleScoreIncremented(event: ScoreIncrementedEvent): Promise<void> {
    console.log(`📈 Score incremented: ${event.user} | ${event.axis} | ${event.amountRaw}`);

    try {
      await this.database.recordScore(
        event.user,
        event.token,
        event.amountRaw,
        event.axis,
        event.traceId,
        event.timestamp
      );

      console.log(`✅ Score recorded for ${event.user}`);
    } catch (error) {
      console.error(`❌ Error recording score for ${event.user}:`, error);
      // TODO: エラーログをDBに保存してリトライ可能にする
    }
  }

  private async handleScoreParamsUpdated(event: ScoreParamsUpdatedEvent): Promise<void> {
    console.log(`⚙️ Score params updated: wE=${event.weightEconomic}, wR=${event.weightResonance}, curve=${event.curve}`);

    try {
      await this.database.updateParams({
        weightEconomic: event.weightEconomic,
        weightResonance: event.weightResonance,
        curve: event.curve,
        lastUpdated: event.timestamp,
      });

      console.log('✅ Parameters updated and composite scores recalculated');
    } catch (error) {
      console.error('❌ Error updating params:', error);
    }
  }

  private async handleTokenAxisUpdated(event: TokenAxisUpdatedEvent): Promise<void> {
    console.log(`🔧 Token axis updated: ${event.token} -> ${event.isEconomic ? 'Economic' : 'Resonance'}`);

    try {
      await this.database.updateTokenAxis(event.token, event.isEconomic);

      console.log('✅ Token axis updated');
    } catch (error) {
      console.error('❌ Error updating token axis:', error);
    }
  }

  // ========================================
  // バックフィル
  // ========================================

  private async runBackfill(startBlock: number): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const chunkSize = this.config.backfillChunkSize || 10000;

      console.log(`🔄 Backfilling from block ${startBlock} to ${currentBlock}...`);

      const events = await backfillEvents(
        this.listener,
        startBlock,
        currentBlock,
        chunkSize
      );

      console.log(`✅ Backfill complete: ${events.scoreIncremented.length} score events processed`);

      // イベントを順次処理
      for (const event of events.scoreIncremented) {
        await this.handleScoreIncremented(event);
      }

      for (const event of events.paramsUpdated) {
        await this.handleScoreParamsUpdated(event);
      }

      for (const event of events.tokenAxisUpdated) {
        await this.handleTokenAxisUpdated(event);
      }

      console.log('✅ All backfill events processed');
    } catch (error) {
      console.error('❌ Backfill error:', error);
      throw error;
    }
  }

  // ========================================
  // APIサーバー
  // ========================================

  private startApiServer(): void {
    this.apiServer = createScoreApiServer({
      database: this.database,
      adminApiKey: this.config.adminApiKey,
    });

    this.apiServer.listen(this.config.apiPort, () => {
      console.log(`✅ API server listening on http://localhost:${this.config.apiPort}`);
      console.log(`📚 Available endpoints:`);
      console.log(`   GET  /api/profile/:userId`);
      console.log(`   GET  /api/profile/:userId/rank`);
      console.log(`   GET  /api/rankings/:axis`);
      console.log(`   GET  /api/rankings/all`);
      console.log(`   GET  /api/snapshot/latest`);
      console.log(`   GET  /api/health`);
      console.log(`   POST /api/admin/params (requires API key)`);
      console.log(`   POST /api/admin/token-axis (requires API key)`);
    });
  }

  // ========================================
  // デイリースナップショット
  // ========================================

  private scheduleDailySnapshot(): void {
    const targetTime = this.config.snapshotCron || '00:00';
    const [targetHour, targetMinute] = targetTime.split(':').map(Number);

    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(targetHour, targetMinute, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delay = next.getTime() - now.getTime();

      console.log(`📸 Next snapshot scheduled at ${next.toISOString()}`);

      setTimeout(async () => {
        try {
          console.log('📸 Generating daily snapshot...');
          const snapshot = await this.database.generateDailySnapshot();
          console.log(`✅ Snapshot generated: ${snapshot.totalUsers} users, ${snapshot.totalTransactions} transactions`);
        } catch (error) {
          console.error('❌ Snapshot generation error:', error);
        }

        // 次のスナップショットをスケジュール
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  // ========================================
  // ユーティリティ
  // ========================================

  getStatus() {
    return {
      isRunning: this.isRunning,
      config: {
        rpcUrl: this.config.rpcUrl,
        scoreRegistryAddress: this.config.scoreRegistryAddress,
        apiPort: this.config.apiPort,
        enableBackfill: this.config.enableBackfill,
        enableDailySnapshot: this.config.enableDailySnapshot,
      },
    };
  }
}

// ========================================
// CLI起動スクリプト
// ========================================

/**
 * 環境変数から設定を読み込んでインデクサを起動
 */
export async function startIndexerFromEnv(): Promise<ScoreIndexer> {
  const config: IndexerConfig = {
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    scoreRegistryAddress: process.env.SCORE_REGISTRY_ADDRESS || '',
    startBlock: process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined,

    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || '',

    apiPort: process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001,
    adminApiKey: process.env.ADMIN_API_KEY,

    enableBackfill: process.env.ENABLE_BACKFILL === 'true',
    backfillChunkSize: process.env.BACKFILL_CHUNK_SIZE
      ? parseInt(process.env.BACKFILL_CHUNK_SIZE)
      : 10000,
    enableDailySnapshot: process.env.ENABLE_DAILY_SNAPSHOT === 'true',
    snapshotCron: process.env.SNAPSHOT_CRON || '00:00',
  };

  // バリデーション
  if (!config.scoreRegistryAddress) {
    throw new Error('SCORE_REGISTRY_ADDRESS environment variable is required');
  }
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
  }

  const indexer = new ScoreIndexer(config);
  await indexer.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    await indexer.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return indexer;
}

// ========================================
// Gifterraインデクサクラス（現在使用中）
// ========================================

/**
 * Gifterraコントラクト用インデクサ設定
 */
export interface GifterraIndexerConfig {
  // Blockchain
  rpcUrl: string;
  gifterraAddress: string; // Gifterraコントラクトアドレス
  tokenAddress: string; // JPYCトークンアドレス
  startBlock?: number;

  // Supabase
  supabaseUrl: string;
  supabaseKey: string;

  // API
  apiPort?: number;
  adminApiKey?: string;

  // オプション
  enableBackfill?: boolean;
  backfillChunkSize?: number;
  enableDailySnapshot?: boolean;
  snapshotCron?: string;
}

/**
 * Gifterraインデクサクラス
 */
export class GifterraIndexer {
  private config: GifterraIndexerConfig;
  private provider: ethers.providers.JsonRpcProvider;
  private database: ScoreDatabase;
  private listener: GifterraEventListener;
  private apiServer?: ReturnType<typeof createScoreApiServer>;
  private isRunning: boolean = false;

  constructor(config: GifterraIndexerConfig) {
    this.config = config;

    // Provider初期化
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

    // Database初期化
    this.database = new ScoreDatabase(config.supabaseUrl, config.supabaseKey);

    // EventListener初期化
    this.listener = new GifterraEventListener(
      this.provider,
      config.gifterraAddress,
      config.tokenAddress,
      {
        onTipped: this.handleTipped.bind(this),
      }
    );
  }

  /**
   * 起動
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Gifterra Indexer is already running');
      return;
    }

    console.log('🚀 Starting Gifterra Indexer...');

    try {
      // 1. データベース初期化
      console.log('📊 Initializing database...');
      await this.database.initialize();

      // 2. バックフィル（オプション）
      if (this.config.enableBackfill && this.config.startBlock !== undefined) {
        console.log('🔄 Running backfill...');
        await this.runBackfill(this.config.startBlock);
      }

      // 3. イベントリスナー開始
      console.log('👂 Starting Gifterra event listener...');
      await this.listener.start();

      // 4. APIサーバー起動（オプション）
      if (this.config.apiPort) {
        console.log(`🌐 Starting API server on port ${this.config.apiPort}...`);
        this.startApiServer();
      }

      // 5. デイリースナップショット（オプション）
      if (this.config.enableDailySnapshot) {
        console.log('📸 Scheduling daily snapshots...');
        this.scheduleDailySnapshot();
      }

      this.isRunning = true;
      console.log('✅ Gifterra Indexer started successfully');
    } catch (error) {
      console.error('❌ Failed to start Gifterra indexer:', error);
      throw error;
    }
  }

  /**
   * 停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ Gifterra Indexer is not running');
      return;
    }

    console.log('🛑 Stopping Gifterra Indexer...');

    try {
      await this.listener.stop();

      if (this.apiServer) {
        console.log('🌐 Stopping API server...');
        // TODO: Graceful shutdown
      }

      this.isRunning = false;
      console.log('✅ Gifterra Indexer stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping Gifterra indexer:', error);
      throw error;
    }
  }

  /**
   * Tippedイベントハンドラ
   */
  private async handleTipped(event: TippedEvent): Promise<void> {
    console.log(`💸 Tipped: ${event.from} | ${event.amount.toString()}`);

    try {
      await this.database.recordTip(event, this.config.tokenAddress);
      console.log(`✅ TIP recorded for ${event.from}`);
    } catch (error) {
      console.error(`❌ Error recording TIP for ${event.from}:`, error);
      // TODO: エラーログをDBに保存してリトライ可能にする
    }
  }

  /**
   * バックフィル
   */
  private async runBackfill(startBlock: number): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const chunkSize = this.config.backfillChunkSize || 10000;

      console.log(`🔄 Backfilling Tipped events from block ${startBlock} to ${currentBlock}...`);

      const events = await backfillGifterraEvents(
        this.listener,
        startBlock,
        currentBlock,
        chunkSize
      );

      console.log(`✅ Backfill complete: ${events.length} Tipped events processed`);

      // イベントを順次処理
      for (const event of events) {
        await this.handleTipped(event);
      }

      console.log('✅ All backfill events processed');
    } catch (error) {
      console.error('❌ Backfill error:', error);
      throw error;
    }
  }

  /**
   * APIサーバー起動
   */
  private startApiServer(): void {
    this.apiServer = createScoreApiServer({
      database: this.database,
      adminApiKey: this.config.adminApiKey,
    });

    this.apiServer.listen(this.config.apiPort, () => {
      console.log(`✅ API server listening on http://localhost:${this.config.apiPort}`);
    });
  }

  /**
   * デイリースナップショット
   */
  private scheduleDailySnapshot(): void {
    const targetTime = this.config.snapshotCron || '00:00';
    const [targetHour, targetMinute] = targetTime.split(':').map(Number);

    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(targetHour, targetMinute, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delay = next.getTime() - now.getTime();

      console.log(`📸 Next snapshot scheduled at ${next.toISOString()}`);

      setTimeout(async () => {
        try {
          console.log('📸 Generating daily snapshot...');
          const snapshot = await this.database.generateDailySnapshot();
          console.log(`✅ Snapshot generated: ${snapshot.totalUsers} users`);
        } catch (error) {
          console.error('❌ Snapshot generation error:', error);
        }

        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      config: {
        rpcUrl: this.config.rpcUrl,
        gifterraAddress: this.config.gifterraAddress,
        tokenAddress: this.config.tokenAddress,
        apiPort: this.config.apiPort,
        enableBackfill: this.config.enableBackfill,
        enableDailySnapshot: this.config.enableDailySnapshot,
      },
    };
  }
}

/**
 * 環境変数からGifterraインデクサを起動
 */
export async function startGifterraIndexerFromEnv(): Promise<GifterraIndexer> {
  const config: GifterraIndexerConfig = {
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    gifterraAddress: process.env.GIFTERRA_ADDRESS || '',
    tokenAddress: process.env.TOKEN_ADDRESS || '', // JPYCアドレス
    startBlock: process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined,

    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || '',

    apiPort: process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001,
    adminApiKey: process.env.ADMIN_API_KEY,

    enableBackfill: process.env.ENABLE_BACKFILL === 'true',
    backfillChunkSize: process.env.BACKFILL_CHUNK_SIZE
      ? parseInt(process.env.BACKFILL_CHUNK_SIZE)
      : 10000,
    enableDailySnapshot: process.env.ENABLE_DAILY_SNAPSHOT === 'true',
    snapshotCron: process.env.SNAPSHOT_CRON || '00:00',
  };

  // バリデーション
  if (!config.gifterraAddress) {
    throw new Error('GIFTERRA_ADDRESS environment variable is required');
  }
  if (!config.tokenAddress) {
    throw new Error('TOKEN_ADDRESS environment variable is required');
  }
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
  }

  const indexer = new GifterraIndexer(config);
  await indexer.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    await indexer.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return indexer;
}

// CLI実行時は直接起動
if (require.main === module) {
  // 環境変数USE_GIFTERRA=trueでGifterraインデクサを起動
  const useGifterra = process.env.USE_GIFTERRA === 'true';

  if (useGifterra) {
    startGifterraIndexerFromEnv()
      .then(() => {
        console.log('🎉 Gifterra Indexer is now running');
      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  } else {
    startIndexerFromEnv()
      .then(() => {
        console.log('🎉 Score Indexer is now running');
      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  }
}
