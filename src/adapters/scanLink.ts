// src/adapters/scanLink.ts
/**
 * Unified Scan Link Generator
 *
 * Generates QR codes and R2P (Real-to-Physical) links
 * Abstracts different link formats and protocols
 */

export interface ScanLinkParams {
  recipientAddress: string;
  tokenAddress?: string;
  amount?: string;
  message?: string;
  chainId?: number;
}

export interface QRCodeData {
  value: string;
  format: 'address' | 'ethereum' | 'walletconnect' | 'custom';
}

/**
 * Unified Scan Link Generator
 */
export class ScanLinkGenerator {
  private defaultChainId: number;

  constructor(defaultChainId: number = 137) {
    this.defaultChainId = defaultChainId;
  }

  /**
   * Generate simple address QR code
   * Format: 0x123...abc
   */
  generateAddressQR(address: string): QRCodeData {
    return {
      value: address,
      format: 'address',
    };
  }

  /**
   * Generate Ethereum payment request QR code
   * Format: ethereum:0x123...abc@137?value=1000000000000000000
   *
   * EIP-681: https://eips.ethereum.org/EIPS/eip-681
   */
  generatePaymentRequestQR(params: ScanLinkParams): QRCodeData {
    const {
      recipientAddress,
      tokenAddress,
      amount,
      message,
      chainId = this.defaultChainId,
    } = params;

    let uri = `ethereum:${recipientAddress}@${chainId}`;

    const queryParams: string[] = [];

    if (tokenAddress) {
      // ERC20 transfer
      queryParams.push(`token=${tokenAddress}`);
    }

    if (amount) {
      queryParams.push(`value=${amount}`);
    }

    if (message) {
      queryParams.push(`message=${encodeURIComponent(message)}`);
    }

    if (queryParams.length > 0) {
      uri += `?${queryParams.join('&')}`;
    }

    return {
      value: uri,
      format: 'ethereum',
    };
  }

  /**
   * Generate WalletConnect QR code
   *
   * Note: Actual WalletConnect URI generation requires SDK
   * This is a placeholder for future implementation
   */
  generateWalletConnectQR(connectionString: string): QRCodeData {
    return {
      value: connectionString,
      format: 'walletconnect',
    };
  }

  /**
   * Generate custom R2P link
   * Format: https://your-domain.com/receive?address=0x123&token=JPYC&amount=100
   *
   * Used for real-to-physical integrations (vending machines, POS, etc.)
   */
  generateR2PLink(params: ScanLinkParams, baseUrl: string): QRCodeData {
    const { recipientAddress, tokenAddress, amount, message } = params;

    const url = new URL('/receive', baseUrl);
    url.searchParams.set('address', recipientAddress);

    if (tokenAddress) {
      url.searchParams.set('token', tokenAddress);
    }

    if (amount) {
      url.searchParams.set('amount', amount);
    }

    if (message) {
      url.searchParams.set('message', message);
    }

    return {
      value: url.toString(),
      format: 'custom',
    };
  }

  /**
   * Parse Ethereum URI (EIP-681)
   */
  parseEthereumURI(uri: string): ScanLinkParams | null {
    try {
      // Remove "ethereum:" prefix
      if (!uri.startsWith('ethereum:')) {
        return null;
      }

      const withoutPrefix = uri.substring(9);

      // Split address@chainId and query params
      const [addressPart, queryPart] = withoutPrefix.split('?');
      const [address, chainIdStr] = addressPart.split('@');

      const params: ScanLinkParams = {
        recipientAddress: address,
      };

      if (chainIdStr) {
        params.chainId = parseInt(chainIdStr, 10);
      }

      if (queryPart) {
        const query = new URLSearchParams(queryPart);

        if (query.has('token')) {
          params.tokenAddress = query.get('token') || undefined;
        }

        if (query.has('value')) {
          params.amount = query.get('value') || undefined;
        }

        if (query.has('message')) {
          params.message = query.get('message') || undefined;
        }
      }

      return params;
    } catch (error) {
      console.error('Failed to parse Ethereum URI:', error);
      return null;
    }
  }

  /**
   * Parse custom R2P link
   */
  parseR2PLink(url: string): ScanLinkParams | null {
    try {
      const urlObj = new URL(url);

      const address = urlObj.searchParams.get('address');
      if (!address) {
        return null;
      }

      const params: ScanLinkParams = {
        recipientAddress: address,
      };

      const token = urlObj.searchParams.get('token');
      if (token) {
        params.tokenAddress = token;
      }

      const amount = urlObj.searchParams.get('amount');
      if (amount) {
        params.amount = amount;
      }

      const message = urlObj.searchParams.get('message');
      if (message) {
        params.message = message;
      }

      return params;
    } catch (error) {
      console.error('Failed to parse R2P link:', error);
      return null;
    }
  }
}
