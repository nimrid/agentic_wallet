import { Router } from 'express';
import { TradingController } from '../controllers/TradingController';
import { AppState } from '../types';

export const createTradingRouter = (state: AppState) => {
    const router = Router();
    const controller = new TradingController(state);

    router.post('/start', controller.start);
    router.post('/stop', controller.stop);
    router.get('/status', controller.getStatus);

    return router;
};
