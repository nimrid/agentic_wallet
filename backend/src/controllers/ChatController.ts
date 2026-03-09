import { Request, Response } from 'express';
import { getBalance, getTokenBalance } from '@core/transaction';
import { getMSolBalance, getStakingStats } from '@features/staking';
import { getPoolsForDisplay } from '@features/liquidity';
import { getTopVaults } from '@features/earn';
import { getStakingAmount } from '@features/agentTools';
import { AppState } from '../types';

export class ChatController {
    constructor(private state: AppState) { }

    chat = async (req: Request, res: Response) => {
        try {
            const { message } = req.body;
            if (!message) return res.status(400).json({ error: 'Message is required' });

            const response = await this.processUserMessage(message);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    private async processUserMessage(message: string): Promise<any> {
        const lowerMessage = message.toLowerCase();
        const balance = await getBalance(this.state.connection, this.state.wallet.publicKey);
        const mSolBalance = await getMSolBalance(this.state.connection, this.state.wallet);

        const balCircle = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
        const balSolend = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, 'zVzi5VAf4qMEwzv7NXECVx5v2pQ7xnqVVjCXZwS9XzA');

        if (lowerMessage.includes('balance') || lowerMessage.includes('check')) {
            return {
                type: 'info',
                message: `Your wallet balance:\n• SOL: ${balance.toFixed(4)}\n• mSOL: ${mSolBalance.toFixed(4)}\n• USDC (Standard): ${balCircle.toFixed(2)}\n• USDC (Solend Dev): ${balSolend.toFixed(2)}`,
                data: { balance, mSolBalance, usdcBalance: balCircle, balSolend }
            };
        }

        if (lowerMessage.includes('airdrop') || lowerMessage.includes('request')) {
            return {
                type: 'action',
                action: 'airdrop',
                message: `I can request an airdrop for you. Let me ask the AI agent to decide...`,
            };
        }

        if (lowerMessage.includes('stake')) {
            const amount = await getStakingAmount(this.state.chat, balance);
            return {
                type: 'action',
                action: 'stake',
                message: `I recommend staking ${amount.toFixed(4)} SOL. Shall I proceed?`,
                amount
            };
        }

        if (lowerMessage.includes('unstake')) {
            return {
                type: 'action',
                action: 'unstake',
                message: `You have ${mSolBalance.toFixed(4)} mSOL. How much would you like to unstake?`,
                availableAmount: mSolBalance
            };
        }

        if (lowerMessage.includes('send') || lowerMessage.includes('transfer')) {
            return {
                type: 'action',
                action: 'send',
                message: 'Please provide the recipient address and amount to send.',
            };
        }

        if (lowerMessage.includes('trade') || lowerMessage.includes('trading')) {
            return {
                type: 'action',
                action: 'trading',
                message: `🤖 I can start automated AI-powered trading on SOL/USDC. The AI will monitor prices and make BUY/SELL/HOLD decisions automatically. Ready to start?`,
            };
        }

        if (lowerMessage.includes('liquidity') || lowerMessage.includes('pool')) {
            const pools = await getPoolsForDisplay(this.state.connection);
            return {
                type: 'action',
                action: 'liquidity',
                message: `🤖 I can provide SOL liquidity to the best pool. Analyzing ${pools.length} pools...`,
                pools: pools.map(p => ({
                    name: p.name,
                    address: p.address,
                    liquidity: parseFloat(p.liquidity).toLocaleString(),
                    volume_24h: parseFloat(p.volume_24h || 0).toLocaleString(),
                    fee: (p.fee_bps / 100).toFixed(2)
                }))
            };
        }

        if (lowerMessage.includes('staking') || lowerMessage.includes('apy') || lowerMessage.includes('stats')) {
            const stats = await getStakingStats(this.state.connection);
            return {
                type: 'info',
                message: `Staking Stats:\n• APY: ${(stats.apy * 100).toFixed(2)}%\n• TVL: ${stats.tvl.toFixed(2)} SOL`,
                data: stats
            };
        }

        if (lowerMessage.includes('money glitch') || lowerMessage.includes('glitch')) {
            return {
                type: 'action',
                action: 'moneyglitch',
                message: `🔄 Money Glitch Mode: Autonomous feature chaining activated!\n\n🤖 AI will autonomously:\n• Stake SOL with Marinade\n• Trade SOL/USDC\n• Provide liquidity to pools\n• Repeat in an endless loop\n\n⚠️ Only stop with the kill switch!`,
            };
        }

        if (lowerMessage.includes('earn') || lowerMessage.includes('yield') || lowerMessage.includes('solend')) {
            const vaults = await getTopVaults(this.state.connection);
            return {
                type: 'action',
                action: 'earn',
                message: `🤖 I can help you earn yield on Solend. Analyzing ${vaults.length} vaults...`,
                reserves: vaults.map((r: any) => ({
                    symbol: r.symbol,
                    apy: (r.supplyApy * 100).toFixed(2),
                    totalDeposits: '$' + ((r.tvlUsd || 0) / 1_000_000).toFixed(1) + 'M'
                }))
            };
        }

        const aiResponse = await this.state.chat.chat(message);
        return { type: 'message', message: aiResponse };
    }
}
