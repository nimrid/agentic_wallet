import { setWhirlpoolsConfig, swap, setRpc, setPayerFromBytes } from '@orca-so/whirlpools';
import { address } from '@solana/kit';
import { Keypair, Connection } from '@solana/web3.js';
import { checkSpendLimits, recordSpend } from '@core/spendLimits';


// Token mints
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const DEVUSDC_MINT = 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k'; // Devnet USDC

// Orca Whirlpool: SOL / devUSDC
const WHIRLPOOL_ADDRESS = '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt';

interface PriceData {
  price: number;
  timestamp: number;
}

interface TradingConfig {
  checkInterval: number;
  maxTradeAmount: number;
}

interface TokenBalance {
  sol: number;
  devUsdc: number;
}

interface TradeDecision {
  price: number;
  decision: 'buy' | 'sell' | 'hold';
  timestamp: number;
}

export class SolanaTrader {
  private wallet: Keypair;
  private connection: Connection;
  private getDecisionCallback?: (
    currentPrice: number,
    avgPrice: number,
    priceChangePercent: number,
    solBalance: number,
    devUsdcBalance: number,
    totalProfit: number,
    historyLength: number
  ) => Promise<'buy' | 'sell' | 'hold'>;
  private priceHistory: PriceData[] = [];
  private tradeDecisions: TradeDecision[] = [];
  private config: TradingConfig;
  private isMonitoring = false;
  private balances: TokenBalance = { sol: 0, devUsdc: 0 };
  private initialBalance: TokenBalance = { sol: 0, devUsdc: 0 };
  private totalProfit = 0;

  constructor(
    connection: Connection,
    wallet: Keypair,
    config: Partial<TradingConfig> = {},
    getDecisionCallback?: (
      currentPrice: number,
      avgPrice: number,
      priceChangePercent: number,
      solBalance: number,
      devUsdcBalance: number,
      totalProfit: number,
      historyLength: number
    ) => Promise<'buy' | 'sell' | 'hold'>
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.getDecisionCallback = getDecisionCallback;
    this.config = {
      checkInterval: 60000,
      maxTradeAmount: 0.1,
      ...config,
    };
  }

  async initialize() {
    try {
      await setWhirlpoolsConfig('solanaDevnet');
      await setRpc('https://api.devnet.solana.com');
      await setPayerFromBytes(new Uint8Array(this.wallet.secretKey));
      console.log('✅ Orca Whirlpools initialized');

      // Initialize balances
      await this.updateBalances();
      this.initialBalance = { ...this.balances };
    } catch (error) {
      console.error('Failed to initialize Whirlpools:', error);
      throw error;
    }
  }

  async updateBalances() {
    try {
      // Get SOL balance
      const solBalance = await this.connection.getBalance(this.wallet.publicKey);
      this.balances.sol = solBalance / 1e9;

      console.log(`💰 Current SOL: ${this.balances.sol.toFixed(4)}`);
      console.log(`💵 Current devUSDC: ${this.balances.devUsdc.toFixed(2)}`);
    } catch (error) {
      console.error('Error updating balances:', error);
    }
  }

  async getRealSolPrice(): Promise<number> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = await response.json() as { solana: { usd: number } };
      return data.solana.usd;
    } catch (error) {
      console.error('Error fetching real SOL price:', error);
      return this.getCurrentPoolPrice();
    }
  }

  private async getCurrentPoolPrice(): Promise<number> {
    try {
      const inputAmount = 1_000_000n; // 1 devUSDC (6 decimals)

      const { quote } = await swap(
        { inputAmount, mint: address(DEVUSDC_MINT) },
        address(WHIRLPOOL_ADDRESS),
        100
      );

      const outputAmount = Number(quote.tokenEstOut) / 1e9;
      return outputAmount / 1;
    } catch (error) {
      console.error('Error fetching pool price:', error);
      throw error;
    }
  }

  async getCurrentPrice(): Promise<number> {
    return this.getRealSolPrice();
  }

  getAveragePrice(): number {
    if (this.priceHistory.length === 0) return 0;
    const sum = this.priceHistory.reduce((acc, p) => acc + p.price, 0);
    return sum / this.priceHistory.length;
  }

  async recordPrice() {
    const price = await this.getCurrentPrice();
    this.priceHistory.push({
      price,
      timestamp: Date.now(),
    });

    if (this.priceHistory.length > 100) {
      this.priceHistory.shift();
    }

    return price;
  }



  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting AI-powered trading...\n');

    while (this.isMonitoring) {
      try {
        const currentPrice = await this.recordPrice();
        const avgPrice = this.getAveragePrice();
        const priceChange = currentPrice - (this.priceHistory[this.priceHistory.length - 2]?.price || currentPrice);

        console.log(`\n📊 SOL/USD Price: $${currentPrice.toFixed(2)}`);
        console.log(`📈 Average Price: $${avgPrice.toFixed(2)}`);
        console.log(`📉 Price Change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}`);

        if (this.priceHistory.length < 3) {
          console.log('⏳ Collecting price data... (' + this.priceHistory.length + '/3)');
        } else {
          // Get AI decision
          console.log('\n🤖 AI Agent analyzing...');
          const priceChangePercent = ((currentPrice - avgPrice) / avgPrice) * 100;
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
          } else {
            // Basic fallback strategy if no AI callback provided
            if (priceChangePercent < -5) decision = 'buy';
            else if (priceChangePercent > 5) decision = 'sell';
          }
          console.log(`🎯 AI Decision: ${decision.toUpperCase()}`);

          // Record decision
          this.tradeDecisions.push({
            price: currentPrice,
            decision,
            timestamp: Date.now()
          });

          if (decision === 'buy' && this.balances.devUsdc > 0) {
            await this.executeBuy();
          } else if (decision === 'sell' && this.balances.sol > 0) {
            await this.executeSell();
          } else {
            console.log('⏸️ Holding position');
          }

          await this.updateBalances();
        }

        await new Promise((resolve) =>
          setTimeout(resolve, this.config.checkInterval)
        );
      } catch (error) {
        console.error('Error during monitoring:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async executeBuy() {
    try {
      console.log(`\n💰 AI Decision: BUYING SOL with ${this.config.maxTradeAmount} devUSDC...`);

      const inputAmount = BigInt(Math.floor(this.config.maxTradeAmount * 1e6));

      const { quote, callback: sendTx } = await swap(
        { inputAmount, mint: address(DEVUSDC_MINT) },
        address(WHIRLPOOL_ADDRESS),
        100
      );

      const txId = await sendTx();
      const solOut = Number(quote.tokenEstOut) / 1e9;

      this.balances.devUsdc -= this.config.maxTradeAmount;
      this.balances.sol += solOut;

      console.log('✅ Buy executed:', txId);
      console.log(`   Bought: ${solOut.toFixed(4)} SOL`);
      console.log(`   Spent: ${this.config.maxTradeAmount} devUSDC`);
      console.log(`\n📊 Updated Balances:`);
      console.log(`   SOL: ${this.balances.sol.toFixed(4)}`);
      console.log(`   devUSDC: ${this.balances.devUsdc.toFixed(2)}`);
    } catch (error) {
      console.error('❌ Buy failed:', error instanceof Error ? error.message : error);
    }
  }

  private async executeSell() {
    try {
      console.log(`\n💸 AI Decision: SELLING SOL for devUSDC...`);

      const limitCheck = checkSpendLimits(this.config.maxTradeAmount);
      if (!limitCheck.allowed) {
        console.warn(`⚠️ Blocked sell trade: ${limitCheck.reason}`);
        return;
      }

      const inputAmount = BigInt(Math.floor(this.config.maxTradeAmount * 1e9));

      const { quote, callback: sendTx } = await swap(
        { inputAmount, mint: address(SOL_MINT) },
        address(WHIRLPOOL_ADDRESS),
        100
      );

      const txId = await sendTx();
      recordSpend(this.config.maxTradeAmount);
      const usdcOut = Number(quote.tokenEstOut) / 1e6;

      this.balances.sol -= this.config.maxTradeAmount;
      this.balances.devUsdc += usdcOut;
      this.totalProfit += usdcOut - this.config.maxTradeAmount;

      console.log('✅ Sell executed:', txId);
      console.log(`   Sold: ${this.config.maxTradeAmount} SOL`);
      console.log(`   Received: ${usdcOut.toFixed(2)} devUSDC`);
      console.log(`\n📊 Updated Balances:`);
      console.log(`   SOL: ${this.balances.sol.toFixed(4)}`);
      console.log(`   devUSDC: ${this.balances.devUsdc.toFixed(2)}`);
      console.log(`   Total Profit: $${this.totalProfit.toFixed(2)}`);
    } catch (error) {
      console.error('❌ Sell failed:', error instanceof Error ? error.message : error);
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('\n⏹️ Stopped monitoring');
    console.log(`\n📈 Final Report:`);
    console.log(`   Initial SOL: ${this.initialBalance.sol.toFixed(4)}`);
    console.log(`   Current SOL: ${this.balances.sol.toFixed(4)}`);
    console.log(`   Initial devUSDC: ${this.initialBalance.devUsdc.toFixed(2)}`);
    console.log(`   Current devUSDC: ${this.balances.devUsdc.toFixed(2)}`);
    console.log(`   Total Profit/Loss: $${this.totalProfit.toFixed(2)}`);
  }

  getPriceHistory() {
    return this.priceHistory;
  }

  getTradeDecisions() {
    return this.tradeDecisions;
  }
}
