import { Router } from 'express';
import { EarnController } from '../controllers/EarnController';
import { AppState } from '../types';

export const createEarnRouter = (state: AppState) => {
    const router = Router();
    const controller = new EarnController(state);

    router.get('/reserves', controller.getReserves);
    router.post('/deposit', controller.deposit);
    router.get('/stats', controller.getStats);

    return router;
};
