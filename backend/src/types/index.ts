import { Connection, Keypair } from '@solana/web3.js';
import { AgentChat } from '@services/chat';
import { SolanaTrader } from '@features/trading';

export interface AppState {
    agentId: string;        // Unique identifier for each independent agent
    connection: Connection;
    wallet: Keypair;
    chat: AgentChat;
    trader: SolanaTrader | null;
    setTrader: (trader: SolanaTrader | null) => void;
}
