# AI Prompting & Intent Engine

The `AgentChat` class powers the natural language interaction of the Wallet, analyzing commands in `ChatController.ts` and deciding trading directions in `agentTools.ts`.

### Core Functions (`src/features/agentTools.ts`)

- **`getAISolAmount(agent, poolName, solBal)`**: Liquidity Sizer.
  - Passes maximum permissible thresholds (e.g., `0.3 * solBal`, up to `2.0 SOL`).
  - Instructs the AI not to select exactly `2.0` unless necessary.

- **`getStakingAmount(agent, solBal)`**: Marinade Action.
  - Ensures a buffer is kept (gas/base transactions). Max allowed is calculated.

- **`getAIDepositAmount(agent, vaultSym, solBal)`**: Yield Action.
  - Prompt structure defines typical deposits between `0.1 and 1 SOL`.

- **`getAITradingDecision(agent, price, avgPrice, ...)`**: Orca Trading logic.
  - Receives market data context: Change percentages, recent average, and current balances across the tradable pair.
  - **Output Requirements**: The prompt explicitly commands: "Respond with EXACTLY one word: buy, sell, or hold."

### The Chat Controller Intent Parser
`src/controllers/ChatController.ts` takes raw string commands and maps them to a specific system action:

- **"Earn/Yield"**: Fetches Kamino `topVaults()`.
- **"Liquidity/Pool"**: Returns `getPoolsForDisplay()`.
- **"Money Glitch"**: Sends standard recursive loop response and reveals the Kill Switch.
- **"Stake"**: Suggests a Marinade interaction.

### System Configuration
- **Model**: Requires an active Groq API Key (`GROQ_API_KEY`).
- Typically powered by high-speed inference endpoints like `llama3-` or `mixtral-`.
