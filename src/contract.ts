// src/contract.ts - Minimal version for useTokenBalances
import { getAddress } from "viem";

/* =========================================
   ✅ Token Definitions
   📝 Phase 2b: トークン残高読み込み機能用の最小定義
========================================= */

// JPYC Token (Polygon Mainnet)
export const JPYC_TOKEN = {
  ADDRESS: getAddress("0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29"),
  SYMBOL: "JPYC",
  DECIMALS: 18,
  NAME: "JPY Coin",
} as const;

// NHT Token (Polygon Mainnet)
export const NHT_TOKEN = {
  ADDRESS: getAddress(
    (import.meta as any)?.env?.VITE_NHT_MAINNET_ADDRESS ||
    "0x3cc0e67d0abAbEe99F881AbADa7ef9398Dcf3757"
  ),
  SYMBOL: "NHT",
  DECIMALS: 18,
  NAME: "NHT Token",
} as const;

/* =========================================
   ✅ ERC20 Minimal ABI
   📝 トークン残高取得に必要な最小限のABI
========================================= */

export const ERC20_MIN_ABI = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
