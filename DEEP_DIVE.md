# Agent Wallet: A Complete Deep Dive
### Wallet Design · Security · AI Agent Architecture · Multi-Agent Scalability

> **Who this is for:** Anyone who wants to truly understand how this project works — engineers, collaborators, or myself six months from now. Written in plain English, no blockchain PhD required.

---

## Table of Contents

1. [What Is Agent Wallet?](#1-what-is-agent-wallet)
2. [The Big Picture Architecture](#2-the-big-picture-architecture)
3. [Wallet Design: How Keys Are Created and Stored](#3-wallet-design-how-keys-are-created-and-stored)
4. [Security Deep Dive](#4-security-deep-dive)
5. [How the AI Agent Brain Works](#5-how-the-ai-agent-brain-works)
6. [The DeFi Features: What the Agent Can Do](#6-the-defi-features-what-the-agent-can-do)
7. [The Money Glitch: Autonomous Loop](#7-the-money-glitch-autonomous-loop)
8. [Recurring Transfers](#8-recurring-transfers)
9. [Multi-Agent Scalability](#9-multi-agent-scalability)
10. [The Frontend Terminal UI](#10-the-frontend-terminal-ui)
11. [The Full Request Lifecycle](#11-the-full-request-lifecycle)
12. [File Structure Explained](#12-file-structure-explained)
13. [Known Limitations and Future Work](#13-known-limitations-and-future-work)

---

## 1. What Is Agent Wallet?

Agent Wallet is an **AI-controlled cryptocurrency wallet** running on the Solana blockchain. Instead of a human clicking buttons to manage money, an AI agent reads your plain-English instructions, reasons about them, and executes DeFi (Decentralised Finance) operations on your behalf.

Think of it like hiring a very fast financial assistant who:
- Never sleeps
- Can manage multiple independent accounts
- Explains every decision it makes
- Has strict spending limits hardcoded in so it can never run away with your money

The wallet currently operates on **Solana Devnet** — a test environment where the SOL tokens have no real-world value. This makes it safe to experiment with autonomous AI behaviour before risking real funds.

---

## 2. The Big Picture Architecture

Here is the entire system as a flow diagram in plain English:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                              │
│                   Cyberpunk Terminal UI (app.js)                     │
└───────────────────────┬─────────────────────────────────────────────┘
                        │  HTTP requests (fetch API)
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express.js Server (server.ts)                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Agent Registry                            │   │
│  │  Maps agent IDs → isolated AppState objects                 │   │
│  │  (each agent has its own wallet, chat model, trader)        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Routes: /api/* (default agent) · /api/agents/:id/* (any agent)    │
└───────┬──────────────────────┬──────────────────────────────────────┘
        │                      │
        ▼                      ▼
┌──────────────┐     ┌──────────────────────────────────────────────┐
│  Controllers │     │              Core Modules                     │
│              │     │                                               │
│  Wallet      │     │  wallet.ts      — AES-256-GCM key storage    │
│  Staking     │     │  spendLimits.ts — per-agent daily limits     │
│  Trading     │     │  recurring.ts   — scheduled transfers        │
│  Liquidity   │     │  transaction.ts — SOL send / balance reads   │
│  Earn        │     │  airdrop.ts     — devnet faucet requests     │
│  Chat        │     │  agentRegistry.ts — agent factory/pool       │
└──────┬───────┘     └──────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────────┐
│               AI Decision Layer (Groq LLM via HTTPS)               │
│  AgentChat.chat(prompt) → "BUY" / "0.5" / "APPROVE: 2" etc.       │
└────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────────┐
│                      Solana Blockchain (Devnet)                     │
│  @solana/web3.js · Marinade SDK · Orca SDK · Meteora SDK · Solend  │
└────────────────────────────────────────────────────────────────────┘
```

The key insight is that **the AI is the decision-maker, not the orchestrator**. The code tells the AI: "here is the situation, what should I do?" The AI answers. The code then executes that answer. The AI never touches the wallet directly — it only returns words, and those words are converted into blockchain transactions by human-written code.

---

## 3. Wallet Design: How Keys Are Created and Stored

### 3.1 What Is a Wallet Key?

In blockchain terms, a wallet is simply a pair of numbers:
- **Public Key**: Like your bank account number — share it freely so people can send you money
- **Secret Key** (Private Key): Like your bank PIN — whoever has this can spend all your money

Your entire financial identity on Solana is this 64-byte secret key. Losing it means losing access forever. Exposing it means someone else can empty your account.

### 3.2 The Current Approach: AES-256-GCM Encryption

The file `backend/src/core/wallet.ts` now uses **AES-256-GCM** — the same military-grade encryption used in HTTPS and password managers.

Here is what happens step-by-step when a wallet is saved:

```
Secret Key (64 bytes of raw data)
          │
          ▼
  Random IV generated (16 bytes)       ← Different every time = no patterns
          │
          ▼
  AES-256-GCM Cipher                   ← Uses your WALLET_ENCRYPTION_KEY
  (encrypt + produce Auth Tag)         ← Auth Tag proves data wasn't tampered
          │
          ▼
  Saved to disk as JSON:
  {
    "iv": "a4f2...hex",
    "encryptedData": "8b3c...hex",
    "authTag": "ff12...hex"
  }
```

The **IV (Initialization Vector)** is a random number that is generated fresh each time the wallet is saved. This means even if you save the same key twice, the encrypted output looks completely different each time — making pattern analysis attacks impossible.

The **Auth Tag** is a cryptographic signature over the encrypted data. If anyone modifies even one byte of the encrypted file on disk, decryption will fail with an error. This protects against "bit-flipping" attacks where an attacker manipulates encrypted data without knowing the key.

### 3.4 Per-Agent Named Wallets

Each agent now gets its **own isolated wallet file**:

```
backend/
└── wallets/
    ├── default.encrypted.json     ← The original single agent
    ├── alpha.encrypted.json       ← Agent "alpha"
    ├── beta.encrypted.json        ← Agent "beta"
    └── trader_bot_1.encrypted.json
```

The agent ID is sanitized with a regex (`/[^a-zA-Z0-9_-]/g`) before being used as a filename. This prevents a classic attack called **Directory Traversal** where a malicious user might try to pass `../../../etc/passwd` as an agent ID to read system files.

---

## 4. Security Deep Dive

Security in this codebase works on multiple layers, like an onion. Even if one layer is breached, the next one limits the damage.

### Layer 1: Encrypted Key Storage

As described above — even with full filesystem access, an attacker cannot recover the key without `WALLET_ENCRYPTION_KEY`.

### Layer 2: Environment Variable Gating

The `WALLET_ENCRYPTION_KEY` is never in the codebase — it lives in a `.env` file that is listed in `.gitignore` and never committed to Git. Even if all your source code was public on GitHub, your key would be safe.

**Production guard added**: If `NODE_ENV=production` and no `WALLET_ENCRYPTION_KEY` is set, the server refuses to start — it throws an error rather than silently falling back to the insecure dev key.

```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('WALLET_ENCRYPTION_KEY is required in production.');
}
```

### Layer 3: Spend Limits (`core/spendLimits.ts`)

This is the most important safety mechanism for an **autonomous agent** specifically. An AI that can spend money freely is dangerous. This module hard-caps every agent's spending:

| Limit | Value | What it prevents |
|-------|-------|-----------------|
| Max per transaction | 2.0 SOL | AI can't send your whole balance in one go |
| Max per day | 10.0 SOL | Runaway loop can't drain the wallet overnight |

Every financial operation — staking, trading, liquidity, sending — calls `checkSpendLimits()` before executing. If the limit is exceeded, the transaction is rejected with an error message. After a successful transaction, `recordSpend()` updates the daily tally.

After the multi-agent refactor, each agent has **its own isolated tally file** at `data/spend_limits_{agentId}.json`. Agent Alpha's spending does not eat into Agent Beta's daily budget.

### Layer 4: AI as Gatekeeper (Not Executor)

The AI is positioned as an advisor, not an actor. Consider the airdrop flow:

```
User:  "Give me an airdrop"
Code:  "Hey AI — user at address X has 0.02 SOL.
        Should we airdrop? If yes, how much?"
AI:    "APPROVE: 2"
Code:  Requests 2 SOL from the faucet
Code:  Sends result back to user
```

The AI's text output is parsed with a regex and validated. If the AI hallucinated something weird like `"APPROVE: 999999"`, the code would cap it to the spend limit maximum. **The AI cannot bypass the spend limits.**

### Layer 5: Input Validation

The Express routes validate all incoming request bodies. If a recipient address is malformed or an amount is negative/not-a-number, the request is rejected before the blockchain is ever touched. This protects against bot attacks and malformed clients.

### Layer 6: Error Stack Trace Hiding

The `errorHandler` middleware only sends the full error stack trace in `development` mode. In production, users only see a generic "Internal Server Error" — preventing internal implementation details from being leaked to attackers.

---

## 5. How the AI Agent Brain Works

### 5.1 The `AgentChat` Service (`services/chat.ts`)

The AI brain is a single class that wraps the **Groq API** — a fast LLM inference service. Every AI decision in the system goes through:

```typescript
const chat = new AgentChat(apiKey);
const response = await chat.chat("Your question here");
// response is a raw string from the AI
```

The model behind this is a large language model, openai/gpt-oss-20b but accessed programmatically. For development testing, It has no memory — every call is stateless. This is important: the AI does not "remember" previous trades. Each decision is made fresh based purely on the data provided in the prompt.

### 5.2 How Prompts Are Engineered

The codebase uses a technique called **structured prompting** to get reliable, parseable answers from the AI. Every prompt follows the same pattern:

```
1. Give the AI a role:        "You are a crypto trading AI agent."
2. Give it specific data:     "Current SOL Price: $185.20, Your balance: 2.3 SOL"
3. Give it a rule set:        "BUY when price is below average, SELL when above"
4. Give it an output format:  "Respond with ONLY one word: BUY, SELL, or HOLD"
```

By restricting the output format, the AI's free-form language response becomes a simple machine-readable signal:

```typescript
const decision = response.toUpperCase().trim();
if (decision.includes('BUY')) return 'buy';
if (decision.includes('SELL')) return 'sell';
return 'hold'; // default if AI is uncertain
```

### 5.3 AI Decision Points in the Codebase

| Function | Where | What the AI decides |
|----------|-------|---------------------|
| `getAITradingDecision()` | `agentTools.ts` | BUY / SELL / HOLD based on price action |
| `getAISolAmount()` | `agentTools.ts` | How many SOL to deposit into a liquidity pool |
| `getStakingAmount()` | `agentTools.ts` | How many SOL to stake with Marinade |
| `getAIDepositAmount()` | `agentTools.ts` | How many SOL to lend on Solend |
| `selectBestPool()` | `agentTools.ts` | Which pool (out of 35) is best for liquidity |
| `selectBestVault()` | `earn.ts` | Which Solend reserve has best APY vs. balance |
| `requestAirdrop()` | `WalletController.ts` | Whether to approve a user's airdrop request |
| `airdropOnNewWallet()` | `agentTools.ts` | Whether a brand-new wallet needs a bootstrap airdrop |

### 5.4 The `ChatController`: Natural Language → Action

The `ChatController` is the bridge between user chat messages and structured actions. It does simple keyword matching, then decides what to do:

```
"stake SOL"     → ask AI for amount → return UI action: { type: 'action', action: 'stake', amount: 1.2 }
"check balance" → fetch balances    → return UI message: { type: 'info', message: "SOL: 1.23..." }
"money glitch"  → return the builder modal trigger
"anything else" → pass to AI as raw chat → return AI's freeform response
```

This design means the AI is only consulted for DeFi sizing decisions and freeform fallback chat. The routing logic itself is handled by deterministic code.

---

## 6. The DeFi Features: What the Agent Can Do

### 6.1 Liquid Staking with Marinade (`features/staking.ts`)

**Plain English:** You give the agent SOL. It deposits it into [Marinade Finance](https://marinade.finance/), which spreads it across hundreds of Solana validators (computers that run the network) and pays you a yield (~7% APY). In exchange, you receive **mSOL** — a token that represents your staked SOL and grows in value over time.

**The AI's role:** Determines the amount to stake based on your balance and the spend limit.

**Flow:**
```
Get balance → Ask AI "how much to stake?" → Stake via Marinade SDK → Receive mSOL → Return tx signature
```

### 6.2 Orca Trading (`features/trading.ts`)

**Plain English:** The `SolanaTrader` class runs on a 30-second timer. Every 30 seconds, it checks the live SOL/USDC price on [Orca Whirlpools](https://www.orca.so/) — a decentralised exchange. It feeds the price data to the AI and asks BUY/SELL/HOLD. Then it swaps tokens accordingly.

**The AI's role:** Decides whether to buy SOL (using devUSDC), sell SOL (receiving devUSDC), or hold.

**Flow:**
```
Get price from Orca → Calculate price change % → AI decides BUY/SELL/HOLD → Execute swap → Log decision
```

### 6.3 Meteora Liquidity Provision (`features/liquidity.ts`)

**Plain English:** Instead of just holding SOL, the agent can become a **liquidity provider** on [Meteora](https://app.meteora.ag/). It deposits SOL into trading pools so that other traders can swap tokens. In return, it earns a percentage of every trade that uses that pool (trading fees). This is like renting out your money as working capital.

**The AI's role:** Selects the best pool out of 35 available pools (highest volume, highest liquidity, lowest fees) and decides the deposit size.

### 6.4 Solend Yield Earning (`features/earn.ts`)

**Plain English:** [Solend](https://solend.fi/) is a decentralised bank. You deposit assets (SOL, USDC) and Solend lends them to borrowers. Borrowers pay interest, which you receive as yield. The agent selects the highest-APY reserve where you actually have enough tokens to deposit.

**The AI's role:** Chooses between SOL, USDC, and USDT reserves based on APY and your actual token balances. If you don't have USDC, it won't recommend the USDC reserve.

---

## 7. The Money Glitch: Autonomous Loop

The "Money Glitch" is the most dramatic feature — a recursive autonomous loop that chains DeFi actions together indefinitely.

### How It Works

1. The user opens the **Chain Builder modal** in the terminal UI
2. They drag and drop DeFi "modules" into a sequence (e.g., Stake → Trade → Liquidity)
3. They click **EXEC_LOOP**
4. Every 30 seconds, the frontend sends the next action command to `/api/chat`
5. The AI processes the command, the backend executes it
6. The cycle repeats until the user presses **STOP_GLITCH**

### The Kill Switch

Because an autonomous loop spending real money is dangerous, a large red **STOP_GLITCH** button appears in the header when the loop starts. Pressing it calls `clearInterval()` on the frontend timer — instantly halting all further requests.

### Safety in the Loop

Every individual action within the Money Glitch loop passes through:
- `checkSpendLimits()` — if today's budget is exhausted, actions are refused
- Balance checks — if there's insufficient SOL for an action, it is skipped
- Blockchain confirmation — each transaction must be confirmed before the next one begins

The loop is designed to be loud in its spending and immediate in its emergency stop, rather than silently autonomous.

---

## 8. Recurring Transfers

### How It Works Now

**Creating:** When a user sends SOL and chooses "Daily / Weekly / Monthly", the schedule is saved to `data/recurring_transfers_{agentId}.json` on the server — not the browser.

**Executing:** A background `setInterval` in `server.ts` fires every **60 seconds**. It calls `tickAllAgents()`, which loops over every active agent and checks their scheduled transfers:

```
For each agent:
  For each scheduled transfer:
    Is it due? (nextRunDate <= now)
      YES → checkSpendLimits → sendSol → recordSpend → advance nextRunDate
      NO  → skip
```

**Failure handling:** If a transaction fails (e.g., insufficient balance), the next run date is still advanced. This prevents the same failing transfer from blocking every future run. The error is logged to the console.


---

## 9. Multi-Agent Scalability

### The Agent Registry Solution

The `core/agentRegistry.ts` module is a **factory and pool** for agent states:

```
Registry = {
  "default": { wallet_A, chat_A, trader_A, limits_A },
  "alpha":   { wallet_B, chat_B, trader_B, limits_B },
  "beta":    { wallet_C, chat_C, trader_C, limits_C },
}
```

When a request arrives for `/api/agents/gamma/wallet`, the registry checks if "gamma" exists. If not, it:
1. Generates a new wallet (or loads an existing one from `wallets/gamma.encrypted.json`)
2. Creates a new `AgentChat` instance with its own conversation context
3. Sets up isolated spend limits tracking under `data/spend_limits_gamma.json`
4. Stores the whole bundle as `registry["gamma"]`

All of this is **lazy** — agents are only created on first use, not at boot time. The server can technically support thousands of agents without pre-loading them all.

### Race Condition Prevention

If two HTTP requests arrive simultaneously for a new agent, there's a risk both try to create it simultaneously, potentially generating two different wallets and the second one overwriting the first. The registry handles this with an **initializing set**:

```
Request 1 arrives for "new-agent"
  → adds "new-agent" to initializing set
  → starts loading wallet...

Request 2 arrives for "new-agent" (while Request 1 is still loading)
  → sees "new-agent" in initializing set
  → polls every 50ms until registry has "new-agent"
  → returns the same state Request 1 created
```

This ensures identical agent IDs always resolve to the same wallet, even under concurrent load.

### The API Surface

| Endpoint | Who uses it | Description |
|----------|-------------|-------------|
| `GET /api/wallet` | Existing frontend | Default agent's wallet info |
| `POST /api/chat` | Existing frontend | Default agent's chat |
| `GET /api/agents` | Management tools | List all active + persisted agents |
| `GET /api/agents/alpha/wallet` | External app | Alpha agent's wallet info |
| `POST /api/agents/beta/staking/stake` | External app | Beta agent stakes SOL |
| `POST /api/agents/trader_1/chat` | External app | Trader-1 agent processes a command |

The **existing frontend continues to work unchanged** because all its `/api/*` routes point at the `default` agent. The new multi-agent system is purely additive.

---

## 10. The Frontend Terminal UI

The frontend is a single HTML file (`public/index.html`) and a JavaScript file (`public/app.js`) — no build step, no React, no bundler. It loads directly in the browser.

### Design Philosophy

The UI deliberately wears a "cyberpunk hacker terminal" aesthetic. This is intentional — it reinforces the idea that this is an experimental autonomous system operating at the edges of conventional finance. Key design choices:

- **Share Tech Mono** font (monospace, terminal-like)
- Neon green, cyan, and pink color palette on a near-black background
- **Scanlines CSS effect** (the subtle flickering lines overlay) using `::after` pseudo-elements
- **Glitch text animation** on the header — the "M0N3Y_GL1TCH" title visually glitches using CSS `clip-path` animations
- All UI labels are intentionally obfuscated (e.g., `SCAN_BAL` instead of "Check Balance", `EXEC_LOOP` instead of "Start")

### The Chat Interface

The chat works by:
1. User types a message and hits Enter (or clicks EXEC)
2. `sendMessage()` POSTs to `/api/chat`
3. Backend returns a structured response object with a `type` field
4. Frontend `handleResponse()` switches on the type:
   - `'info'` → display as bot text message
   - `'action'` → display confirmation buttons or input forms
   - `'message'` → display raw AI freeform text

Action buttons are dynamically generated DOM elements with onclick handlers that call specific frontend functions (e.g., `confirmStake(1.5)`).

---

## 11. The Full Request Lifecycle

Here is the complete path for a user typing **"Stake SOL"** and clicking Proceed:

```
1. User types "Stake SOL" → hits Enter
2. app.js: sendMessage() → POST /api/chat { message: "Stake SOL" }
3. ChatController.chat() → processUserMessage("stake sol")
4. Keyword match: contains "stake" → getStakingAmount(chat, balance)
5. agentTools: prompt AI with balance data
6. Groq API: AI responds "1.5"
7. Back to ChatController: return { type: 'action', action: 'stake', amount: 1.5 }
8. app.js: handleAction({ action: 'stake', amount: 1.5 })
9. UI: shows "I recommend staking 1.5000 SOL. Shall I proceed?" + [Proceed] [Cancel]

--- User clicks Proceed ---

10. app.js: confirmStake(1.5) → POST /api/staking/stake { amount: 1.5 }
11. StakingController.stake()
12. checkSpendLimits(1.5, 'default') → allowed ✅
13. stakeSol(connection, wallet, 1.5) via Marinade SDK
14. Marinade SDK: builds transaction → signs with wallet secret key → broadcasts to Solana
15. Solana network: validates and confirms transaction (~400ms)
16. recordSpend(1.5, 'default') → updates spend_limits_default.json
17. Response: { success: true, signature: "5H4...", message: "Staked 1.5 SOL" }
18. app.js: addBotMessage("✅ Transaction successful!")
19. loadWalletInfo() → refreshes balance display
20. showFollowUpMenu() → shows next action chips
```

The entire cycle takes approximately **1–3 seconds** end-to-end. The longest step is the Solana blockchain confirmation.

---

## 12. File Structure Explained

```
agent-wallet/
├── README.md                          # Quick-start guide
├── DEEP_DIVE.md                       # This document
│
├── skills/                            # AI agent skill documentation
│   ├── SKILL.md                       # System overview for AI context
│   └── resources/
│       ├── ai-tools.md                # LLM prompt patterns
│       ├── spend-limits.md            # Security parameters
│       ├── meteora-liquidity.md       # Meteora integration details
│       ├── orca-trading.md            # Orca Whirlpool setup
│       ├── marinade-staking.md        # Marinade mSOL staking
│       ├── solend.md                  # Solend yield farming
│       ├── transactions-signing.md    # SOL transfer and airdrop
│       └── money-glitch.md            # The autonomous loop
│
└── backend/
    ├── .env                           # Secret keys (NEVER committed)
    ├── .env.example                   # Template for new devs
    ├── package.json                   # Dependencies and scripts
    ├── tsconfig.json                  # TypeScript configuration
    │
    ├── wallets/                       # Encrypted wallet files per agent
    │   ├── default.encrypted.json
    │   └── {agentId}.encrypted.json
    │
    ├── data/                          # Per-agent persistent runtime state
    │   ├── spend_limits_{id}.json     # Daily spend tracking
    │   └── recurring_transfers_{id}.json
    │
    ├── public/                        # Static frontend (served by Express)
    │   ├── index.html                 # Terminal UI structure + styles
    │   └── app.js                     # All frontend logic
    │
    └── src/
        ├── server.ts                  # App entry point, route mounting
        │
        ├── types/
        │   └── index.ts               # AppState interface (agentId, wallet, chat...)
        │
        ├── middleware/
        │   └── index.ts               # Request logger + global error handler
        │
        ├── core/                      # Fundamental infrastructure
        │   ├── wallet.ts              # AES-256-GCM key management
        │   ├── spendLimits.ts         # Per-agent transaction limits
        │   ├── recurring.ts           # Scheduled transfer engine
        │   ├── agentRegistry.ts       # Multi-agent factory and pool
        │   ├── transaction.ts         # SOL balance reads and sends
        │   └── airdrop.ts             # Devnet faucet requests
        │
        ├── services/
        │   └── chat.ts                # Groq LLM client wrapper
        │
        ├── features/                  # DeFi integrations
        │   ├── agentTools.ts          # All AI prompt functions
        │   ├── staking.ts             # Marinade liquid staking
        │   ├── trading.ts             # Orca automated trading
        │   ├── liquidity.ts           # Meteora DLMM pools
        │   └── earn.ts                # Solend yield vaults
        │
        ├── controllers/               # HTTP request handlers
        │   ├── ChatController.ts      # NLP → action routing
        │   ├── WalletController.ts    # Balance, send, airdrop, recurring
        │   ├── StakingController.ts   # Stake / unstake / stats
        │   ├── TradingController.ts   # Start / stop / status
        │   ├── LiquidityController.ts # Pools / provide liquidity
        │   └── EarnController.ts      # Vaults / deposit / stats
        │
        └── routes/                    # Express router factories
            ├── walletRoutes.ts        # /wallet/* endpoints
            ├── stakingRoutes.ts       # /staking/* endpoints
            ├── tradingRoutes.ts       # /trading/* endpoints
            ├── liquidityRoutes.ts     # /liquidity/* endpoints
            ├── earnRoutes.ts          # /earn/* endpoints
            └── chatRoutes.ts          # /chat/* endpoints
```

---

## 13. Known Limitations and Future Work

### Current Limitations

| Area | Issue | Impact |
|------|-------|--------|
| **Devnet only** | All tokens are test tokens with no real value | Cannot use in production without mainnet migration |
| **Single server process** | The Agent Registry is in-memory only — restarting the server clears active agents | All agents are re-loaded from disk on next request, losing in-memory trader state |
| **AI has no memory** | Each LLM call is stateless — the AI doesn't remember its previous trade decisions | Trading decisions are made on instantaneous data, not historical context |
| **No authentication** | Any HTTP client can call any agent's endpoints | Suitable for personal/demo use only — needs API keys for production |
| **Solend on devnet** | Solend devnet has unreliable data (admitted in their own docs) | APY numbers may be wrong; real deposits still work |

### Natural Next Steps

- **Mainnet migration**: Add a `SOLANA_NETWORK` environment variable; swap `devnet` for `mainnet-beta` everywhere
- **API key authentication**: Add a middleware that checks a per-agent API key in request headers
- **Agent persistence**: Store trader state to disk (like `data/trader_state_{id}.json`) so it survives server restarts
- **Conversation memory**: Keep a rolling window of the last N messages in `AgentChat` to give the AI context across requests
- **Webhook notifications**: Send a webhook/email when a recurring transfer executes or fails
- **Per-agent configurable limits**: Allow setting custom `dailySpendLimit` and `maxSpendPerTx` per agent instead of a global default

---

*Document generated: March 2026*  
*Codebase: `agent-wallet/backend` — TypeScript, Express.js, Solana web3.js*
