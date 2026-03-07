import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { AppState } from '../types';

export const createChatRouter = (state: AppState) => {
    const router = Router();
    const controller = new ChatController(state);

    router.post('/', controller.chat);

    return router;
};
