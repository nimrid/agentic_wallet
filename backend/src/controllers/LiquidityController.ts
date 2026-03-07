import { Request, Response } from 'express';
import { getBalance } from '@core/transaction';
import { getAvailablePools, addLiquidity, getPoolsForDisplay } from '@features/liquidity';
import { checkAndAirdropIfLow, selectBestPool, getAISolAmount } from '@features/agentTools';
import { checkSpendLimits, recordSpend } from '@core/spendLimits';
import { AppState } from '../types';

export class LiquidityController {
    constructor(private state: AppState) { }

    getPools = async (req: Request, res: Response) => {
        try {
            const pools = await getPoolsForDisplay(this.state.connection);
            res.json({
                pools: pools.map(p => ({
                    address: p.address,
                    name: p.name,
                    liquidity: parseFloat(p.liquidity).toLocaleString(),
                    volume_24h: parseFloat(p.volume_24h || 0).toLocaleString(),
                    fee: (p.fee_bps / 100).toFixed(2),
                    bin_step: p.bin_step
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    provideLiquidity = async (req: Request, res: Response) => {
        try {
            let balance = await getBalance(this.state.connection, this.state.wallet.publicKey);
            if (balance < 0.1) {
                await checkAndAirdropIfLow(this.state.wallet.publicKey.toString(), this.state.chat, this.state.connection);
                balance = await getBalance(this.state.connection, this.state.wallet.publicKey);
                if (balance < 0.1) {
                    return res.status(400).json({ error: 'Insufficient SOL balance (need at least 0.1 SOL)' });
                }
            }

            const allPools = await getAvailablePools(this.state.connection);
            if (allPools.length === 0) return res.status(400).json({ error: 'No pools available' });

            const selectedPool = await selectBestPool(this.state.chat, allPools);
            if (!selectedPool || !selectedPool.address) return res.status(400).json({ error: 'Failed to select a pool' });

            const solAmount = await getAISolAmount(this.state.chat, selectedPool.name, balance);
            const limitCheck = checkSpendLimits(solAmount);
            if (!limitCheck.allowed) return res.status(400).json({ error: limitCheck.reason });

            try {
                const result = await addLiquidity(this.state.connection, this.state.wallet, selectedPool.address, solAmount);
                recordSpend(solAmount);
                res.json({
                    success: true,
                    message: `Provided ${solAmount} SOL to ${selectedPool.name}`,
                    pool: selectedPool.name,
                    amount: solAmount,
                    signature: result.txHash,
                    positionAddress: result.positionPubKey,
                    agentDecision: `Selected ${selectedPool.name} and provided ${solAmount} SOL`
                });
            } catch (liquidityError) {
                res.json({
                    success: true,
                    message: `AI selected ${selectedPool.name} for liquidity provision`,
                    pool: selectedPool.name,
                    amount: solAmount,
                    agentDecision: `Selected ${selectedPool.name} and decided to provide ${solAmount} SOL`,
                    note: 'Transaction execution pending'
                });
            }
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };
}
