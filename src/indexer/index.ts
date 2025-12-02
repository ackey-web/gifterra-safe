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

    try {
      // 1. データベース初期化

      await this.database.initialize();

      // 2. バックフィル（オプション）
      if (this.config.enableBackfill && this.config.startBlock !== undefined) {

        await this.runBackfill(this.config.startBlock);
      }

      // 3. イベントリスナー開始

      await this.listener.start();

      // 4. APIサーバー起動（オプション）
      if (this.config.apiPort) {

        this.startApiServer();
      }

      // 5. デイリースナップショット（オプション）
      if (this.config.enableDailySnapshot) {

        this.scheduleDailySnapshot();
      }

      this.isRunning = true;

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

    try {
      // イベントリスナー停止
      await this.listener.stop();

      // APIサーバー停止（実装は簡略化）
      if (this.apiServer) {

        // TODO: Graceful shutdown
      }

      this.isRunning = false;

    } catch (error) {
      console.error('❌ Error stopping indexer:', error);
      throw error;
    }
  }

  // ========================================
  // イベントハンドラ
  // ========================================

  private async handleScoreIncremented(event: ScoreIncrementedEvent): Promise<void> {

    try {
      await this.database.recordScore(
        event.user,
        event.token,
        event.amountRaw,
        event.axis,
        event.traceId,
        event.timestamp
      );

    } catch (error) {
      console.error(`❌ Error recording score for ${event.user}:`, error);
      // TODO: エラーログをDBに保存してリトライ可能にする
    }
  }

  private async handleScoreParamsUpdated(event: ScoreParamsUpdatedEvent): Promise<void> {

    try {
      await this.database.updateParams({
        weightEconomic: event.weightEconomic,
        weightResonance: event.weightResonance,
        curve: event.curve,
        lastUpdated: event.timestamp,
      });

    } catch (error) {
      console.error('❌ Error updating params:', error);
    }
  }

  private async handleTokenAxisUpdated(event: TokenAxisUpdatedEvent): Promise<void> {

    try {
      await this.database.updateTokenAxis(event.token, event.isEconomic);

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

      const events = await backfillEvents(
        this.listener,
        startBlock,
        currentBlock,
        chunkSize
      );

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


      setTimeout(async () => {
        try {

          const snapshot = await this.database.generateDailySnapshot();

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

    try {
      // 1. データベース初期化

      await this.database.initialize();

      // 2. バックフィル（オプション）
      if (this.config.enableBackfill && this.config.startBlock !== undefined) {

        await this.runBackfill(this.config.startBlock);
      }

      // 3. イベントリスナー開始

      await this.listener.start();

      // 4. APIサーバー起動（オプション）
      if (this.config.apiPort) {

        this.startApiServer();
      }

      // 5. デイリースナップショット（オプション）
      if (this.config.enableDailySnapshot) {

        this.scheduleDailySnapshot();
      }

      this.isRunning = true;

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

    try {
      await this.listener.stop();

      if (this.apiServer) {

        // TODO: Graceful shutdown
      }

      this.isRunning = false;

    } catch (error) {
      console.error('❌ Error stopping Gifterra indexer:', error);
      throw error;
    }
  }

  /**
   * Tippedイベントハンドラ
   */
  private async handleTipped(event: TippedEvent): Promise<void> {

    try {
      await this.database.recordTip(event, this.config.tokenAddress);

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

      const events = await backfillGifterraEvents(
        this.listener,
        startBlock,
        currentBlock,
        chunkSize
      );

      // イベントを順次処理
      for (const event of events) {
        await this.handleTipped(event);
      }

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


      setTimeout(async () => {
        try {

          const snapshot = await this.database.generateDailySnapshot();

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

      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  } else {
    startIndexerFromEnv()
      .then(() => {

      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  }
}
