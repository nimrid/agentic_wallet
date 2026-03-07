import { Connection } from '@solana/web3.js';
import { AgentChat } from '@services/chat';
import { requestDevnetAirdrop } from '@core/airdrop';

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

export async function getAISolAmount(
    agent: AgentChat,
    poolName: string,
    solBalance: number
): Promise<number> {
    const maxAmount = Math.min(solBalance * 0.5, 2.0); // Strict safety limit: 2 SOL
    const prompt = `You are a liquidity provider AI agent. Decide how much SOL to deposit into this pool.

Pool: ${poolName}
Your SOL Balance: ${solBalance.toFixed(4)} SOL
STRICT LIMIT: You cannot spend more than 2.0 SOL per transaction.
Recommended Range: 0.1 to ${maxAmount.toFixed(4)} SOL

Consider:
- Don't use all your balance, keep some for trading
- Start with a reasonable amount
- Typical range is 0.1 to 1 SOL

Respond with ONLY a number (e.g., 0.5):`;

    const response = await agent.chat(prompt);
    const amount = parseFloat(response.trim());
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
        return Math.min(0.5, maxAmount);
    }
    return amount;
}

export async function selectBestPool(
    agent: AgentChat,
    pools: any[]
): Promise<any> {
    if (pools.length === 0) throw new Error('No pools available');
    try {
        const poolsInfo = pools.slice(0, 20).map((pool, idx) => {
            const liquidity = parseFloat(pool.liquidity) || 0;
            const volume = parseFloat(pool.volume_24h || 0) || 0;
            const fee = (pool.fee_bps || 0) / 100;
            return `${idx + 1}. ${pool.name} | Liq: $${liquidity.toFixed(0)} | Vol: $${volume.toFixed(0)} | Fee: ${fee}%`;
        }).join('\n');

        const prompt = `Select the best pool for SOL liquidity provision. Choose by number (1-${Math.min(pools.length, 20)}):

${poolsInfo}

Best = high liquidity + high volume + low fees. Respond with ONLY the number:`;

        const response = await agent.chat(prompt);
        const poolIndex = parseInt(response.trim()) - 1;
        if (isNaN(poolIndex) || poolIndex < 0 || poolIndex >= Math.min(pools.length, 20)) {
            return pools.reduce((best, pool) => parseFloat(pool.liquidity || 0) > parseFloat(best.liquidity || 0) ? pool : best);
        }
        return pools[poolIndex];
    } catch (error) {
        return pools.reduce((best, pool) => parseFloat(pool.liquidity || 0) > parseFloat(best.liquidity || 0) ? pool : best);
    }
}

export async function getStakingAmount(
    agent: AgentChat,
    solBalance: number
): Promise<number> {
    const maxAmount = Math.min(solBalance * 0.7, 2.0); // Strict safety limit: 2 SOL
    const prompt = `You are a staking AI agent. Decide how much SOL to stake with Marinade.

Your SOL Balance: ${solBalance.toFixed(4)} SOL
STRICT LIMIT: You cannot spend more than 2.0 SOL per transaction.
Recommended Range: 0.1 to ${maxAmount.toFixed(4)} SOL

Consider:
- Keep some SOL for transaction fees and trading
- Staking locks your SOL but generates yield
- Typical range is 0.1 to 2.0 SOL

Respond with ONLY a number (e.g., 1.5):`;

    const response = await agent.chat(prompt);
    const amount = parseFloat(response.trim());
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
        return Math.min(1.0, maxAmount);
    }
    return amount;
}

export async function getAIDepositAmount(
    agent: AgentChat,
    reserveSymbol: string,
    solBalance: number
): Promise<number> {
    const maxAmount = Math.min(solBalance * 0.5, 2.0); // Strict safety limit: 2 SOL
    const prompt = `You are a DeFi lending AI agent. Decide how much SOL to deposit into Kamino for this reserve.

Reserve: ${reserveSymbol}
Your SOL Balance: ${solBalance.toFixed(4)} SOL
STRICT LIMIT: You cannot spend more than 2.0 SOL per transaction.
Recommended Range: 0.1 to ${maxAmount.toFixed(4)} SOL

Consider:
- Don't use all your balance, keep some for trading and other activities
- Start with a reasonable amount to earn yield
- Typical range is 0.1 to 2.0 SOL

Respond with ONLY a number (e.g., 0.5):`;

    const response = await agent.chat(prompt);
    const amount = parseFloat(response.trim());
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
        return Math.min(0.5, maxAmount);
    }
    return amount;
}

export async function selectBestReserve(
    agent: AgentChat,
    reserves: any[]
): Promise<any> {
    if (reserves.length === 0) throw new Error('No reserves available');
    try {
        const reservesInfo = reserves.map((reserve, idx) => {
            const apy = (reserve.apy * 100).toFixed(2);
            const deposits = parseFloat(reserve.totalDeposits).toLocaleString();
            return `${idx + 1}. ${reserve.symbol} | APY: ${apy}% | Deposits: $${deposits}`;
        }).join('\n');

        const prompt = `Select the best Kamino reserve to deposit SOL for yield. Choose by number (1-${reserves.length}):

${reservesInfo}

Best = high APY + high total deposits. Respond with ONLY the number:`;

        const response = await agent.chat(prompt);
        const reserveIndex = parseInt(response.trim()) - 1;
        if (isNaN(reserveIndex) || reserveIndex < 0 || reserveIndex >= reserves.length) {
            return reserves.reduce((best, reserve) => reserve.apy > best.apy ? reserve : best);
        }
        return reserves[reserveIndex];
    } catch (error) {
        return reserves.reduce((best, reserve) => reserve.apy > best.apy ? reserve : best);
    }
}

export async function checkAndAirdropIfLow(
    walletAddress: string,
    agent: AgentChat,
    connection: Connection
): Promise<{ needsAirdrop: boolean; currentBalance: number; airdropped: boolean; agentDecision?: string }> {
    try {
        const balanceLamports = await connection.getBalance(new (await import('@solana/web3.js')).PublicKey(walletAddress));
        const balanceSOL = balanceLamports / 1e9;

        if (balanceSOL < 0.1) {
            const prompt = `Your wallet balance is low: ${balanceSOL.toFixed(4)} SOL (threshold: 0.1 SOL).

You can request any amount (typically 1-5 SOL). Should you request an airdrop? If yes, how much SOL should you request?

Respond with ONLY:
- "YES: X" where X is the amount (e.g., "YES: 2")
- "NO" if you don't need it`;

            const agentResponse = await agent.chat(prompt);

            if (agentResponse.toUpperCase().includes('YES')) {
                const match = agentResponse.match(/YES:\s*(\d+(?:\.\d+)?)/i);
                const airdropAmount = match ? parseFloat(match[1]) : 2;
                const result = await requestDevnetAirdrop(walletAddress, airdropAmount);
                return {
                    needsAirdrop: true,
                    currentBalance: balanceSOL,
                    airdropped: result.success,
                    agentDecision: `Approved airdrop of ${airdropAmount} SOL`
                };
            } else {
                return { needsAirdrop: true, currentBalance: balanceSOL, airdropped: false, agentDecision: 'Agent declined airdrop' };
            }
        }
        return { needsAirdrop: false, currentBalance: balanceSOL, airdropped: false, agentDecision: 'Balance is sufficient' };
    } catch (error) {
        return { needsAirdrop: false, currentBalance: 0, airdropped: false, agentDecision: 'Error checking balance' };
    }
}

export async function airdropOnNewWallet(
    walletAddress: string,
    agent: AgentChat
): Promise<{ success: boolean; agentDecision: string }> {
    try {
        const prompt = `You just created a new Solana devnet wallet: ${walletAddress}

You have the power to request an initial airdrop of devnet SOL to bootstrap your wallet for testing.
Should you request an initial airdrop? If yes, how much SOL?

Respond with ONLY:
- "YES: X" where X is the amount (e.g., "YES: 2")
- "NO" if you don't want it`;

        const agentResponse = await agent.chat(prompt);

        if (agentResponse.toUpperCase().includes('YES')) {
            const match = agentResponse.match(/YES:\s*(\d+(?:\.\d+)?)/i);
            const airdropAmount = match ? parseFloat(match[1]) : 2;
            const result = await requestDevnetAirdrop(walletAddress, airdropAmount);
            return { success: result.success, agentDecision: `Approved initial airdrop of ${airdropAmount} SOL` };
        } else {
            return { success: false, agentDecision: 'Agent declined initial airdrop' };
        }
    } catch (error) {
        return { success: false, agentDecision: 'Error requesting airdrop' };
    }
}
