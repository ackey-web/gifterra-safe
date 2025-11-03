// src/adapters/walletClient.ts
/**
 * Unified Wallet Client Interface
 *
 * Abstracts Privy and ThirdWeb wallet operations
 * Provides consistent API regardless of underlying provider
 */

import { ethers } from 'ethers';

export interface WalletAdapter {
  getAddress: () => Promise<string | null>;
  getSigner: () => Promise<ethers.Signer | null>;
  isConnected: () => boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Privy Wallet Adapter (Current - Phase 4)
 */
export class PrivyWalletAdapter implements WalletAdapter {
  private privy: any;

  constructor(privyInstance: any) {
    this.privy = privyInstance;
  }

  async getAddress(): Promise<string | null> {
    try {
      if (!this.privy?.authenticated || !this.privy?.user?.wallet?.address) {
        return null;
      }
      return this.privy.user.wallet.address;
    } catch (error) {
      console.error('Failed to get address from Privy:', error);
      return null;
    }
  }

  async getSigner(): Promise<ethers.Signer | null> {
    try {
      if (!this.privy?.authenticated) {
        return null;
      }

      // Get embedded wallet provider
      const provider = await this.privy.getEthereumProvider();
      if (!provider) {
        return null;
      }

      const ethersProvider = new ethers.providers.Web3Provider(provider);
      return ethersProvider.getSigner();
    } catch (error) {
      console.error('Failed to get signer from Privy:', error);
      return null;
    }
  }

  isConnected(): boolean {
    return !!this.privy?.authenticated;
  }

  async connect(): Promise<void> {
    if (!this.privy?.login) {
      throw new Error('Privy not initialized');
    }
    await this.privy.login();
  }

  async disconnect(): Promise<void> {
    if (!this.privy?.logout) {
      throw new Error('Privy not initialized');
    }
    await this.privy.logout();
  }
}

/**
 * ThirdWeb Wallet Adapter (Legacy - MVP)
 *
 * Note: This is a placeholder for future migration support
 * Actual implementation would require ThirdWeb SDK integration
 */
export class ThirdWebWalletAdapter implements WalletAdapter {
  private thirdweb: any;

  constructor(thirdwebInstance: any) {
    this.thirdweb = thirdwebInstance;
  }

  async getAddress(): Promise<string | null> {
    // TODO: Implement when migrating legacy code
    console.warn('ThirdWeb adapter not fully implemented');
    return null;
  }

  async getSigner(): Promise<ethers.Signer | null> {
    // TODO: Implement when migrating legacy code
    console.warn('ThirdWeb adapter not fully implemented');
    return null;
  }

  isConnected(): boolean {
    // TODO: Implement when migrating legacy code
    return false;
  }

  async connect(): Promise<void> {
    // TODO: Implement when migrating legacy code
    throw new Error('ThirdWeb adapter not fully implemented');
  }

  async disconnect(): Promise<void> {
    // TODO: Implement when migrating legacy code
    throw new Error('ThirdWeb adapter not fully implemented');
  }
}

/**
 * Factory function to create appropriate wallet adapter
 */
export function createWalletAdapter(provider: 'privy' | 'thirdweb', instance: any): WalletAdapter {
  switch (provider) {
    case 'privy':
      return new PrivyWalletAdapter(instance);
    case 'thirdweb':
      return new ThirdWebWalletAdapter(instance);
    default:
      throw new Error(`Unknown wallet provider: ${provider}`);
  }
}
