import { Request, Response } from 'express';
import { getBalance } from '@core/transaction';
import { stakeSol, unstakeSol, getMSolBalance, getStakingStats } from '@features/staking';
import { checkSpendLimits, recordSpend } from '@core/spendLimits';
import { AppState } from '../types';

export class StakingController {
    constructor(private state: AppState) { }

    stake = async (req: Request, res: Response) => {
        try {
            const { amount } = req.body;
            const currentBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);
            if (amount > currentBalance) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }

            const limitCheck = checkSpendLimits(amount);
            if (!limitCheck.allowed) {
                return res.status(400).json({ error: limitCheck.reason });
            }

            const result = await stakeSol(this.state.connection, this.state.wallet, amount);
            recordSpend(amount);
            const mSolBalance = await getMSolBalance(this.state.connection, this.state.wallet);

            res.json({
                success: true,
                signature: result.signature,
                mSolBalance,
                message: `Successfully staked ${amount} SOL`
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    unstake = async (req: Request, res: Response) => {
        try {
            const { amount } = req.body;
            const mSolBalance = await getMSolBalance(this.state.connection, this.state.wallet);
            if (amount > mSolBalance) {
                return res.status(400).json({ error: 'Insufficient mSOL balance' });
            }

            const amountLamports = Math.floor(amount * 1e9);
            const result = await unstakeSol(this.state.connection, this.state.wallet, amountLamports);
            const newBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);

            res.json({
                success: true,
                signature: result.signature,
                solBalance: newBalance,
                message: `Successfully unstaked ${amount} mSOL`
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    getStats = async (req: Request, res: Response) => {
        try {
            const stats = await getStakingStats(this.state.connection);
            const mSolBalance = await getMSolBalance(this.state.connection, this.state.wallet);
            res.json({
                apy: (stats.apy * 100).toFixed(2),
                tvl: stats.tvl.toFixed(2),
                mSolBalance: mSolBalance.toFixed(4)
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };
}
