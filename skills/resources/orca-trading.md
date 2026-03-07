# Orca Whirlpool Automated Trading

The `SolanaTrader` class manages automated interval-based trading on Orca Whirlpools for the SOL/USDC pair.

### Core Architecture

- **`SolanaTrader.ts`**: The trader class initializes a background monitoring loop (`startMonitoring`). It checks prices, pulls balances, calculates profit/loss, and consults the AI for decisions.
- **Interval Setup**: Controlled via `TradingConfig`. Currently set to check prices every 30 seconds (`checkInterval: 30000`).
- **Trades Allowed**: Only market buys and sells of sizes up to `maxTradeAmount` (0.1 units).

### Trading Loop Sequence
1. The monitor wakes up (`startMonitoring()`).
2. Fetches current price data from the Orca Whirlpool.
3. Compares it against the last 20 recorded prices to find `averagePrice` and `priceChangePercent`.
4. Gathers current wallet balances (`SOL` and `devUSDC`).
5. AI is queried with `tradeDecisionCallback(currentPrice, avgPrice, ...)` which calls `getAITradingDecision()` in `agentTools.ts`.
6. AI responds with `"buy"`, `"sell"`, or `"hold"`.
7. `executeBuy()` or `executeSell()` is triggered.
8. `spendLimits` module is enforced before the transaction is fired.

### Example Instantiation

```typescript
import { SolanaTrader } from '@features/trading';

const trader = new SolanaTrader(
  connection,
  wallet,
  { checkInterval: 30000, maxTradeAmount: 0.1 },
  async (currentPrice, avgPrice, priceChangePercent, solBal, usdcBal, profit, histLen) => {
    return await getAITradingDecision(/* args */);
  }
);

await trader.initialize();
trader.startMonitoring();
// trader.stopMonitoring();
```
