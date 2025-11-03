# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

# Gifterra - Web3 Community Rewards Platform

A decentralized application (DApp) for community rewards and tipping system built on Polygon Amoy testnet.

## Features

- **Daily Rewards**: Users can claim daily token rewards
- **Tip System**: Send tips to other community members
- **NFT Level System**: Progressive ranking system
- **Admin Dashboard**: Analytics and management tools
- **AI Analysis**: Sentiment analysis using OpenAI API

## Tech Stack

- React 18 + TypeScript + Vite
- ThirdWeb SDK v4
- Polygon Amoy Testnet
- Alchemy RPC
- Recharts for analytics

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   - `VITE_ALCHEMY_RPC_URL`: Your Alchemy API endpoint for Polygon Amoy
   - `VITE_OPENAI_API_KEY`: OpenAI API key for AI analysis features
   - `VITE_THIRDWEB_CLIENT_ID`: ThirdWeb client ID for Web3 functionality

## OpenAI API Setup

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Go to [API Keys](https://platform.openai.com/api-keys)
3. Create a new API key
4. Add credits to your account (minimum $5 recommended)
5. Set the API key in your environment variables:
   ```bash
   VITE_OPENAI_API_KEY=sk-your_actual_api_key_here
   ```

**Note**: Without OpenAI API key, the app will use mock sentiment analysis.

## ThirdWeb Setup

1. Sign up at [ThirdWeb Dashboard](https://thirdweb.com/dashboard)
2. Create a new project
3. Get your Client ID from the dashboard
4. Set the Client ID in your environment variables:
   ```bash
   VITE_THIRDWEB_CLIENT_ID=your_actual_client_id_here
   ```

**⚠️ Important**: Invalid or expired Client IDs will cause 401 authentication errors and transaction failures.

5. Start development server:
   ```bash
   pnpm dev
   ```

## Alchemy Setup

1. Sign up at [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Create a new app for Polygon Amoy testnet  
3. Copy the HTTP URL and add it to your environment variables

**⚠️ 重要**: デモエンドポイント (`/v2/demo`) はCORSポリシーによりブラウザからの直接アクセスが制限されています。実際のAPIキーが必要です。

**フォールバック**: Alchemyが設定されていない場合、自動的にパブリックRPCエンドポイントを使用します。

## Deployment

The project is configured for Vercel deployment with SPA routing support.

Build command: `pnpm build`
Output directory: `dist`

## Smart Contract

- **Address**: `0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC`
- **Token**: tNHT (`0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea`)
- **Network**: Polygon Amoy Testnet (Chain ID: 80002)

## URL Structure

- Reward UI: `/` or `/?ui=reward`
- Tip UI: `/?ui=tip` 
- Admin Dashboard: `/?ui=admin`
