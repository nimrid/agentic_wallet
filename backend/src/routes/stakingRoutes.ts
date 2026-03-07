import { Router } from 'express';
import { StakingController } from '../controllers/StakingController';
import { AppState } from '../types';

export const createStakingRouter = (state: AppState) => {
    const router = Router();
    const controller = new StakingController(state);

    router.post('/stake', controller.stake);
    router.post('/unstake', controller.unstake);
    router.get('/stats', controller.getStats);

    return router;
};
