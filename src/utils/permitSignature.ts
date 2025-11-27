// src/utils/permitSignature.ts
// ERC-2612 Permit署名ユーティリティ
// ガスレス決済用のPermit署名を生成

import { ethers } from 'ethers';

/**
 * Privyプロバイダーから署名を取得（signer不要）
 */
export async function signPermitWithPrivyProvider(
  privyProvider: any,
  ownerAddress: string,
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  deadline: number,
  chainId: number = 137
): Promise<{
  v: number;
  r: string;
  s: string;
  deadline: number;
  nonce: number;
}> {
  try {
    // Read-only providerでnonceとnameを取得
    const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function nonces(address owner) view returns (uint256)',
        'function name() view returns (string)',
      ],
      readOnlyProvider
    );

    const nonce = await tokenContract.nonces(ownerAddress);
    const tokenName = await tokenContract.name();

    console.log('📝 Privy Permit署名準備:', {
      owner: ownerAddress,
      spender: spenderAddress,
      value: amount,
      nonce: nonce.toString(),
      deadline,
    });

    // EIP-712 Domain
    const domain = {
      name: tokenName,
      version: '1',
      chainId: chainId,
      verifyingContract: tokenAddress,
    };

    // Permit Type
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    // Permit Value
    const value = {
      owner: ownerAddress,
      spender: spenderAddress,
      value: amount,
      nonce: nonce.toNumber(),
      deadline,
    };

    // EIP-712 TypedData
    const typedData = {
      types,
      primaryType: 'Permit',
      domain,
      message: value,
    };

    // Privyプロバイダーで署名
    const signature = await privyProvider.request({
      method: 'eth_signTypedData_v4',
      params: [ownerAddress, JSON.stringify(typedData)],
    });

    const sig = ethers.utils.splitSignature(signature);

    console.log('✅ Privy Permit署名完了:', {
      v: sig.v,
      r: sig.r,
      s: sig.s,
    });

    return {
      v: sig.v,
      r: sig.r,
      s: sig.s,
      deadline,
      nonce: nonce.toNumber(),
    };
  } catch (error: any) {
    console.error('❌ Privy Permit署名エラー:', error);
    throw error;
  }
}

/**
 * EIP-712 Permit署名を生成
 *
 * @param signer - ethers.js Signer
 * @param tokenAddress - JPYCトークンアドレス
 * @param spenderAddress - PaymentGatewayアドレス
 * @param amount - 承認する金額（wei単位）
 * @param deadline - 有効期限（Unix timestamp）
 * @param chainId - チェーンID（デフォルト: 137 = Polygon Mainnet）
 * @returns Permit署名（v, r, s）とnonce
 */
export async function signPermit(
  signer: ethers.Signer,
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  deadline: number,
  chainId: number = 137
): Promise<{
  v: number;
  r: string;
  s: string;
  deadline: number;
  nonce: number;
}> {
  try {
    const owner = await signer.getAddress();

    // Read-only providerを使用してnonce取得（MetaMask署名リクエストを回避）
    const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function nonces(address owner) view returns (uint256)',
        'function name() view returns (string)',
      ],
      readOnlyProvider
    );

    const nonce = await tokenContract.nonces(owner);
    const tokenName = await tokenContract.name();

    console.log('📝 Permit署名準備:', {
      owner,
      spender: spenderAddress,
      value: amount,
      nonce: nonce.toString(),
      deadline,
    });

    // EIP-712 Domain
    const domain = {
      name: tokenName,
      version: '1',
      chainId: chainId,
      verifyingContract: tokenAddress,
    };

    // Permit Type
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    // Permit Value
    const value = {
      owner,
      spender: spenderAddress,
      value: amount,
      nonce: nonce.toNumber(),
      deadline,
    };

    console.log('🔐 EIP-712署名リクエスト準備完了');

    // EIP-712署名を取得
    let signature: string;

    // EIP-712 Typed Data形式
    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Permit: types.Permit,
      },
      domain,
      primaryType: 'Permit',
      message: value,
    };

    console.log('📋 署名データ:', JSON.stringify(typedData, null, 2));

    // 方法1: window.ethereumを直接使用（最優先、MetaMask/Privy両対応）
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const ethereum = (window as any).ethereum;
        signature = await ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [owner.toLowerCase(), JSON.stringify(typedData)],
        });
        console.log('✅ window.ethereum.requestで署名成功');
      } catch (windowError: any) {
        console.warn('⚠️ window.ethereum.request失敗:', windowError.message);

        // 方法2: provider.sendにフォールバック
        try {
          const provider = signer.provider as any;
          if (provider && provider.send) {
            signature = await provider.send('eth_signTypedData_v4', [
              owner.toLowerCase(),
              JSON.stringify(typedData),
            ]);
            console.log('✅ provider.sendで署名成功');
          } else {
            throw new Error('provider.send not available');
          }
        } catch (providerError: any) {
          console.warn('⚠️ provider.send失敗:', providerError.message);

          // 方法3: 最終フォールバック - _signTypedData
          signature = await (signer as any)._signTypedData(domain, types, value);
          console.log('✅ _signTypedDataで署名成功');
        }
      }
    } else {
      // window.ethereumがない場合は直接_signTypedDataを使用
      signature = await (signer as any)._signTypedData(domain, types, value);
      console.log('✅ _signTypedDataで署名成功（window.ethereum不在）');
    }

    const sig = ethers.utils.splitSignature(signature);

    console.log('✅ Permit署名完了:', {
      v: sig.v,
      r: sig.r,
      s: sig.s,
    });

    return {
      v: sig.v,
      r: sig.r,
      s: sig.s,
      deadline,
      nonce: nonce.toNumber(),
    };
  } catch (error: any) {
    console.error('❌ Permit署名エラー:', error);
    throw new Error(`Permit署名に失敗しました: ${error.message}`);
  }
}

/**
 * ガスレス決済用のPermitパラメータを準備
 *
 * @param signer - ethers.js Signer
 * @param paymentGatewayAddress - PaymentGatewayコントラクトアドレス
 * @param jpycAddress - JPYCトークンアドレス
 * @param merchantAddress - 受取人（店舗）アドレス
 * @param amount - 金額（wei単位の文字列）
 * @param _requestId - リクエストID（未使用、Supabase記録用に呼び出し側で使用）
 * @param expiryMinutes - 有効期限（分）デフォルト: 30分
 * @returns PaymentGateway.executePaymentWithPermitに渡すパラメータ
 */
export async function preparePermitPaymentParams(
  signer: ethers.Signer,
  paymentGatewayAddress: string,
  jpycAddress: string,
  merchantAddress: string,
  amount: string,
  _requestId: string,
  expiryMinutes: number = 30
): Promise<{
  merchant: string;
  amount: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
}> {
  // 有効期限を設定（現在時刻 + expiryMinutes）
  const deadline = Math.floor(Date.now() / 1000) + expiryMinutes * 60;

  // Permit署名を生成
  const permitSig = await signPermit(
    signer,
    jpycAddress,
    paymentGatewayAddress,
    amount,
    deadline,
    137 // Polygon Mainnet
  );

  return {
    merchant: merchantAddress,
    amount: amount,
    deadline: permitSig.deadline,
    v: permitSig.v,
    r: permitSig.r,
    s: permitSig.s,
  };
}

/**
 * PaymentGatewayのABI（executePaymentWithPermit関数のみ）
 */
export const PAYMENT_GATEWAY_ABI = [
  'function executePaymentWithPermit(address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function jpyc() view returns (address)',
  'function platformFeeRate() view returns (uint256)',
  'function platformFeeRecipient() view returns (address)',
  'function isRequestProcessed(bytes32 requestId) view returns (bool)',
];
