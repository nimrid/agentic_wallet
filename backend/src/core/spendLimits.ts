import * as fs from 'fs';
import * as path from 'path';

export interface SecurityConfig {
    dailySpendLimit: number; // Max SOL that can be spent per day
    maxSpendPerTx: number;   // Max SOL that can be spent per single transaction
}

// Default safety limits (can be overridden per-agent in the future)
const DEFAULT_CONFIG: SecurityConfig = {
    dailySpendLimit: 10.0, // 10 SOL per day
    maxSpendPerTx: 2.0,   // 2 SOL per transaction
};

interface SpendState {
    date: string; // YYYY-MM-DD
    spentToday: number;
}

// All spend state files live alongside the wallet files in a data/ directory
const DATA_DIR = path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getStatePath(agentId: string): string {
    const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(DATA_DIR, `spend_limits_${safe}.json`);
}

function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

function loadState(agentId: string): SpendState {
    const statePath = getStatePath(agentId);
    if (fs.existsSync(statePath)) {
        try {
            return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        } catch {
            console.warn(`⚠️ [${agentId}] Could not read spend limits state, resetting to zero.`);
        }
    }
    return { date: getTodayString(), spentToday: 0 };
}

function saveState(agentId: string, state: SpendState) {
    fs.writeFileSync(getStatePath(agentId), JSON.stringify(state, null, 2));
}

/**
 * Checks if a proposed transaction amount violates security limits for a given agent.
 * @param agentId  The agent performing the spend check
 * @param amount   Amount of SOL to spend
 */
export function checkSpendLimits(
    amount: number,
    agentId: string = 'default'
): { allowed: boolean; reason?: string; config: SecurityConfig } {
    if (amount > DEFAULT_CONFIG.maxSpendPerTx) {
        return {
            allowed: false,
            reason: `[${agentId}] Amount (${amount} SOL) exceeds max per-tx limit (${DEFAULT_CONFIG.maxSpendPerTx} SOL).`,
            config: DEFAULT_CONFIG
        };
    }

    const state = loadState(agentId);
    const today = getTodayString();

    if (state.date !== today) {
        state.date = today;
        state.spentToday = 0;
    }

    if (state.spentToday + amount > DEFAULT_CONFIG.dailySpendLimit) {
        return {
            allowed: false,
            reason: `[${agentId}] Amount (${amount} SOL) exceeds daily limit (${DEFAULT_CONFIG.dailySpendLimit} SOL). Spent today: ${state.spentToday.toFixed(4)} SOL.`,
            config: DEFAULT_CONFIG
        };
    }

    return { allowed: true, config: DEFAULT_CONFIG };
}

/**
 * Records a successful transaction to update the agent's daily spent total.
 * @param amount   Amount of SOL successfully spent
 * @param agentId  The agent that made the spend
 */
export function recordSpend(amount: number, agentId: string = 'default') {
    const state = loadState(agentId);
    const today = getTodayString();

    if (state.date !== today) {
        state.date = today;
        state.spentToday = 0;
    }

    state.spentToday += amount;
    saveState(agentId, state);
    console.log(`🛡️  [${agentId}] Recorded spend of ${amount} SOL. Daily total: ${state.spentToday.toFixed(4)} / ${DEFAULT_CONFIG.dailySpendLimit} SOL`);
}
