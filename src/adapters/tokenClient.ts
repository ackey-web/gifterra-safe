// src/adapters/tokenClient.ts
/**
 * Unified Token Client Interface
 *
 * Abstracts ERC20 token operations (JPYC, NHT)
 * Provides consistent API for token transfers and balance queries
 */

import { ethers } from 'ethers';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  balanceRaw: ethers.BigNumber;
}

export interface TokenTransferParams {
  tokenAddress: string;
  to: string;
  amount: string; // In ether units (e.g., "1.5" for 1.5 JPYC)
  decimals?: number;
}

/**
 * Unified Token Client
 */
export class TokenClient {
  private provider: ethers.providers.Provider;
  private signer: ethers.Signer | null;

  // Standard ERC20 ABI (minimal)
  private static readonly ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
  ];

  constructor(provider: ethers.providers.Provider, signer: ethers.Signer | null = null) {
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Get token balance for an address
   */
  async getBalance(tokenAddress: string, ownerAddress: string): Promise<TokenBalance> {
    try {
      const contract = new ethers.Contract(tokenAddress, TokenClient.ERC20_ABI, this.provider);

      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(ownerAddress),
        contract.decimals(),
        contract.symbol(),
        contract.name(),
      ]);

      return {
        token: {
          address: tokenAddress,
          symbol,
          decimals,
          name,
        },
        balance: ethers.utils.formatUnits(balance, decimals),
        balanceRaw: balance,
      };
    } catch (error) {
      console.error(`Failed to get balance for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get balances for multiple tokens
   */
  async getBalances(tokenAddresses: string[], ownerAddress: string): Promise<TokenBalance[]> {
    try {
      const balancePromises = tokenAddresses.map((address) =>
        this.getBalance(address, ownerAddress)
      );
      return await Promise.all(balancePromises);
    } catch (error) {
      console.error('Failed to get token balances:', error);
      throw error;
    }
  }

  /**
   * Transfer tokens
   */
  async transfer(params: TokenTransferParams): Promise<ethers.ContractTransaction> {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    try {
      const contract = new ethers.Contract(params.tokenAddress, TokenClient.ERC20_ABI, this.signer);

      // Get decimals if not provided
      const decimals = params.decimals ?? (await contract.decimals());

      // Convert amount to wei
      const amountWei = ethers.utils.parseUnits(params.amount, decimals);

      // Execute transfer
      const tx = await contract.transfer(params.to, amountWei);
      return tx;
    } catch (error) {
      console.error('Token transfer failed:', error);
      throw error;
    }
  }

  /**
   * Get token info
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      const contract = new ethers.Contract(tokenAddress, TokenClient.ERC20_ABI, this.provider);

      const [decimals, symbol, name] = await Promise.all([
        contract.decimals(),
        contract.symbol(),
        contract.name(),
      ]);

      return {
        address: tokenAddress,
        symbol,
        decimals,
        name,
      };
    } catch (error) {
      console.error(`Failed to get token info for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Check allowance
   */
  async getAllowance(
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<ethers.BigNumber> {
    try {
      const contract = new ethers.Contract(tokenAddress, TokenClient.ERC20_ABI, this.provider);
      return await contract.allowance(owner, spender);
    } catch (error) {
      console.error('Failed to check allowance:', error);
      throw error;
    }
  }

  /**
   * Approve spending
   */
  async approve(
    tokenAddress: string,
    spender: string,
    amount: string,
    decimals?: number
  ): Promise<ethers.ContractTransaction> {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    try {
      const contract = new ethers.Contract(tokenAddress, TokenClient.ERC20_ABI, this.signer);

      // Get decimals if not provided
      const tokenDecimals = decimals ?? (await contract.decimals());

      // Convert amount to wei
      const amountWei = ethers.utils.parseUnits(amount, tokenDecimals);

      // Execute approval
      const tx = await contract.approve(spender, amountWei);
      return tx;
    } catch (error) {
      console.error('Token approval failed:', error);
      throw error;
    }
  }
}
