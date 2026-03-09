import { Request, Response } from 'express';
import { getBalance, getTokenBalance } from '@core/transaction';
import {
    getAvailableVaults,
    getTopVaults,
    depositToVault,
    getEarningsStats,
    selectBestVault,
    getAIDepositAmountForReserve,
} from '@features/earn';
import { checkAndAirdropIfLow } from '@features/agentTools';
import { checkSpendLimits, recordSpend } from '@core/spendLimits';
import { AppState } from '../types';

// Devnet USDC mints
const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const DEVUSDC_MINT = 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k';
const SOLEND_USDC_MINT = 'zVzi5VAf4qMEwzv7NXECVx5v2pQ7xnqVVjCXZwS9XzA';

export class EarnController {
    constructor(private state: AppState) { }

    getReserves = async (req: Request, res: Response) => {
        try {
            const vaults = await getTopVaults(this.state.connection);
            res.json({
                reserves: vaults.map((r: any) => ({
                    symbol: r.symbol,
                    name: r.symbol + ' Reserve',
                    apy: (r.supplyApy * 100).toFixed(2),
                    totalDeposits: '$' + (r.tvlUsd / 1_000_000).toFixed(1) + 'M',
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    deposit = async (req: Request, res: Response) => {
        try {
            // 1. Fetch all balances upfront
            let solBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);
            const usdcBalance = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, USDC_MINT);
            const devUsdcBalance = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, DEVUSDC_MINT);
            const solendUsdcBalance = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, SOLEND_USDC_MINT);
            const totalUsdc = usdcBalance + devUsdcBalance + solendUsdcBalance;

            // 2. Auto-airdrop if SOL is too low
            if (solBalance < 0.1) {
                await checkAndAirdropIfLow(this.state.wallet.publicKey.toString(), this.state.chat, this.state.connection);
                solBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);
                if (solBalance < 0.1) {
                    return res.status(400).json({ error: 'Insufficient SOL balance (need at least 0.1 SOL)' });
                }
            }

            // 3. Get available Solend reserves
            const allVaults = await getAvailableVaults(this.state.connection);
            if (allVaults.length === 0) {
                return res.status(400).json({ error: 'No Solend reserves available' });
            }

            // 4. AI picks the best reserve (token-aware — knows SOL and specific reserve mint balances)
            const selectedVault = await selectBestVault(this.state.chat, allVaults, this.state.wallet.publicKey, this.state.connection);
            if (!selectedVault) {
                return res.status(400).json({ error: 'AI could not select a suitable reserve' });
            }

            // 5. AI decides how much of the correct token to deposit
            const { amount: depositAmount, token } = await getAIDepositAmountForReserve(
                this.state.chat,
                selectedVault,
                this.state.wallet.publicKey,
                this.state.connection
            );

            console.log(`🤖 AI selected: ${selectedVault.symbol} reserve, depositing ${depositAmount} ${token}`);

            // 6. Spend limit gate (SOL only — for non-SOL tokens we just check amount reasonableness)
            if (token === 'SOL') {
                const limitCheck = checkSpendLimits(depositAmount);
                if (!limitCheck.allowed) {
                    return res.status(400).json({ error: limitCheck.reason });
                }
            }

            // 7. Execute real on-chain deposit
            const result = await depositToVault(
                this.state.connection,
                this.state.wallet,
                selectedVault,          // full ReserveInfo object
                depositAmount
            );

            if (token === 'SOL') recordSpend(depositAmount);

            res.json({
                success: true,
                message: `Deposited ${depositAmount} ${token} into Solend ${selectedVault.symbol} Reserve`,
                reserve: selectedVault.symbol,
                token,
                amount: depositAmount,
                apy: (selectedVault.supplyApy * 100).toFixed(2),
                tvl: '$' + (selectedVault.tvlUsd / 1_000_000).toFixed(1) + 'M',
                signature: result.signature,
                isSimulated: result.isSimulated,
                agentDecision: `Selected ${selectedVault.symbol} reserve (${(selectedVault.supplyApy * 100).toFixed(2)}% APY) and prepared deposit of ${depositAmount} ${token}`
            });

        } catch (error) {
            console.error('Earn deposit error:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
                note: 'Solend devnet should be supported. Check your balances.'
            });
        }
    };

    getStats = async (req: Request, res: Response) => {
        try {
            const stats = await getEarningsStats(this.state.connection);
            res.json({
                totalTVL: stats.totalTVL.toFixed(2),
                avgAPY: (stats.avgAPY * 100).toFixed(2),
                reserveCount: stats.vaultCount || 0
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };
}
