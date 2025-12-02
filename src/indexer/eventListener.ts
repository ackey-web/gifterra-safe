/**
 * @file イベントリスナー - ScoreRegistryのイベントを監視
 */

import { ethers } from 'ethers';
import type {
  TippedEvent,
  ScoreIncrementedEvent,
  ScoreParamsUpdatedEvent,
  TokenAxisUpdatedEvent,
  Axis,
  Curve,
} from './types';

// ========================================
// ABIの定義（必要な部分のみ）
// ========================================

// Gifterra コントラクトの TIP イベント
const GIFTERRA_ABI = [
  'event Tipped(address indexed from, uint256 amount)',
];

// 将来のScoreRegistryとの互換性のため、型定義は維持
const SCORE_REGISTRY_ABI = [
  'event ScoreIncremented(address indexed user, address indexed token, uint256 amountRaw, bytes32 axis, bytes32 indexed traceId)',
  'event ScoreParamsUpdated(uint256 weightEconomic, uint256 weightResonance, uint8 curve, uint256 timestamp)',
  'event TokenAxisUpdated(address indexed token, bool isEconomic, uint256 timestamp)',
  'event MilestoneReached(address indexed user, bytes32 axis, uint256 level, string milestoneName, uint256 timestamp)',
];

// ========================================
// イベントリスナークラス
// ========================================

export class ScoreEventListener {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private handlers: EventHandlers;

  constructor(
    provider: ethers.Provider,
    contractAddress: string,
    handlers: EventHandlers
  ) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      contractAddress,
      SCORE_REGISTRY_ABI,
      provider
    );
    this.handlers = handlers;
  }

  /**
   * イベントリスナーを開始
   */
  async start(): Promise<void> {

    // ScoreIncremented イベント
    this.contract.on(
      'ScoreIncremented',
      async (user, token, amountRaw, axis, traceId, event) => {
        try {
          const parsed = await this.parseScoreIncrementedEvent(
            user,
            token,
            amountRaw,
            axis,
            traceId,
            event
          );
          await this.handlers.onScoreIncremented(parsed);
        } catch (error) {
          console.error('❌ Error handling ScoreIncremented:', error);
        }
      }
    );

    // ScoreParamsUpdated イベント
    this.contract.on(
      'ScoreParamsUpdated',
      async (weightEconomic, weightResonance, curve, timestamp, event) => {
        try {
          const parsed = await this.parseScoreParamsUpdatedEvent(
            weightEconomic,
            weightResonance,
            curve,
            timestamp,
            event
          );
          await this.handlers.onScoreParamsUpdated(parsed);
        } catch (error) {
          console.error('❌ Error handling ScoreParamsUpdated:', error);
        }
      }
    );

    // TokenAxisUpdated イベント
    this.contract.on(
      'TokenAxisUpdated',
      async (token, isEconomic, timestamp, event) => {
        try {
          const parsed = await this.parseTokenAxisUpdatedEvent(
            token,
            isEconomic,
            timestamp,
            event
          );
          await this.handlers.onTokenAxisUpdated(parsed);
        } catch (error) {
          console.error('❌ Error handling TokenAxisUpdated:', error);
        }
      }
    );

  }

  /**
   * イベントリスナーを停止
   */
  stop(): void {
    this.contract.removeAllListeners();
  }

  /**
   * 過去のイベントを取得（バックフィル用）
   * @param fromBlock 開始ブロック
   * @param toBlock 終了ブロック
   */
  async fetchHistoricalEvents(
    fromBlock: number,
    toBlock: number | 'latest'
  ): Promise<HistoricalEvents> {

    const scoreIncrementedEvents: ScoreIncrementedEvent[] = [];
    const scoreParamsUpdatedEvents: ScoreParamsUpdatedEvent[] = [];
    const tokenAxisUpdatedEvents: TokenAxisUpdatedEvent[] = [];

    // ScoreIncremented
    const filter1 = this.contract.filters.ScoreIncremented();
    const events1 = await this.contract.queryFilter(filter1, fromBlock, toBlock);
    for (const event of events1) {
      const parsed = await this.parseScoreIncrementedEvent(
        event.args![0],
        event.args![1],
        event.args![2],
        event.args![3],
        event.args![4],
        event
      );
      scoreIncrementedEvents.push(parsed);
    }

    // ScoreParamsUpdated
    const filter2 = this.contract.filters.ScoreParamsUpdated();
    const events2 = await this.contract.queryFilter(filter2, fromBlock, toBlock);
    for (const event of events2) {
      const parsed = await this.parseScoreParamsUpdatedEvent(
        event.args![0],
        event.args![1],
        event.args![2],
        event.args![3],
        event
      );
      scoreParamsUpdatedEvents.push(parsed);
    }

    // TokenAxisUpdated
    const filter3 = this.contract.filters.TokenAxisUpdated();
    const events3 = await this.contract.queryFilter(filter3, fromBlock, toBlock);
    for (const event of events3) {
      const parsed = await this.parseTokenAxisUpdatedEvent(
        event.args![0],
        event.args![1],
        event.args![2],
        event
      );
      tokenAxisUpdatedEvents.push(parsed);
    }

    return {
      scoreIncremented: scoreIncrementedEvents,
      scoreParamsUpdated: scoreParamsUpdatedEvents,
      tokenAxisUpdated: tokenAxisUpdatedEvents,
    };
  }

  // ========================================
  // パース関数
  // ========================================

  private async parseScoreIncrementedEvent(
    user: string,
    token: string,
    amountRaw: bigint,
    axis: string,
    traceId: string,
    event: any
  ): Promise<ScoreIncrementedEvent> {
    const block = await event.getBlock();

    return {
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      timestamp: new Date(block.timestamp * 1000),
      user: user.toLowerCase(),
      token: token.toLowerCase(),
      amountRaw,
      axis: this.parseAxis(axis),
      traceId: ethers.hexlify(traceId),
    };
  }

  private async parseScoreParamsUpdatedEvent(
    weightEconomic: bigint,
    weightResonance: bigint,
    curve: number,
    timestamp: bigint,
    event: any
  ): Promise<ScoreParamsUpdatedEvent> {
    return {
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date(Number(timestamp) * 1000),
      weightEconomic: Number(weightEconomic),
      weightResonance: Number(weightResonance),
      curve: this.parseCurve(curve),
    };
  }

  private async parseTokenAxisUpdatedEvent(
    token: string,
    isEconomic: boolean,
    timestamp: bigint,
    event: any
  ): Promise<TokenAxisUpdatedEvent> {
    return {
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date(Number(timestamp) * 1000),
      token: token.toLowerCase(),
      isEconomic,
    };
  }

  // ========================================
  // ヘルパー関数
  // ========================================

  private parseAxis(axisBytes: string): Axis {
    const axisStr = ethers.toUtf8String(axisBytes).replace(/\0/g, '');
    if (axisStr === 'ECONOMIC') return 'ECONOMIC';
    if (axisStr === 'RESONANCE') return 'RESONANCE';
    throw new Error(`Unknown axis: ${axisStr}`);
  }

  private parseCurve(curveNum: number): Curve {
    switch (curveNum) {
      case 0:
        return 'Linear';
      case 1:
        return 'Sqrt';
      case 2:
        return 'Log';
      default:
        throw new Error(`Unknown curve: ${curveNum}`);
    }
  }
}

// ========================================
// 型定義
// ========================================

export interface EventHandlers {
  onScoreIncremented: (event: ScoreIncrementedEvent) => Promise<void>;
  onScoreParamsUpdated: (event: ScoreParamsUpdatedEvent) => Promise<void>;
  onTokenAxisUpdated: (event: TokenAxisUpdatedEvent) => Promise<void>;
}

export interface GifterraEventHandlers {
  onTipped: (event: TippedEvent) => Promise<void>;
}

export interface HistoricalEvents {
  scoreIncremented: ScoreIncrementedEvent[];
  scoreParamsUpdated: ScoreParamsUpdatedEvent[];
  tokenAxisUpdated: TokenAxisUpdatedEvent[];
}

// ========================================
// ユーティリティ関数
// ========================================

/**
 * 最新ブロックを取得
 */
export async function getLatestBlock(provider: ethers.Provider): Promise<number> {
  const block = await provider.getBlock('latest');
  return block!.number;
}

/**
 * ブロック範囲を分割（大量のイベント取得時のレート制限対策）
 */
export function splitBlockRange(
  from: number,
  to: number,
  chunkSize: number = 10000
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];

  for (let start = from; start <= to; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, to);
    ranges.push({ from: start, to: end });
  }

  return ranges;
}

/**
 * バックフィル実行（分割して取得）
 */
export async function backfillEvents(
  listener: ScoreEventListener,
  fromBlock: number,
  toBlock: number,
  chunkSize: number = 10000
): Promise<HistoricalEvents> {
  const ranges = splitBlockRange(fromBlock, toBlock, chunkSize);

  const allEvents: HistoricalEvents = {
    scoreIncremented: [],
    scoreParamsUpdated: [],
    tokenAxisUpdated: [],
  };

  for (const range of ranges) {

    const events = await listener.fetchHistoricalEvents(range.from, range.to);

    allEvents.scoreIncremented.push(...events.scoreIncremented);
    allEvents.scoreParamsUpdated.push(...events.scoreParamsUpdated);
    allEvents.tokenAxisUpdated.push(...events.tokenAxisUpdated);

    // レート制限対策：少し待機
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allEvents;
}

// ========================================
// Gifterraイベントリスナークラス（現在使用中）
// ========================================

/**
 * GifterraコントラクトのTippedイベントを監視
 */
export class GifterraEventListener {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private handlers: GifterraEventHandlers;
  private tokenAddress: string;

  constructor(
    provider: ethers.Provider,
    contractAddress: string,
    tokenAddress: string,
    handlers: GifterraEventHandlers
  ) {
    this.provider = provider;
    this.tokenAddress = tokenAddress;
    this.contract = new ethers.Contract(
      contractAddress,
      GIFTERRA_ABI,
      provider
    );
    this.handlers = handlers;
  }

  /**
   * イベントリスナーを開始
   */
  async start(): Promise<void> {

    // Tipped イベント
    this.contract.on(
      'Tipped',
      async (from, amount, event) => {
        try {
          const parsed = await this.parseTippedEvent(from, amount, event);
          await this.handlers.onTipped(parsed);
        } catch (error) {
          console.error('❌ Error handling Tipped:', error);
        }
      }
    );

  }

  /**
   * イベントリスナーを停止
   */
  stop(): void {
    this.contract.removeAllListeners();
  }

  /**
   * 過去のイベントを取得（バックフィル用）
   */
  async fetchHistoricalEvents(
    fromBlock: number,
    toBlock: number | 'latest'
  ): Promise<TippedEvent[]> {

    const tippedEvents: TippedEvent[] = [];

    const filter = this.contract.filters.Tipped();
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
      const parsed = await this.parseTippedEvent(
        event.args![0],
        event.args![1],
        event
      );
      tippedEvents.push(parsed);
    }

    return tippedEvents;
  }

  /**
   * Tippedイベントをパース
   */
  private async parseTippedEvent(
    from: string,
    amount: bigint,
    event: any
  ): Promise<TippedEvent> {
    const block = await event.getBlock();

    // コントラクトのownerを取得（受取人）
    const owner = await this.contract.owner();

    return {
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      timestamp: new Date(block.timestamp * 1000),
      from: from.toLowerCase(),
      to: owner.toLowerCase(), // 受取人 = コントラクトのowner
      amount,
      message: undefined, // 現在のコントラクトにはメッセージフィールドがない
    };
  }
}

/**
 * Gifterraイベントのバックフィル実行
 */
export async function backfillGifterraEvents(
  listener: GifterraEventListener,
  fromBlock: number,
  toBlock: number,
  chunkSize: number = 10000
): Promise<TippedEvent[]> {
  const ranges = splitBlockRange(fromBlock, toBlock, chunkSize);
  const allEvents: TippedEvent[] = [];

  for (const range of ranges) {

    const events = await listener.fetchHistoricalEvents(range.from, range.to);
    allEvents.push(...events);

    // レート制限対策：少し待機
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allEvents;
}
