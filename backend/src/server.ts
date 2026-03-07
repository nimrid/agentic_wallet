import express from 'express';
import cors from 'cors';
import path from 'path';
import { Connection, Keypair } from '@solana/web3.js';
import { AgentChat } from '@services/chat';
import { loadOrCreateWallet } from '@core/wallet';
import { airdropOnNewWallet } from '@features/agentTools';
import { SolanaTrader } from '@features/trading';
import * as dotenv from 'dotenv';

// Import routes and middleware
import { WalletController } from './controllers/WalletController';
import { createWalletRouter } from './routes/walletRoutes';
import { createStakingRouter } from './routes/stakingRoutes';
import { createTradingRouter } from './routes/tradingRoutes';
import { createLiquidityRouter } from './routes/liquidityRoutes';
import { createEarnRouter } from './routes/earnRoutes';
import { createChatRouter } from './routes/chatRoutes';
import { logger, errorHandler } from './middleware';
import { AppState } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global state
let connection: Connection;
let wallet: Keypair;
let chat: AgentChat;
let trader: SolanaTrader | null = null;

// State management helper
const getState = (): AppState => ({
  connection,
  wallet,
  chat,
  get trader() {
    return trader;
  },
  setTrader: (newTrader: SolanaTrader | null) => {
    trader = newTrader;
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);
app.use(express.static(path.join(__dirname, '../public')));

// Initialize on startup
async function initialize() {
  connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in environment');
  }

  chat = new AgentChat(apiKey);

  // Load or create wallet
  wallet = await loadOrCreateWallet(async (address) => {
    console.log('🤖 Requesting AI agent decision on initial airdrop...');
    const result = await airdropOnNewWallet(address, chat);
    console.log(`Agent decision: ${result.agentDecision}`);
  });

  console.log('✅ Wallet initialized:', wallet.publicKey.toString());

  // Register Structured Routes
  const state = getState();
  app.use('/api/wallet', createWalletRouter(state));
  app.use('/api/staking', createStakingRouter(state));
  app.use('/api/trading', createTradingRouter(state));
  app.use('/api/liquidity', createLiquidityRouter(state));
  app.use('/api/earn', createEarnRouter(state));
  app.use('/api/chat', createChatRouter(state));

  // Legacy route support (Compatibility with existing frontend)
  // We use direct mapping to avoid 307 redirects for simple API calls
  const walletRouter = createWalletRouter(state);
  const stakingRouter = createStakingRouter(state);
  const liquidityRouter = createLiquidityRouter(state);

  const walletController = new WalletController(state);
  app.post('/api/send-sol', walletController.sendSol);
  app.post('/api/airdrop', walletController.requestAirdrop);
  app.post('/api/check-and-airdrop', walletController.checkAndAirdrop);

  // For specific legacy endpoints that don't match the new router structure prefixes
  app.get('/api/staking-stats', (req, res) => res.redirect('/api/staking/stats'));
  app.get('/api/pools', (req, res) => res.redirect('/api/liquidity/pools'));
  app.post('/api/stake', (req, res) => res.redirect(307, '/api/staking/stake'));
  app.post('/api/unstake', (req, res) => res.redirect(307, '/api/staking/unstake'));

  // Error Handler
  app.use(errorHandler);

  // Serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// Start server
initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize:', error);
  process.exit(1);
});
