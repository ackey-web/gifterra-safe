// src/utils/permitSignature.ts
// ERC-2612 Permit署名ユーティリティ
// ガスレス決済用のPermit署名を生成

import { ethers } from 'ethers';

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

    // JPYCコントラクトからnonceを取得
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function nonces(address owner) view returns (uint256)',
        'function name() view returns (string)',
      ],
      signer
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

    // _signTypedData を使って署名
    const signature = await signer._signTypedData(domain, types, value);
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

  // requestIdをbytes32に変換
  const requestIdBytes32 = ethers.utils.id(requestId);

  return {
    requestId: requestIdBytes32,
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
