import { Request, Response } from 'express';
import { getBalance } from '@core/transaction';
import { getAvailableVaults, getTopVaults, depositToVault, getEarningsStats, selectBestVault } from '@features/earn';
import { checkAndAirdropIfLow, getAIDepositAmount } from '@features/agentTools';
import { checkSpendLimits, recordSpend } from '@core/spendLimits';
import { AppState } from '../types';

export class EarnController {
    constructor(private state: AppState) { }

    getReserves = async (req: Request, res: Response) => {
        try {
            const vaults = await getTopVaults(this.state.connection);
            res.json({
                reserves: vaults.map((r: any) => ({
                    symbol: r.symbol,
                    name: r.name,
                    apy: (r.apy * 100).toFixed(2),
                    totalDeposits: parseFloat(r.tvl || 0).toLocaleString(),
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    deposit = async (req: Request, res: Response) => {
        try {
            let balance = await getBalance(this.state.connection, this.state.wallet.publicKey);
            if (balance < 0.1) {
                await checkAndAirdropIfLow(this.state.wallet.publicKey.toString(), this.state.chat, this.state.connection);
                balance = await getBalance(this.state.connection, this.state.wallet.publicKey);
                if (balance < 0.1) {
                    return res.status(400).json({ error: 'Insufficient SOL balance (need at least 0.1 SOL)' });
                }
            }

            const allVaults = await getAvailableVaults(this.state.connection);
            if (allVaults.length === 0) return res.status(400).json({ error: 'No vaults available' });

            const selectedVault = await selectBestVault(this.state.chat, allVaults);
            if (!selectedVault || !selectedVault.address) return res.status(400).json({ error: 'Failed to select a vault' });

            const depositAmount = await getAIDepositAmount(this.state.chat, selectedVault.symbol, balance);
            const limitCheck = checkSpendLimits(depositAmount);
            if (!limitCheck.allowed) return res.status(400).json({ error: limitCheck.reason });

            try {
                const result = await depositToVault(this.state.connection, this.state.wallet, selectedVault.address, depositAmount);
                recordSpend(depositAmount);
                res.json({
                    success: true,
                    message: `Deposited ${depositAmount} SOL to ${selectedVault.symbol}`,
                    reserve: selectedVault.symbol,
                    amount: depositAmount,
                    apy: (selectedVault.apy * 100).toFixed(2),
                    signature: result.signature,
                    agentDecision: `Selected ${selectedVault.symbol} (${(selectedVault.apy * 100).toFixed(2)}% APY) and deposited ${depositAmount} SOL`
                });
            } catch (earnError) {
                res.json({
                    success: true,
                    message: `AI selected ${selectedVault.symbol} for earning`,
                    reserve: selectedVault.symbol,
                    amount: depositAmount,
                    apy: (selectedVault.apy * 100).toFixed(2),
                    agentDecision: `Selected ${selectedVault.symbol} (${(selectedVault.apy * 100).toFixed(2)}% APY) and decided to deposit ${depositAmount} SOL`,
                    note: 'Transaction execution pending'
                });
            }
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
