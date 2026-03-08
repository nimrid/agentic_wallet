---
name: Money Glitch: Solana Agent Wallet System
description: Build autonomous, AI-driven DeFi applications on Solana with Agent Wallet. Includes smart liquidity management, trading loops, yield farming, and natural language intent parsing.
---

# Solana Agent Wallet System Guide

Agent Wallet provides a comprehensive suite of AI-driven DeFi agents on Solana:

- **AI Intent Parsing (`AgentChat`)**: LLM-powered natural language processor that interprets user requests.
- **Automated Trading (`SolanaTrader`)**: Interval-based trading agent on Orca Whirlpools.
- **Smart Liquidity (`Meteora DLMM`)**: Single-sided SOL liquidity provision guided by AI sizing.
- **Liquid Staking (`Marinade`)**: Autonomous calculation of ideal stake amounts using mSOL integrations.
- **Yield Farming (`Kamino`)**: AI-guided analysis and vault selection.
- **The Money Glitch**: Recursive, sequential autonomous loop (Stake -> Trade -> Liquidity) with built-in safety limits.

## Quick Start

### Installation
```bash
# Clone the repository and install dependencies
cd agent-wallet/backend
npm install

# Required dependencies overview
npm install @solana/web3.js @meteora-ag/dlmm @orca-so/whirlpools @marinade.finance/marinade-ts-sdk @kamino-finance/klend-sdk groq-sdk
```

### Environment Setup
```env
# .env file
GROQ_API_KEY=your_groq_api_key_here
```

---

## Architecture & Core Tools

The ecosystem revolves around Express.js serving the `AppState` to feature controllers.

### Core Classes & Features
| Class / Module | Purpose |
|----------------|---------|
| `AgentChat` | Groq LLM integration; prompts AI for decisions (`getAISolAmount`, `getStakingAmount`) |
| `SolanaTrader` | Background worker that checks Orca SOL/USDC pool and executes AI-advised trades |
| `WalletController` | Airdrops, balances, SOL transfers |
| `checkSpendLimits` | Global safety module. Rejects any transaction > 2 SOL, or > 5 SOL/day |

---

## 1. AI Decision Integration (`agentTools`)

Before executing DeFi operations, Agent Wallet consults the AI for sizing and strategy.

### Calculating Spend Amounts (Liquidity)
```typescript
import { getAISolAmount } from '@features/agentTools';

// The AI is informed of the max allowed (2.0 SOL) and current balance
const solAmount = await getAISolAmount(
  chatModel, 
  "Meteora SOL/USDC Pool", 
  currentSolBalance
);
// Returns a safe number (e.g., 0.5)
```

### AI Trading Decision
```typescript
import { getAITradingDecision } from '@features/agentTools';

// Ask AI whether to buy/sell/hold based on current price action
const decision = await getAITradingDecision(
  chatModel,
  currentPrice,
  averagePrice,
  priceChangePercent,
  solBalance,
  usdcBalance,
  totalProfit,
  historyLength
);
// Returns: 'buy', 'sell', or 'hold'
```

---

## 2. Meteora Liquidity Provision

Automated single-sided liquidity deposits to Meteora DLMM pools.

### Add Liquidity (Spot Strategy)
```typescript
import { addLiquidity } from '@features/liquidity';

async function executeLiquidity(connection: Connection, wallet: Keypair, amount: number) {
  // Finds active bin and creates a +/- 10 bin Spot strategy
  const result = await addLiquidity(
    connection, 
    wallet, 
    "Pool_Address_Here", // e.g. Metora SOL/USDC
    amount
  );
  console.log("Position created:", result.positionPubKey);
}
```

---

## 3. Orca Whirlpool Trading (`SolanaTrader`)

The `SolanaTrader` class runs an autonomous interval loop evaluating token swaps.

### Initialize & Run Trader
```typescript
import { SolanaTrader } from '@features/trading';

const trader = new SolanaTrader(
  connection, 
  wallet, 
  {
    checkInterval: 30000,   // Check every 30 seconds
    maxTradeAmount: 0.1,    // Max USDC/SOL per trade
  }, 
  tradeDecisionCallback     // Custom logic or AI callback
);

await trader.initialize();
trader.startMonitoring();

// To halt:
// trader.stopMonitoring();
```

---

## 4. Marinade Liquid Staking

Agent Wallet interacts with Marinade to stake SOL and receive mSOL.

### Staking SOL
```typescript
import { stakeSol, getMSolBalance } from '@features/staking';

async function executeStake(connection: Connection, wallet: Keypair, amount: number) {
  // Amount in SOL (not lamports for this function interface)
  const result = await stakeSol(connection, wallet, amount);
  console.log("mSOL Token Account:", result.mSolTokenAccount);
  
  const mSolBal = await getMSolBalance(connection, wallet);
  // Returns 0 if TokenAccountNotFoundError, instead of crashing
}
```

---

## 5. Kamino Yield Farming

Identify best Kamino reserves and deposit assets.

### Select Best Vault & Deposit
```typescript
import { getAvailableVaults, selectBestVault, depositToVault } from '@features/earn';

// Ask AI to pick highest APY vault
const allVaults = await getAvailableVaults(connection);
const bestVault = await selectBestVault(chatModel, allVaults);

const result = await depositToVault(
  connection, 
  wallet, 
  bestVault.address, 
  0.5 // Amount
);
```

---

## The "Money Glitch" Autonomous Loop

A unique recursive loop orchestrated by the Terminal UI (`app.js`) and back-end integration.

**Process Flow:**
1. **Trigger**: `app.js` calls `setInterval` to trigger the `executeGlitchChain()`.
2. **Sequential Steps**:
    - **Step 1**: `/api/chat` (Stake command) -> Backend stakes with Marinade.
    - **Step 2**: `/api/chat` (Trade command) -> Backend performs a swap via Orca.
    - **Step 3**: `/api/chat` (Liquidity command) -> Backend deposits into Meteora.
3. **Safety Engine**: Every single execution passes through `core/spendLimits.ts`.

### Kill Switch
An emergency stop UI component (`STOP_GLITCH`) visually toggles in the header when the Money Glitch activates. Pressing it calls `clearInterval` and stops sequential requests immediately.

---

## Safety & Spend Limits (`spendLimits`)

**CRITICAL**: Every financial module MUST import and call `checkSpendLimits()`.

```typescript
import { checkSpendLimits, recordSpend } from '@core/spendLimits';

const limitCheck = checkSpendLimits(solAmount);
if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason);
}

// Proceed with tx
const sig = await someDeFiAction();

// Record spend after success
recordSpend(solAmount); 
```

---

## Error Handling Best Practices

Solana token accounts can cause noisy logs. Agent Wallet expects missing ATAs for brand new wallets.

```typescript
// Example: Silencing TokenAccountNotFoundError
try {
  // Fetch mSOL or devUSDC
} catch (error: any) {
  if (error.name === 'TokenAccountNotFoundError') {
    return 0; // Completely normal for un-funded wallets
  }
  throw error;
}
```

---

## Skill Structure

This skill directory provides deeper context for specific agent workflows:

```text
agent-wallet/
├── SKILL.md                        # This file (System Overview)
├── resources/
│   ├── ai-tools.md               # Groq LLM prompts & intent parser
│   ├── spend-limits.md           # Security parameters & enforcement
│   ├── meteora-liquidity.md      # Meteora DLMM single-sided liquidity
│   ├── orca-trading.md           # Orca Whirlpool trading loop setup
│   ├── marinade-staking.md       # Marinade mSOL staking integration
│   ├── kamino-yield.md           # Kamino vault selection & deposits
│   └── transactions-signing.md  # SOL sends, token balances, airdrop
├── examples/
│   └── money-glitch.md           # The autonomous loop logic in detail
└── docs/
    ├── terminal-ui.md            # Backend-driven terminal setup
    └── state-management.md       # Express AppState design
```
