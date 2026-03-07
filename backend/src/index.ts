import { Connection } from '@solana/web3.js';
import { AgentChat } from '@services/chat';
import { loadOrCreateWallet } from '@core/wallet';
import { sendSol, getBalance, getTokenBalance } from '@core/transaction';
import { getAvailablePools, addLiquidity, getUserPositions, closePosition } from '@features/liquidity';
import { stakeSol, unstakeSol, getMSolBalance, getStakingStats } from '@features/staking';
import { getAISolAmount, getStakingAmount, airdropOnNewWallet, getAITradingDecision } from '@features/agentTools';
import { SolanaTrader } from '@features/trading';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// All these here runs on CLI to test our code

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

let trader: SolanaTrader | null = null;

const DEVUSDC_MINT = 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k';

async function main() {
  console.log('\n🤖 Welcome to Agent Wallet!');
  console.log('Your AI-powered Solana wallet assistant\n');

  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Initialize AI chat first
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in environment');
  }

  const chat = new AgentChat(apiKey);

  // Load or create wallet with agent decision on airdrop
  const wallet = await loadOrCreateWallet(async (address) => {
    console.log('🤖 Requesting AI agent decision on initial airdrop...');
    const result = await airdropOnNewWallet(address, chat);
    console.log(`Agent decision: ${result.agentDecision}`);
  });

  console.log('Public Key:', wallet.publicKey.toString());

  // Interactive loop
  while (true) {
    const action = await question(
      'What would you like to do?\n1. Send SOL\n2. Check balance\n3. Add liquidity\n4. View my positions\n5. Start trading (SOL/USDC)\n6. Stop trading\n7. Stake SOL with Marinade\n8. Unstake SOL\n9. View staking stats\n10. Exit\nChoice: '
    );

    if (action === '1') {
      const recipient = await question('Enter recipient address: ');
      const amountStr = await question('How many SOL to send? ');
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        console.log('Invalid amount\n');
        continue;
      }

      // Get current balance
      const currentBalance = await getBalance(connection, wallet.publicKey);

      // Account for transaction fee (approximately 0.000005 SOL)
      const estimatedFee = 0.00001;
      if (amount + estimatedFee > currentBalance) {
        console.log(`Insufficient balance. You need ${amount + estimatedFee} SOL (including ~${estimatedFee} SOL fee)`);
        console.log(`Available: ${currentBalance} SOL\n`);
        continue;
      }

      try {
        console.log('\nSending transaction...');
        const signature = await sendSol(connection, wallet, recipient, amount);
        console.log('✅ Transaction successful!');
        console.log('Signature:', signature);

        const newBalance = await getBalance(connection, wallet.publicKey);
        console.log(`New balance: ${newBalance} SOL\n`);
      } catch (error) {
        console.log('❌ Transaction failed:', error instanceof Error ? error.message : error);
        console.log();
      }
    } else if (action === '2') {
      const currentBalance = await getBalance(connection, wallet.publicKey);
      const currentDevUsdc = await getTokenBalance(connection, wallet.publicKey, DEVUSDC_MINT);
      console.log(`SOL Balance: ${currentBalance} SOL`);
      console.log(`devUSDC Balance: ${currentDevUsdc.toFixed(2)} devUSDC\n`);
    } else if (action === '3') {
      console.log('\n💧 Fetching available pools...');
      const pools = await getAvailablePools(connection);

      if (pools.length === 0) {
        console.log('No pools available\n');
        continue;
      }

      console.log('\nTop 5 pools:');
      pools.slice(0, 5).forEach((pool: any, idx: number) => {
        console.log(`${idx + 1}. ${pool.name} (${pool.address})`);
        console.log(`   Liquidity: ${pool.liquidity}, Volume 24h: ${pool.trade_volume_24h}`);
      });

      const poolChoice = await question('\nEnter pool number (or pool address): ');
      let poolAddress: string;
      let selectedPool: any;

      if (poolChoice.length > 10) {
        poolAddress = poolChoice;
        selectedPool = pools.find((p: any) => p.address === poolChoice);
      } else {
        const idx = parseInt(poolChoice) - 1;
        if (idx < 0 || idx >= 5) {
          console.log('Invalid choice\n');
          continue;
        }
        poolAddress = pools[idx].address;
        selectedPool = pools[idx];
      }

      if (!selectedPool) {
        console.log('Pool not found\n');
        continue;
      }

      try {
        console.log('\n🤖 AI Agent deciding SOL amount...');
        const currentSolBalance = await getBalance(connection, wallet.publicKey);

        const solAmount = await getAISolAmount(chat, selectedPool.name, currentSolBalance);
        console.log(`🎯 AI Decision: Deposit ${solAmount.toFixed(4)} SOL`);

        console.log('\n💧 Adding liquidity...');
        const result = await addLiquidity(connection, wallet, poolAddress, solAmount);
        console.log('✅ Liquidity added successfully!');
        console.log('Transaction:', result.txHash);
        console.log('Position:', result.positionPubKey);
        console.log();
      } catch (error) {
        console.log('❌ Failed to add liquidity:', error instanceof Error ? error.message : error);
        console.log();
      }
    } else if (action === '4') {
      const poolAddress = await question('Enter pool address: ');

      try {
        console.log('\n📊 Fetching your positions...');
        const positions = await getUserPositions(connection, wallet, poolAddress);

        if (positions.length === 0) {
          console.log('No positions found\n');
        } else {
          console.log(`Found ${positions.length} position(s):`);
          positions.forEach((pos: any, idx: number) => {
            console.log(`${idx + 1}. Position: ${pos.publicKey}`);
            console.log(`   Bin Range: ${pos.lowerBinId} to ${pos.upperBinId}`);
            console.log(`   Bins: ${pos.binData.length}`);
          });

          const closeChoice = await question('\nClose a position? (enter position number or 0 to skip): ');
          const posIdx = parseInt(closeChoice) - 1;

          if (posIdx >= 0 && posIdx < positions.length) {
            console.log('\n🔄 Closing position...');
            const txHash = await closePosition(connection, wallet, poolAddress, positions[posIdx].publicKey);
            console.log('✅ Position closed!');
            console.log('Transaction:', txHash);
          }
        }
        console.log();
      } catch (error) {
        console.log('❌ Failed to fetch positions:', error instanceof Error ? error.message : error);
        console.log();
      }
    } else if (action === '5') {
      if (trader) {
        console.log('Trader already initialized\n');
        continue;
      }

      trader = new SolanaTrader(connection, wallet, {
        checkInterval: 30000, // Check every 30 seconds
        maxTradeAmount: 0.1, // 0.1 devUSDC per trade
      }, async (currentPrice, avgPrice, priceChangePercent, solBalance, devUsdcBalance, totalProfit, historyLength) => {
        return await getAITradingDecision(
          chat, currentPrice, avgPrice, priceChangePercent, solBalance, devUsdcBalance, totalProfit, historyLength
        );
      });

      try {
        await trader.initialize();
        console.log('Starting automated trading...\n');
        // Run monitoring in background
        trader.startMonitoring().catch(console.error);
      } catch (error) {
        console.log('❌ Failed to initialize trader:', error instanceof Error ? error.message : error);
        trader = null;
        console.log();
      }
    } else if (action === '6') {
      if (trader) {
        trader.stopMonitoring();
        trader = null;
        console.log('Trading stopped\n');
      } else {
        console.log('No active trader\n');
      }
    } else if (action === '7') {
      try {
        console.log('\n🎯 Staking SOL with Marinade...');
        const currentBalance = await getBalance(connection, wallet.publicKey);

        if (currentBalance < 0.1) {
          console.log('Insufficient balance. You need at least 0.1 SOL to stake\n');
          continue;
        }

        console.log('🤖 AI Agent deciding stake amount...');
        const stakeAmount = await getStakingAmount(chat, currentBalance);
        console.log(`🎯 AI Decision: Stake ${stakeAmount.toFixed(4)} SOL`);

        const result = await stakeSol(connection, wallet, stakeAmount);
        console.log('✅ Staking successful!');
        console.log('Transaction:', result.signature);
        console.log('mSOL Account:', result.mSolTokenAccount);

        const mSolBalance = await getMSolBalance(connection, wallet);
        console.log(`Your mSOL balance: ${mSolBalance.toFixed(4)} mSOL\n`);
      } catch (error) {
        console.log('❌ Staking failed:', error instanceof Error ? error.message : error);
        console.log();
      }
    } else if (action === '8') {
      try {
        console.log('\n🔄 Unstaking SOL from Marinade...');
        const mSolBalance = await getMSolBalance(connection, wallet);

        if (mSolBalance < 0.1) {
          console.log(`Insufficient mSOL balance. You have ${mSolBalance.toFixed(4)} mSOL\n`);
          continue;
        }

        const amountStr = await question(`Your mSOL balance: ${mSolBalance.toFixed(4)}\nHow much mSOL to unstake? `);
        const amount = parseFloat(amountStr);

        if (isNaN(amount) || amount <= 0 || amount > mSolBalance) {
          console.log('Invalid amount\n');
          continue;
        }

        const amountLamports = Math.floor(amount * 1e9);
        const result = await unstakeSol(connection, wallet, amountLamports);
        console.log('✅ Unstaking successful!');
        console.log('Transaction:', result.signature);
        console.log('mSOL Account:', result.mSolTokenAccount);

        const newBalance = await getBalance(connection, wallet.publicKey);
        console.log(`Your new SOL balance: ${newBalance.toFixed(4)} SOL\n`);
      } catch (error) {
        console.log('❌ Unstaking failed:', error instanceof Error ? error.message : error);
        console.log();
      }
    } else if (action === '9') {
      try {
        console.log('\n📊 Fetching Marinade staking stats...');
        const stats = await getStakingStats(connection);
        console.log(`APY: ${(stats.apy * 100).toFixed(2)}%`);
        console.log(`Total Value Locked: ${stats.tvl.toFixed(2)} SOL`);

        const mSolBalance = await getMSolBalance(connection, wallet);
        console.log(`Your mSOL balance: ${mSolBalance.toFixed(4)} mSOL\n`);
      } catch (error) {
        console.log('❌ Failed to fetch stats:', error instanceof Error ? error.message : error);
        console.log();
      }
    } else if (action === '10') {
      if (trader) {
        trader.stopMonitoring();
      }
      console.log('Goodbye! 👋');
      rl.close();
      break;
    } else {
      console.log('Invalid choice\n');
    }
  }
}

main().catch(console.error);
