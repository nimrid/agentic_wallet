import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair } from '@solana/web3.js';
import { sendSol } from './transaction';
import { recordSpend, checkSpendLimits } from './spendLimits';

export interface RecurringTransfer {
    id: string;
    recipient: string;
    amount: number;
    frequency: 'daily' | 'weekly' | 'monthly';
    nextRunDate: string;
    createdAt: string;
    lastRunDate?: string;
}

const DATA_DIR = path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getStatePath(agentId: string): string {
    const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(DATA_DIR, `recurring_transfers_${safe}.json`);
}

function loadState(agentId: string): RecurringTransfer[] {
    const statePath = getStatePath(agentId);
    if (fs.existsSync(statePath)) {
        try {
            return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        } catch {
            return [];
        }
    }
    return [];
}

function saveState(agentId: string, state: RecurringTransfer[]) {
    fs.writeFileSync(getStatePath(agentId), JSON.stringify(state, null, 2));
}

export function addRecurringTransfer(agentId: string, transfer: Omit<RecurringTransfer, 'id'>): RecurringTransfer {
    const state = loadState(agentId);
    const newTransfer = {
        ...transfer,
        id: Math.random().toString(36).substring(7)
    };
    state.push(newTransfer);
    saveState(agentId, state);
    return newTransfer;
}

export function getRecurringTransfers(agentId: string): RecurringTransfer[] {
    return loadState(agentId);
}

export function removeRecurringTransfer(agentId: string, id: string): boolean {
    const state = loadState(agentId);
    const newState = state.filter(t => t.id !== id);
    if (newState.length !== state.length) {
        saveState(agentId, newState);
        return true;
    }
    return false;
}

function advanceDate(from: Date, frequency: RecurringTransfer['frequency']): Date {
    const d = new Date(from);
    if (frequency === 'daily') d.setDate(d.getDate() + 1);
    else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    return d;
}

export async function processRecurringTransfers(agentId: string, connection: Connection, wallet: Keypair) {
    const state = loadState(agentId);
    const now = new Date();
    let updated = false;

    for (const transfer of state) {
        const nextRun = new Date(transfer.nextRunDate);
        if (now >= nextRun) {
            console.log(`🕒 [${agentId}] Executing recurring transfer → ${transfer.recipient} (${transfer.amount} SOL)`);

            // Check per-agent spend limits
            const limitCheck = checkSpendLimits(transfer.amount, agentId);
            if (!limitCheck.allowed) {
                console.warn(`⚠️  [${agentId}] Skipping recurring transfer: ${limitCheck.reason}`);
                continue;
            }

            try {
                await sendSol(connection, wallet, transfer.recipient, transfer.amount);
                recordSpend(transfer.amount, agentId);
                console.log(`✅ [${agentId}] Recurring transfer successful!`);
                transfer.lastRunDate = now.toISOString();
            } catch (error) {
                console.error(`❌ [${agentId}] Recurring transfer failed for ${transfer.recipient}:`, error);
            }

            // Always advance the next run date (even on failure) to avoid tight retry loops
            transfer.nextRunDate = advanceDate(now, transfer.frequency).toISOString();
            updated = true;
        }
    }

    if (updated) {
        saveState(agentId, state);
    }
}
