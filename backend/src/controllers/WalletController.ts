import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { getBalance, sendSol, getTokenBalance } from '@core/transaction';
import { getMSolBalance } from '@features/staking';
import { requestDevnetAirdrop } from '@core/airdrop';
import { checkAndAirdropIfLow } from '@features/agentTools';
import { checkSpendLimits, recordSpend } from '@core/spendLimits';
import { AppState } from '../types';

const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Circle Devnet USDC
const DEVUSDC_MINT = 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k'; // Orca Devnet USDC

export class WalletController {
    constructor(private state: AppState) { }

    getWalletInfo = async (req: Request, res: Response) => {
        try {
            const balance = await getBalance(this.state.connection, this.state.wallet.publicKey);
            const usdcBalance = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, USDC_MINT);
            const devUsdcBalance = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, DEVUSDC_MINT);
            const mSolBalance = await getMSolBalance(this.state.connection, this.state.wallet);

            res.json({
                publicKey: this.state.wallet.publicKey.toString(),
                solBalance: balance,
                usdcBalance,
                devUsdcBalance,
                mSolBalance,
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    sendSol = async (req: Request, res: Response) => {
        try {
            const { recipient, amount } = req.body;
            const currentBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);
            const estimatedFee = 0.00001;

            if (amount + estimatedFee > currentBalance) {
                return res.status(400).json({
                    error: `Insufficient balance. Need ${amount + estimatedFee} SOL, have ${currentBalance} SOL`
                });
            }

            const limitCheck = checkSpendLimits(amount);
            if (!limitCheck.allowed) {
                return res.status(400).json({ error: limitCheck.reason });
            }

            const signature = await sendSol(this.state.connection, this.state.wallet, recipient, amount);
            recordSpend(amount);
            const newBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);

            res.json({
                success: true,
                signature,
                newBalance,
                message: `Sent ${amount} SOL to ${recipient}`
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    requestAirdrop = async (req: Request, res: Response) => {
        try {
            const { walletAddress } = req.body;
            const targetAddress = walletAddress || this.state.wallet.publicKey.toString();

            const balance = await getBalance(this.state.connection, new PublicKey(targetAddress));
            const agentPrompt = `A user is requesting an airdrop for wallet: ${targetAddress}
Current Balance: ${balance.toFixed(4)} SOL

You have the power to approve or deny this airdrop request. Consider:
- The wallet balance is ${balance.toFixed(4)} SOL.
- Legitimate requests usually happen when balance is low (< 0.5 SOL).
- How much SOL should be airdropped? (1-5 SOL typical)
- Should you approve this?
Respond with ONLY:
- "APPROVE: X" where X is the amount (e.g., "APPROVE: 2")
- "DENY" if you don't approve`;

            const agentDecision = await this.state.chat.chat(agentPrompt);
            if (agentDecision.toUpperCase().includes('APPROVE')) {
                const match = agentDecision.match(/APPROVE:\s*(\d+(?:\.\d+)?)/i);
                const airdropAmount = match ? parseFloat(match[1]) : 2;

                const result = await requestDevnetAirdrop(targetAddress, airdropAmount);
                if (result.success) {
                    const newBalance = await getBalance(this.state.connection, new PublicKey(targetAddress));
                    res.json({
                        success: true,
                        signature: result.signature,
                        message: result.message,
                        newBalance,
                        agentDecision: `Approved airdrop of ${airdropAmount} SOL`
                    });
                } else {
                    res.status(400).json({ success: false, message: result.message, agentDecision: `Airdrop failed` });
                }
            } else {
                res.status(400).json({ success: false, message: 'Airdrop request denied', agentDecision: 'Agent denied the airdrop request' });
            }
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    checkAndAirdrop = async (req: Request, res: Response) => {
        try {
            const { walletAddress } = req.body;
            const targetAddress = walletAddress || this.state.wallet.publicKey.toString();
            const result = await checkAndAirdropIfLow(targetAddress, this.state.chat, this.state.connection);
            res.json({
                needsAirdrop: result.needsAirdrop,
                currentBalance: result.currentBalance.toFixed(4),
                airdropped: result.airdropped,
                agentDecision: result.agentDecision,
                message: result.agentDecision
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };
}
