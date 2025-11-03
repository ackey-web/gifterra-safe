// ========================================
// QR/Link Adapter: QR生成＋R2Pリンク統一IF
// ========================================

import QRCode from 'qrcode';
import { FEATURE_FLAGS } from '../utils/featureFlags';

export interface ScanLinkAdapter {
  generateQR: (data: string, options?: QROptions) => Promise<string>;
  generateR2PLink: (params: R2PParams) => Promise<R2PLink>;
  verifyR2PLink: (url: string) => Promise<R2PVerification>;
}

export interface QROptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export interface R2PParams {
  to: string;
  amount: string;
  token: string;
  expiresIn?: number; // seconds (default: 3600)
}

export interface R2PLink {
  url: string;
  qrCode: string;
  id: string;
  expiresAt: number;
}

export interface R2PVerification {
  valid: boolean;
  params?: R2PParams;
  error?: string;
}

export function useScanLink(): ScanLinkAdapter {
  return {
    // ─────────────────────────────────────
    // QRコード生成
    // ─────────────────────────────────────
    generateQR: async (data: string, options?: QROptions) => {
      try {
        const qrCode = await QRCode.toDataURL(data, {
          width: options?.width || 300,
          margin: options?.margin || 2,
          color: {
            dark: options?.darkColor || '#000000',
            light: options?.lightColor || '#ffffff',
          },
        });

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log('[ScanLink] QR generated for:', data.substring(0, 50) + '...');
        }

        return qrCode;
      } catch (error) {
        console.error('[ScanLink] generateQR error:', error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // R2P（Request to Pay）リンク生成
    // ─────────────────────────────────────
    generateR2PLink: async (params: R2PParams) => {
      try {
        // サーバーAPIにリクエスト
        const apiUrl =
          import.meta.env.VITE_API_BASE_URL || window.location.origin;

        const response = await fetch(`${apiUrl}/api/r2p/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: params.to,
            amount: params.amount,
            token: params.token,
            expiresIn: params.expiresIn || 3600,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create R2P link: ${response.statusText}`);
        }

        const data = await response.json();

        // URLパラメータ構築
        const urlParams = new URLSearchParams({
          id: data.id,
          sig: data.sig,
          to: params.to,
          amount: params.amount,
          token: params.token,
          expires: data.expiresAt.toString(),
        });

        const url = `${window.location.origin}/pay?${urlParams.toString()}`;

        // QRコード生成
        const qrCode = await QRCode.toDataURL(url, { width: 300 });

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log('[ScanLink] R2P link created:', {
            id: data.id,
            expiresAt: new Date(data.expiresAt * 1000).toISOString(),
          });
        }

        return {
          url,
          qrCode,
          id: data.id,
          expiresAt: data.expiresAt,
        };
      } catch (error) {
        console.error('[ScanLink] generateR2PLink error:', error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // R2Pリンク検証
    // ─────────────────────────────────────
    verifyR2PLink: async (url: string) => {
      try {
        const urlParams = new URLSearchParams(new URL(url).search);

        const id = urlParams.get('id');
        const sig = urlParams.get('sig');
        const to = urlParams.get('to');
        const amount = urlParams.get('amount');
        const token = urlParams.get('token');
        const expires = urlParams.get('expires');

        if (!id || !sig || !to || !amount || !token || !expires) {
          return {
            valid: false,
            error: 'Missing required parameters',
          };
        }

        // サーバーAPIで署名検証
        const apiUrl =
          import.meta.env.VITE_API_BASE_URL || window.location.origin;

        const response = await fetch(`${apiUrl}/api/r2p/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            sig,
            to,
            amount,
            token,
            expires,
          }),
        });

        if (!response.ok) {
          return {
            valid: false,
            error: 'Verification failed',
          };
        }

        const data = await response.json();

        if (!data.valid) {
          return {
            valid: false,
            error: data.error || 'Invalid signature',
          };
        }

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log('[ScanLink] R2P link verified:', id);
        }

        return {
          valid: true,
          params: {
            to,
            amount,
            token,
          },
        };
      } catch (error) {
        console.error('[ScanLink] verifyR2PLink error:', error);
        return {
          valid: false,
          error: 'Verification error: ' + (error as Error).message,
        };
      }
    },
  };
}
