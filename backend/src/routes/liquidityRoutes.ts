import { Router } from 'express';
import { LiquidityController } from '../controllers/LiquidityController';
import { AppState } from '../types';

export const createLiquidityRouter = (state: AppState) => {
    const router = Router();
    const controller = new LiquidityController(state);

    router.get('/pools', controller.getPools);
    router.post('/provide', controller.provideLiquidity);

    return router;
};
