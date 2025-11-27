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
    console.log('🚀 signPermitWithPrivyProvider() 開始');

    // Read-only providerでnonceとnameを取得
    console.log('📡 RPC接続開始: https://polygon-rpc.com');
    const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function nonces(address owner) view returns (uint256)',
        'function name() view returns (string)',
      ],
      readOnlyProvider
    );

    console.log('📡 nonce取得開始...');
    const nonce = await tokenContract.nonces(ownerAddress);
    console.log(`✅ nonce取得成功: ${nonce.toString()}`);

    console.log('📡 tokenName取得開始...');
    const tokenName = await tokenContract.name();
    console.log(`✅ tokenName取得成功: ${tokenName}`);

    console.log('📝 Privy Permit署名準備:', {
      owner: ownerAddress,
      spender: spenderAddress,
      value: amount,
      nonce: nonce.toString(),
      deadline,
    });
    console.log('📝 Domain:', JSON.stringify({
      name: tokenName,
      version: '1',
      chainId: chainId,
      verifyingContract: tokenAddress,
    }, null, 2));
    console.log('📝 Message Value:', JSON.stringify({
      owner: ownerAddress,
      spender: spenderAddress,
      value: amount,
      nonce: nonce.toNumber(),
      deadline,
    }, null, 2));

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
    // Standard EIP-712 format (eth_signTypedData_v4 automatically handles EIP712Domain)
    const typedData = {
      types: {
        Permit: types.Permit,
      },
      primaryType: 'Permit',
      domain,
      message: value,
    };

    console.log('📋 Privy署名データ:', JSON.stringify(typedData, null, 2));

    // Privyプロバイダーで署名
    console.log('✍️ Privy署名リクエスト送信中...');
    const signature = await privyProvider.request({
      method: 'eth_signTypedData_v4',
      params: [ownerAddress, JSON.stringify(typedData)],
    });
    console.log('✅ 署名受信成功:', signature);

    console.log('🔍 署名の分割処理中...');
    const sig = ethers.utils.splitSignature(signature);

    console.log('✅ Privy Permit署名完了:', {
      v: sig.v,
      r: sig.r,
      s: sig.s,
      deadline,
      nonce: nonce.toNumber(),
    });

    // 🔍 検証用: 署名パラメータを全て出力
    console.log('🔍 [検証用] 署名生成パラメータ完全版:');
    console.log('  owner:', ownerAddress);
    console.log('  spender:', spenderAddress);
    console.log('  amount:', amount);
    console.log('  deadline:', deadline);
    console.log('  nonce:', nonce.toNumber());
    console.log('  v:', sig.v);
    console.log('  r:', sig.r);
    console.log('  s:', sig.s);
    console.log('  tokenAddress:', tokenAddress);
    console.log('  tokenName:', tokenName);
    console.log('  chainId:', chainId);

    return {
      v: sig.v,
      r: sig.r,
      s: sig.s,
      deadline,
      nonce: nonce.toNumber(),
    };
  } catch (error: any) {
    console.error('❌ Privy Permit署名エラー:', error);
    console.error('❌ エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 200)
    });
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
    // Note: EIP712Domainは含めない（eth_signTypedData_v4が自動で処理）
    const typedData = {
      types: {
        Permit: types.Permit,
      },
      domain,
      primaryType: 'Permit',
      message: value,
    };

    console.log('📋 署名データ:', JSON.stringify(typedData, null, 2));

    // ethers.jsの_signTypedDataを使用（最も信頼性が高い）
    try {
      console.log('🔍 ethers.jsの_signTypedDataを使用');
      signature = await (signer as any)._signTypedData(domain, types, value);
      console.log('✅ _signTypedDataで署名成功');
    } catch (ethersError: any) {
      console.warn('⚠️ _signTypedData失敗、他の方法を試行:', ethersError.message);

      // フォールバック1: window.ethereum (MetaMask)
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          console.log('🔍 window.ethereum.requestを試行');
          const ethereum = (window as any).ethereum;
          signature = await ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [owner.toLowerCase(), JSON.stringify(typedData)],
          });
          console.log('✅ window.ethereum.requestで署名成功');
        } catch (windowError: any) {
          console.error('❌ すべての署名方法が失敗');
          throw windowError;
        }
      } else {
        throw ethersError;
      }
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
 * ガスレス決済用のPermitパラメータを準備（Privy Provider版）
 *
 * @param privyProvider - Privyプロバイダー
 * @param ownerAddress - 所有者アドレス
 * @param paymentGatewayAddress - PaymentGatewayコントラクトアドレス
 * @param jpycAddress - JPYCトークンアドレス
 * @param merchantAddress - 受取人（店舗）アドレス
 * @param amount - 金額（wei単位の文字列）
 * @param requestId - リクエストID（リプレイアタック防止用）
 * @param expiryMinutes - 有効期限（分）デフォルト: 30分
 * @returns PaymentGateway.executePaymentWithPermitに渡すパラメータ
 */
export async function preparePermitPaymentParamsWithPrivy(
  privyProvider: any,
  ownerAddress: string,
  paymentGatewayAddress: string,
  jpycAddress: string,
  merchantAddress: string,
  amount: string,
  requestId: string,
  expiryMinutes: number = 30
): Promise<{
  requestId: string;
  merchant: string;
  amount: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
}> {
  console.log('🚀 preparePermitPaymentParamsWithPrivy() 開始');
  console.log('📝 パラメータ:', {
    ownerAddress,
    paymentGatewayAddress,
    jpycAddress,
    merchantAddress,
    amount,
    requestId,
    expiryMinutes,
  });

  // 有効期限を設定（現在時刻 + expiryMinutes）
  const deadline = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
  console.log('⏰ deadline:', deadline);

  // Permit署名を生成（Privy Provider版）
  console.log('📝 signPermitWithPrivyProvider() を呼び出します');
  const permitSig = await signPermitWithPrivyProvider(
    privyProvider,
    ownerAddress,
    jpycAddress,
    paymentGatewayAddress,
    amount,
    deadline,
    137 // Polygon Mainnet
  );
  console.log('✅ signPermitWithPrivyProvider() 完了');

  const result = {
    requestId: requestId,
    merchant: merchantAddress,
    amount: amount,
    deadline: permitSig.deadline,
    v: permitSig.v,
    r: permitSig.r,
    s: permitSig.s,
  };
  console.log('✅ preparePermitPaymentParamsWithPrivy() 完了:', result);

  return result;
}

/**
 * ガスレス決済用のPermitパラメータを準備
 *
 * @param signer - ethers.js Signer
 * @param paymentGatewayAddress - PaymentGatewayコントラクトアドレス
 * @param jpycAddress - JPYCトークンアドレス
 * @param merchantAddress - 受取人（店舗）アドレス
 * @param amount - 金額（wei単位の文字列）
 * @param requestId - リクエストID（リプレイアタック防止用）
 * @param expiryMinutes - 有効期限（分）デフォルト: 30分
 * @returns PaymentGateway.executePaymentWithPermitに渡すパラメータ
 */
export async function preparePermitPaymentParams(
  signer: ethers.Signer,
  paymentGatewayAddress: string,
  jpycAddress: string,
  merchantAddress: string,
  amount: string,
  requestId: string,
  expiryMinutes: number = 30
): Promise<{
  requestId: string;
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
    requestId: requestId,
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
  'function executePaymentWithPermit(bytes32 requestId, address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function jpyc() view returns (address)',
  'function platformFeeRate() view returns (uint256)',
  'function platformFeeRecipient() view returns (address)',
  'function isRequestProcessed(bytes32 requestId) view returns (bool)',
];
