# Orca Whirlpool Automated Trading

The `SolanaTrader` class manages automated interval-based trading on Orca Whirlpools for the SOL/devUSDC pair.

SDK docs: https://docs.orca.so/developers/sdks/trade  
Orca native USDC airdrop (devnet): https://everlastingsong.github.io/nebula/

---

## Key Constants

```typescript
// From features/trading.ts
const SOL_MINT    = 'So11111111111111111111111111111111111111112';
const DEVUSDC_MINT = 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k';
const WHIRLPOOL_ADDRESS = '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt'; // SOL/devUSDC pool
```

---

## Example: Initialize the Trader

```typescript
// From features/trading.ts
import { setWhirlpoolsConfig, swap, setRpc, setPayerFromBytes } from '@orca-so/whirlpools';

async initialize() {
  await setWhirlpoolsConfig('solanaDevnet');
  await setRpc('https://api.devnet.solana.com');
  await setPayerFromBytes(new Uint8Array(this.wallet.secretKey));
  console.log('✅ Orca Whirlpools initialized');
  await this.updateBalances();
  this.initialBalance = { ...this.balances };
}
```

---

## Example: Full Trading Monitor Loop

The monitor runs as a `while (this.isMonitoring)` loop with a `setTimeout` delay:

```typescript
// From features/trading.ts
async startMonitoring() {
  this.isMonitoring = true;
  console.log('🚀 Starting AI-powered trading...\n');

  while (this.isMonitoring) {
    const currentPrice = await this.recordPrice();
    const avgPrice = this.getAveragePrice();
    const priceChange = currentPrice - (this.priceHistory[this.priceHistory.length - 2]?.price || currentPrice);

    if (this.priceHistory.length < 3) {
      console.log('⏳ Collecting price data... (' + this.priceHistory.length + '/3)');
    } else {
      const priceChangePercent = ((currentPrice - avgPrice) / avgPrice) * 100;

      // Ask AI for decision
      let decision: 'buy' | 'sell' | 'hold' = 'hold';
      if (this.getDecisionCallback) {
        decision = await this.getDecisionCallback(
          currentPrice,
          avgPrice,
          priceChangePercent,
          this.balances.sol,
          this.balances.devUsdc,
          this.totalProfit,
          this.priceHistory.length
        );
      }
      console.log(`🎯 AI Decision: ${decision.toUpperCase()}`);

      if (decision === 'buy' && this.balances.devUsdc > 0) {
        await this.executeBuy();
      } else if (decision === 'sell' && this.balances.sol > 0) {
        await this.executeSell();
      }

      await this.updateBalances();
    }

    // Wait for next check cycle (default 30s)
    await new Promise((resolve) => setTimeout(resolve, this.config.checkInterval));
  }
}
```

---

## Example: Execute a BUY (devUSDC → SOL)

```typescript
// From features/trading.ts
private async executeBuy() {
  const inputAmount = BigInt(Math.floor(this.config.maxTradeAmount * 1e6)); // devUSDC = 6 decimals

  const { quote, callback: sendTx } = await swap(
    { inputAmount, mint: address(DEVUSDC_MINT) },
    address(WHIRLPOOL_ADDRESS),
    100 // slippage bps
  );

  const txId = await sendTx();
  const solOut = Number(quote.tokenEstOut) / 1e9;

  this.balances.devUsdc -= this.config.maxTradeAmount;
  this.balances.sol += solOut;

  console.log('✅ Buy executed:', txId);
  console.log(`   Bought: ${solOut.toFixed(4)} SOL`);
}
```

---

## Example: Execute a SELL (SOL → devUSDC)

```typescript
// From features/trading.ts
private async executeSell() {
  // Spend limit check before every sell
  const limitCheck = checkSpendLimits(this.config.maxTradeAmount);
  if (!limitCheck.allowed) {
    console.warn(`⚠️ Blocked sell trade: ${limitCheck.reason}`);
    return;
  }

  const inputAmount = BigInt(Math.floor(this.config.maxTradeAmount * 1e9)); // SOL = 9 decimals

  const { quote, callback: sendTx } = await swap(
    { inputAmount, mint: address(SOL_MINT) },
    address(WHIRLPOOL_ADDRESS),
    100
  );

  const txId = await sendTx();
  recordSpend(this.config.maxTradeAmount); // Record after success
  const usdcOut = Number(quote.tokenEstOut) / 1e6;

  this.balances.sol -= this.config.maxTradeAmount;
  this.balances.devUsdc += usdcOut;
  this.totalProfit += usdcOut - this.config.maxTradeAmount;

  console.log('✅ Sell executed:', txId);
}
```

---

## AI Trading Decision Prompt

```typescript
// From features/agentTools.ts
export async function getAITradingDecision(
  agent: AgentChat,
  currentPrice: number,
  avgPrice: number,
  priceChangePercent: number,
  solBalance: number,
  devUsdcBalance: number,
  totalProfit: number,
  historyLength: number
): Promise<'buy' | 'sell' | 'hold'> {
  const prompt = `You are a crypto trading AI agent. Analyze this data and decide whether to BUY SOL, SELL SOL, or HOLD.

Current SOL Price: $${currentPrice.toFixed(2)}
Average Price (last ${historyLength} readings): $${avgPrice.toFixed(2)}
Price Change: ${priceChangePercent.toFixed(2)}%
Current SOL Balance: ${solBalance.toFixed(4)} SOL
Current devUSDC Balance: ${devUsdcBalance.toFixed(2)} devUSDC
Total Profit/Loss: $${totalProfit.toFixed(2)}

Trading Rules:
- BUY when price is significantly below average (good entry point)
- SELL when price is significantly above average (take profits)
- HOLD when price is stable or uncertain
- Consider your current balances before trading

Respond with ONLY one word: BUY, SELL, or HOLD`;

  const response = await agent.chat(prompt);
  const decision = response.toUpperCase().trim();

  if (decision.includes('BUY')) return 'buy';
  if (decision.includes('SELL')) return 'sell';
  return 'hold';
}
```

---

## Instantiate from Server (TradingController)

```typescript
// From controllers/TradingController.ts (how server.ts creates the trader)
this.state.trader = new SolanaTrader(
  this.state.connection,
  this.state.wallet,
  { checkInterval: 30000, maxTradeAmount: 0.1 },
  async (currentPrice, avgPrice, priceChangePercent, solBal, usdcBal, profit, histLen) => {
    return await getAITradingDecision(
      this.state.chat, currentPrice, avgPrice, priceChangePercent,
      solBal, usdcBal, profit, histLen
    );
  }
);
await this.state.trader.initialize();
this.state.trader.startMonitoring().catch(console.error);
```
