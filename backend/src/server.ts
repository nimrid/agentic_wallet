import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { Connection } from '@solana/web3.js';
import { initRegistry, getOrCreateAgent, listActiveAgents, listPersistedAgents, tickAllAgents } from '@core/agentRegistry';
import * as dotenv from 'dotenv';

// Import route factories
import { createWalletRouter } from './routes/walletRoutes';
import { createStakingRouter } from './routes/stakingRoutes';
import { createTradingRouter } from './routes/tradingRoutes';
import { createLiquidityRouter } from './routes/liquidityRoutes';
import { createEarnRouter } from './routes/earnRoutes';
import { createChatRouter } from './routes/chatRoutes';
import { logger, errorHandler } from './middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------------------------
// Multi-Agent Router
// All agent-specific routes are mounted under /api/agents/:agentId/*
// The 'default' agent is also aliased to the top-level /api/* paths so the
// existing single-agent frontend continues working without any changes.
// ---------------------------------------------------------------------------
async function mountAgentRoutes(agentId: string): Promise<express.Router> {
  const state = await getOrCreateAgent(agentId);
  const router = express.Router();

  router.use('/wallet', createWalletRouter(state));
  router.use('/staking', createStakingRouter(state));
  router.use('/trading', createTradingRouter(state));
  router.use('/liquidity', createLiquidityRouter(state));
  router.use('/earn', createEarnRouter(state));
  router.use('/chat', createChatRouter(state));

  return router;
}

async function initialize() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not found in environment');

  // Boot the registry with shared infra
  initRegistry(connection, apiKey);

  // Always pre-warm the 'default' agent (used by the existing frontend)
  const defaultRouter = await mountAgentRoutes('default');

  // Top-level /api/* — backward-compatible with the existing frontend
  app.use('/api', defaultRouter);

  // Multi-agent prefix: /api/agents/:agentId/*
  // Uses a dynamic middleware that lazily spawns the requested agent.
  app.use('/api/agents/:agentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agentId = String(req.params.agentId);
      // Validate agentId (alphanumeric, hyphens, underscores only)
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(agentId)) {
        return res.status(400).json({ error: 'Invalid agentId. Use only letters, numbers, hyphens, or underscores (max 64 chars).' });
      }

      const state = await getOrCreateAgent(agentId);
      const agentRouter = express.Router({ mergeParams: true });

      agentRouter.use('/wallet', createWalletRouter(state));
      agentRouter.use('/staking', createStakingRouter(state));
      agentRouter.use('/trading', createTradingRouter(state));
      agentRouter.use('/liquidity', createLiquidityRouter(state));
      agentRouter.use('/earn', createEarnRouter(state));
      agentRouter.use('/chat', createChatRouter(state));

      agentRouter(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  // Management endpoints
  app.get('/api/agents', (_req, res) => {
    res.json({
      active: listActiveAgents(),
      persisted: listPersistedAgents()
    });
  });

  // Error handler
  app.use(errorHandler);

  // Serve frontend for all unmatched routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Background tick — processes recurring transfers for all active agents every minute
  setInterval(async () => {
    try {
      await tickAllAgents();
    } catch (err) {
      console.error('Error in agent tick:', err);
    }
  }, 60_000);
}

// Start server
initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🤖 Multi-agent API: http://localhost:${PORT}/api/agents/:agentId/*`);
    console.log(`📋 List agents:     http://localhost:${PORT}/api/agents`);
  });
}).catch(error => {
  console.error('Failed to initialize:', error);
  process.exit(1);
});
