import { Connection, Keypair } from '@solana/web3.js';
import { AgentChat } from '@services/chat';
import { loadOrCreateWallet, listAgents } from '@core/wallet';
import { airdropOnNewWallet } from '@features/agentTools';
import { processRecurringTransfers } from '@core/recurring';
import { AppState } from '../types';

const registry = new Map<string, AppState>();
let sharedConnection: Connection;
let sharedApiKey: string;

/**
 * Must be called once at server startup before any agents are spawned.
 */
export function initRegistry(connection: Connection, apiKey: string) {
    sharedConnection = connection;
    sharedApiKey = apiKey;
}

/**
 * Returns the AppState for the given agentId, creating and initializing
 * the agent if it has never been seen before. Safe to call concurrently
 * for the same agentId — a simple in-memory lock prevents double-init.
 */
const initializing = new Set<string>();

export async function getOrCreateAgent(agentId: string): Promise<AppState> {
    if (registry.has(agentId)) {
        return registry.get(agentId)!;
    }

    // Prevent race conditions when two requests arrive for the same new agent simultaneously
    if (initializing.has(agentId)) {
        // Wait until the other initializer is done
        await new Promise<void>(resolve => {
            const poll = setInterval(() => {
                if (registry.has(agentId)) {
                    clearInterval(poll);
                    resolve();
                }
            }, 50);
        });
        return registry.get(agentId)!;
    }

    initializing.add(agentId);
    try {
        console.log(`🤖 Initializing agent [${agentId}]...`);

        const chat = new AgentChat(sharedApiKey);

        const wallet = await loadOrCreateWallet(agentId, async (address) => {
            console.log(`🤖 [${agentId}] New wallet — requesting AI airdrop decision...`);
            const result = await airdropOnNewWallet(address, chat);
            console.log(`🤖 [${agentId}] Agent decision: ${result.agentDecision}`);
        });

        console.log(`✅ [${agentId}] Wallet: ${wallet.publicKey.toString()}`);

        let trader: import('@features/trading').SolanaTrader | null = null;

        const state: AppState = {
            agentId,
            connection: sharedConnection,
            wallet,
            chat,
            get trader() { return trader; },
            setTrader: (t) => { trader = t; }
        };

        registry.set(agentId, state);
        return state;
    } finally {
        initializing.delete(agentId);
    }
}

/** Lists all agents currently in the registry. */
export function listActiveAgents(): string[] {
    return Array.from(registry.keys());
}

/** Lists all agents that have persisted wallets (active or not). */
export { listAgents as listPersistedAgents };

/** 
 * Background service: tick recurring transfers for every active agent.
 * Call this once from server.ts with setInterval.
 */
export async function tickAllAgents() {
    for (const [agentId, state] of registry.entries()) {
        try {
            await processRecurringTransfers(agentId, state.connection, state.wallet);
        } catch (err) {
            console.error(`❌ [${agentId}] Recurring transfer tick failed:`, err);
        }
    }
}
