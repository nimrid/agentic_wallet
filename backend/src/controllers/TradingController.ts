import { Request, Response } from 'express';
import { SolanaTrader } from '@features/trading';
import { getAITradingDecision } from '@features/agentTools';
import { AppState } from '../types';

export class TradingController {
    constructor(private state: AppState) { }

    start = async (req: Request, res: Response) => {
        try {
            if (this.state.trader) {
                return res.status(400).json({ error: 'Trading already active' });
            }

            const trader = new SolanaTrader(this.state.connection, this.state.wallet, {
                checkInterval: 30000,
                maxTradeAmount: 0.1,
            }, async (...args) => {
                return await getAITradingDecision(this.state.chat, ...args);
            });

            await trader.initialize();
            trader.startMonitoring().catch(console.error);
            this.state.setTrader(trader);

            res.json({
                success: true,
                message: 'Trading started',
                status: 'active'
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    stop = async (req: Request, res: Response) => {
        try {
            if (!this.state.trader) {
                return res.status(400).json({ error: 'No active trading' });
            }

            this.state.trader.stopMonitoring();
            const history = this.state.trader.getPriceHistory();
            this.state.setTrader(null);

            res.json({
                success: true,
                message: 'Trading stopped',
                priceHistory: history,
                status: 'stopped'
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    getStatus = async (req: Request, res: Response) => {
        try {
            if (!this.state.trader) {
                return res.json({ active: false, message: 'No active trading' });
            }

            const history = this.state.trader.getPriceHistory();
            const decisions = this.state.trader.getTradeDecisions();
            const currentPrice = history.length > 0 ? history[history.length - 1].price : 0;
            const avgPrice = this.state.trader.getAveragePrice();

            res.json({
                active: true,
                currentPrice: currentPrice.toFixed(2),
                averagePrice: avgPrice.toFixed(2),
                priceHistory: history.slice(-20),
                decisions: decisions.slice(-10),
                historyLength: history.length
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };
}
