/**
 * @file スコアシステム REST API
 * @description 二軸スコアシステムのAPIエンドポイント
 */

import express, { Request, Response, Router } from 'express';
import { ScoreDatabase } from '../indexer/database';
import type { Axis, ScoreParams, Curve } from '../indexer/types';
import { createGiftyApiRouter } from './giftyApi';

/**
 * スコアAPI設定
 */
export interface ScoreApiConfig {
  database: ScoreDatabase;
  adminApiKey?: string; // Admin操作の認証キー
}

/**
 * スコアAPIルーター作成
 */
export function createScoreApiRouter(config: ScoreApiConfig): Router {
  const router = express.Router();
  const { database, adminApiKey } = config;

  // ========================================
  // ミドルウェア: Admin認証
  // ========================================

  const requireAdmin = (req: Request, res: Response, next: Function) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!adminApiKey || apiKey !== adminApiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid admin API key required',
      });
    }

    next();
  };

  // ========================================
  // ユーザースコアエンドポイント
  // ========================================

  /**
   * GET /api/profile/:userId
   * ユーザーの完全なスコアプロフィールを取得
   */
  router.get('/profile/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userScore = await database.getUserScore(userId.toLowerCase());

      if (!userScore) {
        return res.status(404).json({
          error: 'User not found',
          message: `No score data for user: ${userId}`,
        });
      }

      res.json({
        success: true,
        data: {
          userId: userScore.userId,
          address: userScore.address,
          economic: {
            score: userScore.economic.normalized,
            level: userScore.economic.level,
            displayLevel: userScore.economic.displayLevel,
            raw: userScore.economic.raw.toString(),
            tokens: Object.entries(userScore.economic.tokens).reduce(
              (acc, [token, amount]) => {
                acc[token] = amount.toString();
                return acc;
              },
              {} as { [key: string]: string }
            ),
          },
          resonance: {
            score: userScore.resonance.normalized,
            level: userScore.resonance.level,
            displayLevel: userScore.resonance.displayLevel,
            count: userScore.resonance.count,
            streak: userScore.resonance.streak,
            longestStreak: userScore.resonance.longestStreak,
            lastDate: userScore.resonance.lastDate?.toISOString(),
            actions: userScore.resonance.actions,
          },
          composite: {
            score: userScore.composite.value,
            economicWeight: userScore.composite.economicWeight,
            resonanceWeight: userScore.composite.resonanceWeight,
            curve: userScore.composite.curve,
            formula: userScore.composite.formula,
          },
          lastUpdated: userScore.lastUpdated.toISOString(),
        },
      });
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/profile/:userId/rank
   * ユーザーの各軸でのランキング順位を取得
   */
  router.get('/profile/:userId/rank', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userScore = await database.getUserScore(userId.toLowerCase());

      if (!userScore) {
        return res.status(404).json({
          error: 'User not found',
          message: `No score data for user: ${userId}`,
        });
      }

      // 各軸のランキングを取得してユーザーの順位を特定
      const economicRankings = await database.generateRankings('ECONOMIC');
      const resonanceRankings = await database.generateRankings('RESONANCE');
      const compositeRankings = await database.generateRankings('COMPOSITE');

      const economicRank = economicRankings.findIndex(
        (r) => r.address.toLowerCase() === userId.toLowerCase()
      ) + 1;
      const resonanceRank = resonanceRankings.findIndex(
        (r) => r.address.toLowerCase() === userId.toLowerCase()
      ) + 1;
      const compositeRank = compositeRankings.findIndex(
        (r) => r.address.toLowerCase() === userId.toLowerCase()
      ) + 1;

      res.json({
        success: true,
        data: {
          userId,
          ranks: {
            economic: economicRank || null,
            resonance: resonanceRank || null,
            composite: compositeRank || null,
          },
          totalUsers: economicRankings.length,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching user rank:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========================================
  // ランキングエンドポイント
  // ========================================

  /**
   * GET /api/rankings/:axis
   * 指定軸のランキングを取得
   * @query limit - 取得件数（デフォルト: 100）
   * @query offset - オフセット（デフォルト: 0）
   */
  router.get('/rankings/:axis', async (req: Request, res: Response) => {
    try {
      const { axis } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      // 軸のバリデーション
      const validAxes = ['ECONOMIC', 'RESONANCE', 'COMPOSITE'];
      const axisUpper = axis.toUpperCase();

      if (!validAxes.includes(axisUpper)) {
        return res.status(400).json({
          error: 'Invalid axis',
          message: `Axis must be one of: ${validAxes.join(', ')}`,
        });
      }

      const rankings = await database.generateRankings(
        axisUpper as Axis | 'COMPOSITE'
      );

      // ページネーション
      const paginatedRankings = rankings.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          axis: axisUpper,
          rankings: paginatedRankings,
          pagination: {
            limit,
            offset,
            total: rankings.length,
            hasMore: offset + limit < rankings.length,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error fetching rankings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/rankings/all
   * 全軸のランキングを一括取得（トップN件）
   */
  router.get('/rankings/all', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;

      const [economicRankings, resonanceRankings, compositeRankings] =
        await Promise.all([
          database.generateRankings('ECONOMIC'),
          database.generateRankings('RESONANCE'),
          database.generateRankings('COMPOSITE'),
        ]);

      res.json({
        success: true,
        data: {
          economic: economicRankings.slice(0, limit),
          resonance: resonanceRankings.slice(0, limit),
          composite: compositeRankings.slice(0, limit),
        },
      });
    } catch (error) {
      console.error('❌ Error fetching all rankings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========================================
  // スナップショットエンドポイント
  // ========================================

  /**
   * GET /api/snapshot/latest
   * 最新のデイリースナップショットを取得
   */
  router.get('/snapshot/latest', async (req: Request, res: Response) => {
    try {
      const snapshot = await database.generateDailySnapshot();

      res.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      console.error('❌ Error fetching snapshot:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========================================
  // Admin管理エンドポイント
  // ========================================

  /**
   * GET /api/admin/params
   * 現在のスコアパラメータを取得
   */
  router.get('/admin/params', requireAdmin, async (req: Request, res: Response) => {
    try {
      // データベースから最新パラメータを取得（内部状態）
      res.json({
        success: true,
        data: {
          // TODO: データベースから取得
          message: 'Parameter retrieval not yet implemented',
        },
      });
    } catch (error) {
      console.error('❌ Error fetching params:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/admin/params
   * スコアパラメータを更新
   */
  router.post('/admin/params', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { weightEconomic, weightResonance, curve } = req.body;

      // バリデーション
      if (
        typeof weightEconomic !== 'number' ||
        typeof weightResonance !== 'number'
      ) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'weightEconomic and weightResonance must be numbers',
        });
      }

      if (weightEconomic <= 0 || weightResonance <= 0) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'Weights must be greater than 0',
        });
      }

      const validCurves = ['Linear', 'Sqrt', 'Log'];
      if (!validCurves.includes(curve)) {
        return res.status(400).json({
          error: 'Invalid curve',
          message: `Curve must be one of: ${validCurves.join(', ')}`,
        });
      }

      const params: ScoreParams = {
        weightEconomic,
        weightResonance,
        curve: curve as Curve,
        lastUpdated: new Date(),
      };

      await database.updateParams(params);

      res.json({
        success: true,
        message: 'Parameters updated successfully',
        data: params,
      });
    } catch (error) {
      console.error('❌ Error updating params:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/admin/token-axis
   * トークンの軸を設定
   */
  router.post('/admin/token-axis', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { token, isEconomic } = req.body;

      if (!token || typeof isEconomic !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'token (string) and isEconomic (boolean) are required',
        });
      }

      await database.updateTokenAxis(token, isEconomic);

      res.json({
        success: true,
        message: 'Token axis updated successfully',
        data: { token, isEconomic },
      });
    } catch (error) {
      console.error('❌ Error updating token axis:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========================================
  // ヘルスチェック
  // ========================================

  /**
   * GET /api/health
   * APIヘルスチェック
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      // TODO: データベース接続チェック
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

/**
 * Express アプリケーション作成
 */
export function createScoreApiServer(config: ScoreApiConfig): express.Application {
  const app = express();

  // ミドルウェア
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS設定（必要に応じて）
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    next();
  });

  // ルーター設定
  const router = createScoreApiRouter(config);
  app.use('/api', router);

  // Gifty AIルーター設定
  const giftyRouter = createGiftyApiRouter();
  app.use('/api/gifty', giftyRouter);

  // 404ハンドラ
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // エラーハンドラ
  app.use((err: Error, req: Request, res: Response, next: Function) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}
