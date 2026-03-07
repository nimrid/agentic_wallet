import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { AppState } from '../types';

export const createWalletRouter = (state: AppState) => {
    const router = Router();
    const controller = new WalletController(state);

    router.get('/', controller.getWalletInfo);
    router.post('/', controller.requestAirdrop); // Support POST /api/airdrop directly
    router.post('/send-sol', controller.sendSol);
    router.post('/airdrop', controller.requestAirdrop);
    router.post('/check-and-airdrop', controller.checkAndAirdrop);

    return router;
};
