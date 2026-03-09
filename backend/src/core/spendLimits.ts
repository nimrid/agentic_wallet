import * as fs from 'fs';
import * as path from 'path';

export interface SecurityConfig {
    dailySpendLimit: number; // Max SOL that can be spent per day
    maxSpendPerTx: number;   // Max SOL that can be spent per single transaction
}

// Default safety limits
const DEFAULT_CONFIG: SecurityConfig = {
    dailySpendLimit: 10.0, // 10 SOL per day
    maxSpendPerTx: 2.0,   // 2 SOL per transaction
};

interface SpendState {
    date: string; // YYYY-MM-DD
    spentToday: number;
}

const STATE_PATH = path.join(__dirname, '../.spend_limits_state.json');

function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

function loadState(): SpendState {
    if (fs.existsSync(STATE_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        } catch {
            console.warn('⚠️ Could not read spend limits state, resetting to zero.');
        }
    }
    return { date: getTodayString(), spentToday: 0 };
}

function saveState(state: SpendState) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Checks if a proposed transaction amount violates security limits.
 * @param amount Amount of SOL to spend
 * @returns Object indicating if the spend is allowed and a reason if not.
 */
export function checkSpendLimits(amount: number): { allowed: boolean; reason?: string; config: SecurityConfig } {
    if (amount > DEFAULT_CONFIG.maxSpendPerTx) {
        return {
            allowed: false,
            reason: `Amount (${amount} SOL) exceeds maximum spend per transaction (${DEFAULT_CONFIG.maxSpendPerTx} SOL).`,
            config: DEFAULT_CONFIG
        };
    }

    const state = loadState();
    const today = getTodayString();

    if (state.date !== today) {
        state.date = today;
        state.spentToday = 0;
    }

    if (state.spentToday + amount > DEFAULT_CONFIG.dailySpendLimit) {
        return {
            allowed: false,
            reason: `Amount (${amount} SOL) exceeds daily spend limit (${DEFAULT_CONFIG.dailySpendLimit} SOL). Already spent ${state.spentToday.toFixed(4)} SOL today.`,
            config: DEFAULT_CONFIG
        };
    }

    return { allowed: true, config: DEFAULT_CONFIG };
}

/**
 * Records a successful transaction to update the daily spent total.
 * @param amount Amount of SOL successfully spent
 */
export function recordSpend(amount: number) {
    const state = loadState();
    const today = getTodayString();

    if (state.date !== today) {
        state.date = today;
        state.spentToday = 0;
    }

    state.spentToday += amount;
    saveState(state);
    console.log(`🛡️ Recorded spend of ${amount} SOL. Total spent today: ${state.spentToday.toFixed(4)} / ${DEFAULT_CONFIG.dailySpendLimit} SOL`);
}
