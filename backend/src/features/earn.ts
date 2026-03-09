import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SolendMarket, SolendAction } from '@solendprotocol/solend-sdk';
import { AgentChat } from '@services/chat';
import { getTokenBalance, getBalance } from '@core/transaction';

const SUPPORTED_TOKENS = ['SOL', 'USDC', 'USDT'];

export interface ReserveInfo {
  symbol: string;
  address: string;
  mintAddress: string;
  supplyApy: number;
  tvlUsd: number;
  decimals: number;
}

// ─── Fetch live reserves from Solend ────────────────────────────────
export async function getAvailableVaults(connection: Connection): Promise<ReserveInfo[]> {
  try {
    console.log('📊 Fetching live Solend reserve metrics...');
    const isDevnet = connection.rpcEndpoint.includes('devnet');
    const env = isDevnet ? 'devnet' : 'production';

    if (isDevnet) {
      console.log('⚠️ Note: Solend devnet values may appear weird (as per docs)');
    }

    const market = await SolendMarket.initialize(connection, env);
    await market.loadReserves();

    const reserves: ReserveInfo[] = market.reserves
      .filter(r => SUPPORTED_TOKENS.includes(r.config.liquidityToken.symbol))
      .map(r => {
        let supplyApy = 0;
        try { supplyApy = Number(r.stats?.supplyInterestAPY) || 0; } catch (e) { }
        if (isDevnet && Number.isNaN(supplyApy)) supplyApy = 0.05;

        let tvlUsd = 0;
        try {
          tvlUsd = Number(r.stats?.totalDepositsWads?.toString() || 0) / 1e18;
          if (r.config.liquidityToken.symbol === 'SOL') tvlUsd *= 150;
          if (isDevnet && (Number.isNaN(tvlUsd) || tvlUsd === 0)) tvlUsd = 1000000;
        } catch (e) { }


        return {
          symbol: r.config.liquidityToken.symbol,
          address: r.config.address,
          mintAddress: r.config.liquidityToken.mint,
          supplyApy: supplyApy,
          tvlUsd: tvlUsd,
          decimals: r.config.liquidityToken.decimals,
        };
      })
      .sort((a, b) => b.supplyApy - a.supplyApy);

    console.log(`✅ Loaded ${reserves.length} live Solend reserves`);
    reserves.forEach(r =>
      console.log(`   ${r.symbol}: ${(r.supplyApy * 100).toFixed(2)}% APY, $${r.tvlUsd.toLocaleString()} TVL`)
    );

    return reserves;
  } catch (error) {
    console.error('⚠️ Solend API error, using hardcoded fallback:', error);
    return [
      {
        symbol: 'SOL',
        address: '',
        mintAddress: '',
        supplyApy: 0.045,
        tvlUsd: 250_000_000,
        decimals: 9
      },
      {
        symbol: 'USDC',
        address: '',
        mintAddress: '',
        supplyApy: 0.011,
        tvlUsd: 280_000_000,
        decimals: 6
      },
    ];
  }
}

export async function getTopVaults(connection: Connection): Promise<ReserveInfo[]> {
  return (await getAvailableVaults(connection)).slice(0, 5);
}

// ─── AI: pick best reserve based on user's actual token balances ──────────────
export async function selectBestVault(
  agent: AgentChat,
  vaults: ReserveInfo[],
  wallet: PublicKey,
  connection: Connection
): Promise<ReserveInfo> {
  if (vaults.length === 0) throw new Error('No reserves available');

  const solBalance = await getBalance(connection, wallet);
  const vaultsWithBalances = await Promise.all(vaults.map(async (v) => {
    let bal = 0;
    if (v.symbol === 'SOL') {
      bal = solBalance;
    } else if (v.mintAddress) {
      bal = await getTokenBalance(connection, wallet, v.mintAddress);
    }
    return { ...v, balance: bal };
  }));

  const vaultsInfo = vaultsWithBalances.map((v, idx) => {
    const decimals = v.symbol === 'SOL' ? 4 : 2;
    const canAfford = v.symbol === 'SOL' ? v.balance >= 0.1 : v.balance >= 1;
    return `${idx + 1}. ${v.symbol} | APY: ${(v.supplyApy * 100).toFixed(2)}% | TVL: $${v.tvlUsd.toLocaleString()} | You have ${v.balance.toFixed(decimals)} ${v.symbol}${canAfford ? '' : ' ⚠️ TOO LOW'}`;
  }).join('\n');

  const prompt = `You are a DeFi yield AI. Select the best Solend reserve based on user balance and APY.

Available Reserves:
${vaultsInfo}

Your SOL Balance: ${solBalance.toFixed(4)} SOL

Rules:
- SOL reserve → deposit SOL (need ≥ 0.1, keep 0.05 for fees)
- USDC/USDT reserve → deposit tokens (need ≥ 1 in that specific reserve mint)
- Do NOT select ⚠️ TOO LOW reserves
- Higher APY is better if balance allows

Reply with ONLY the number:`;

  try {
    const response = await agent.chat(prompt);
    const idx = parseInt(response.trim()) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < vaults.length) {
      console.log(`🤖 AI selected: ${vaults[idx].symbol} reserve`);
      return vaults[idx];
    }
  } catch (e) {
    console.error('AI vault selection fallback:', e);
  }

  // Fallback: highest APY with enough balance
  return vaultsWithBalances
    .filter(v => v.symbol === 'SOL' ? v.balance >= 0.1 : v.balance >= 1)
    .sort((a, b) => b.supplyApy - a.supplyApy)[0] ?? vaults[0];
}

// ─── AI: decide deposit amount for the chosen reserve's token ────────────────
export async function getAIDepositAmountForReserve(
  agent: AgentChat,
  reserve: ReserveInfo,
  walletAddress: PublicKey,
  connection: Connection
): Promise<{ amount: number; token: string }> {
  const isSOL = reserve.symbol === 'SOL';
  const token = reserve.symbol;
  const balance = isSOL ? (await getBalance(connection, walletAddress)) : (await getTokenBalance(connection, walletAddress, reserve.mintAddress));
  const solBalance = isSOL ? balance : (await getBalance(connection, walletAddress));
  
  const maxAmount = isSOL
    ? Math.min((solBalance - 0.05) * 0.3, 2.0)
    : Math.min(balance * 0.5, 100);

  if (maxAmount <= 0) return { amount: 0, token };

  const prompt = `Decide how much ${token} to deposit into Solend ${token} Reserve (${(reserve.supplyApy * 100).toFixed(2)}% APY).

${token} Balance: ${balance.toFixed(isSOL ? 4 : 2)} ${token}
Max deposit: ${maxAmount.toFixed(isSOL ? 4 : 2)} ${token}
${isSOL ? 'Keep at least 0.05 SOL for gas.' : ''}
Conservative range: ${isSOL ? '0.1–0.5 SOL' : '5–20 USDC'}

Respond with ONLY a number:`;

  try {
    const response = await agent.chat(prompt);
    const amount = parseFloat(response.trim());
    if (!isNaN(amount) && amount > 0 && amount <= maxAmount) {
      return { amount, token };
    }
  } catch { /* fallback */ }

  return { amount: isSOL ? Math.min(0.2, maxAmount) : Math.min(10, maxAmount), token };
}

// ─── Execute real or simulated Solend deposit ────────────────────────────────
export async function depositToVault(
  connection: Connection,
  wallet: Keypair,
  reserve: ReserveInfo,
  depositAmount: number
): Promise<{ signature: string; token: string; amount: number; isSimulated?: boolean }> {
  console.log(`🚀 Preparing ${depositAmount} ${reserve.symbol} deposit into Solend...`);

  const isDevnet = connection.rpcEndpoint.includes('devnet');
  const env = isDevnet ? 'devnet' : 'production';

  try {
    const scaledAmount = Math.floor(depositAmount * Math.pow(10, reserve.decimals)).toString();

    const solendAction = await SolendAction.buildDepositTxns(
      connection,
      scaledAmount,
      reserve.symbol,
      wallet.publicKey,
      env
    );

    let finalSig = '';
    const sendTransaction = async (txn: any, connection: Connection) => {
      txn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      txn.feePayer = wallet.publicKey;

      txn.sign(wallet);
      const signature = await connection.sendRawTransaction(txn.serialize());
      await connection.confirmTransaction(signature);
      finalSig = signature;
      return signature;
    };

    await solendAction.sendTransactions(sendTransaction);

    console.log(`✅ Solend deposit confirmed: ${finalSig}`);
    return { signature: finalSig, token: reserve.symbol, amount: depositAmount, isSimulated: false };
  } catch (error) {
    console.error('Solend transaction failed:', error);
    throw error;
  }
}

export async function getEarningsStats(connection: Connection): Promise<any> {
  try {
    const vaults = await getAvailableVaults(connection);
    if (!vaults.length) return { totalTVL: 0, avgAPY: 0, vaultCount: 0 };
    const totalTVL = vaults.reduce((s, v) => s + v.tvlUsd, 0);
    const avgAPY = vaults.reduce((s, v) => s + v.supplyApy, 0) / vaults.length;
    return { totalTVL, avgAPY, vaultCount: vaults.length };
  } catch {
    return { totalTVL: 0, avgAPY: 0, vaultCount: 0 };
  }
}

