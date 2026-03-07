# 🤖 Money Glitch: Solana Agent Wallet

An **AI-powered, autonomous DeFi terminal** for the Solana blockchain. The agent wallet makes real-time financial decisions using Groq's LLM, executing trades, staking, liquidity provision, and yield farming — all from a slick cyberpunk terminal UI running directly from the backend.

> **⚠️ DEVNET ONLY** — This project runs on Solana Devnet. Never use real funds without a complete review and audit of the spend limit configuration.

---

## ✨ Features

| Feature | Protocol | Description |
|---------|----------|-------------|
| 🤖 **AI Intent Parsing** | Groq (Llama 3) | Natural language command processing |
| 📈 **Autonomous Trading** | Orca Whirlpools | AI-advised SOL/devUSDC swap loop (30s intervals) |
| 💧 **Liquidity Provision** | Meteora DLMM | Single-sided SOL deposits into top pools |
| 🥩 **Liquid Staking** | Marinade Finance | AI-sized SOL → mSOL autonomous staking |
| 🏦 **Yield Farming** | Kamino Finance | AI vault selection for lending/earning yields |
| 🔄 **Money Glitch Mode** | All Protocols | Recursive autonomous loop chaining every DeFi action |
| 🛑 **Kill Switch** | Browser UI | One-click emergency stop for the autonomous loop |
| 🔒 **Spend Limits** | Built-in | Hard caps: 2 SOL/tx, 5 SOL/day |

---

## 🛠 Tech Stack

- **Runtime**: Node.js, TypeScript
- **Server**: Express.js
- **UI**: Cyberpunk-themed HTML/CSS/JS terminal (served statically)
- **Blockchain**: `@solana/web3.js`
- **AI Engine**: Groq SDK (`llama3-8b-8192` / `mixtral`)
- **DeFi SDKs**: `@meteora-ag/dlmm`, `@orca-so/whirlpools`, `@marinade.finance/marinade-ts-sdk`, `@kamino-finance/klend-sdk`

---

## 📂 Project Structure

```
agent-wallet/
├── README.md
├── SKILL.md                          # AI agent blueprint for skill discovery
├── skills/                           # Detailed feature documentation
│   ├── SKILL.md
│   ├── resources/                    # Protocol-specific guides
│   │   ├── meteora-liquidity.md
│   │   ├── orca-trading.md
│   │   ├── marinade-staking.md
│   │   ├── kamino-yield.md
│   │   ├── ai-tools.md
│   │   └── spend-limits.md
│   └── examples/
│       └── money-glitch.md
│
└── backend/                          # Everything runs from here
    ├── src/
    │   ├── server.ts                 # Express app entrypoint
    │   ├── core/
    │   │   ├── wallet.ts             # Keypair generation & encrypted storage
    │   │   ├── transaction.ts        # SOL transfers, token balance checks
    │   │   ├── airdrop.ts            # Devnet SOL airdrop
    │   │   └── spendLimits.ts        # 2 SOL/tx + 5 SOL/day safety engine
    │   ├── features/
    │   │   ├── trading.ts            # SolanaTrader (Orca Whirlpools)
    │   │   ├── staking.ts            # Marinade liquid staking
    │   │   ├── liquidity.ts          # Meteora DLMM spot strategy
    │   │   ├── earn.ts               # Kamino vault deposits
    │   │   └── agentTools.ts         # AI sizing & decision functions
    │   ├── services/
    │   │   └── chat.ts               # AgentChat (Groq SDK wrapper)
    │   ├── controllers/              # Express route handlers
    │   └── routes/                   # API route definitions
    └── public/
        ├── index.html                # Cyberpunk terminal UI
        └── app.js                    # Terminal logic + Money Glitch loop
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A **Groq API Key** (free) — [Get one here](https://console.groq.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/agent-wallet.git
cd agent-wallet
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file inside `backend/`:

```bash
cp backend/.env.example backend/.env  # if example exists, or create manually
```

```env
# backend/.env
GROQ_API_KEY=your_groq_api_key_here
WALLET_ENCRYPTION_KEY=any_random_32_char_string_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ Yes | Powers all AI decisions. Get it free at [groq.com](https://console.groq.com) |
| `WALLET_ENCRYPTION_KEY` | ✅ Yes | Encrypts your Solana keypair on disk. Use any strong passphrase. |

> ⚠️ **Never commit your `.env` file.** It is in `.gitignore` by default.

### 4. Start the Terminal

```bash
npm run dev
# 🚀 Server running at http://localhost:3000
```

Open **http://localhost:3000** in your browser. You will be greeted by the Money Glitch terminal.

---

## 💬 Terminal Commands

Once inside the terminal, type natural language commands. Here are the key ones:

| Command | Action |
|---------|--------|
| `check balance` | Displays SOL, mSOL, USDC, and devUSDC balances |
| `request airdrop` | AI agent decides whether to request devnet SOL |
| `stake` | AI calculates a safe amount and stakes with Marinade |
| `unstake` | Unstakes your mSOL position |
| `trade` / `start trading` | Starts the Orca SOL/USDC trading monitor |
| `liquidity` / `pool` | Finds the best Meteora pool and provides liquidity |
| `earn` / `yield` | AI picks the best Kamino vault and deposits |
| `send SOL` | Transfer SOL to another wallet address |
| `money glitch` | 🔥 Activates the autonomous recursive DeFi loop |

---

## 🔒 Safety Architecture

The wallet has two layers of protection against rogue AI decisions:

### 1. On-Chain Spend Limits (`core/spendLimits.ts`)
Every single DeFi transaction is checked **before** it executes:
- **Max per transaction**: `2.0 SOL`
- **Daily max**: `5.0 SOL`

```typescript
// Every controller does this before signing:
const limitCheck = checkSpendLimits(amount);
if (!limitCheck.allowed) return res.status(400).json({ error: limitCheck.reason });
```

### 2. Kill Switch (UI)
When **Money Glitch** mode is active, a `🔴 STOP GLITCH` button appears in the terminal header. Clicking it immediately calls `clearInterval` and halts all pending autonomous requests.

---

## 🔌 API Reference

The backend exposes a REST API for all wallet operations:

### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/wallet` | Get SOL, mSOL, USDC, devUSDC balances |
| `POST` | `/api/send-sol` | Transfer SOL to another address |
| `POST` | `/api/airdrop` | Request devnet SOL airdrop (AI-gated) |

### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/trading/start` | Start Orca trading monitor |
| `POST` | `/api/trading/stop` | Stop the trading loop |
| `GET` | `/api/trading/status` | Get current trading status & P&L |

### Staking
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/staking/stake` | Stake SOL with Marinade |
| `POST` | `/api/staking/unstake` | Unstake mSOL |
| `GET` | `/api/staking/stats` | APY, TVL, mSOL balance |

### Liquidity
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/liquidity/pools` | List available Meteora pools |
| `POST` | `/api/liquidity/provide` | Inject SOL into the best pool |

### Earning
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/earn/reserves` | List available Kamino reserves |
| `POST` | `/api/earn/deposit` | AI-guided deposit into best vault |
| `GET` | `/api/earn/stats` | Overall earning statistics |

### Chat (AI Intent)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send any natural language command to the AI agent |

---

## 🧠 How the AI Works

The AI engine (`AgentChat` using Groq) is embedded at every decision point:

1. **Sizing**: Before any DeFi action, the AI is given the current balance and a maximum allowed amount. It responds with an exact SOL figure.
2. **Trading**: The trader sends current price, average price, price change %, and balances. AI responds with exactly one word: `buy`, `sell`, or `hold`.
3. **Vault Selection**: For Kamino, the AI is given a ranked list of vaults by APY and picks the best-fit one by index.

All AI prompts enforce the **2.0 SOL maximum** at the prompt level, in addition to the hard-coded `spendLimits.ts` check.

---

## 🤝 Contributing

Pull requests welcome! When adding new DeFi integrations:

1. Create a new feature module in `backend/src/features/`
2. Add the AI sizing function in `agentTools.ts`
3. Register routes in `server.ts` 
4. Always call `checkSpendLimits()` before any transaction
5. Document your feature in `skills/resources/` (see existing files as templates)

---

## 📜 License

MIT
