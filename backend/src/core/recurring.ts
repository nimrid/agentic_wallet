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

const STATE_PATH = path.join(__dirname, '../.recurring_transfers.json');

function loadState(): RecurringTransfer[] {
    if (fs.existsSync(STATE_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        } catch {
            return [];
        }
    }
    return [];
}

function saveState(state: RecurringTransfer[]) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function addRecurringTransfer(transfer: Omit<RecurringTransfer, 'id'>): RecurringTransfer {
    const state = loadState();
    const newTransfer = {
        ...transfer,
        id: Math.random().toString(36).substring(7)
    };
    state.push(newTransfer);
    saveState(state);
    return newTransfer;
}

export function getRecurringTransfers(): RecurringTransfer[] {
    return loadState();
}

export function removeRecurringTransfer(id: string) {
    const state = loadState();
    const newState = state.filter(t => t.id !== id);
    if (newState.length !== state.length) {
        saveState(newState);
        return true;
    }
    return false;
}

export async function processRecurringTransfers(connection: Connection, wallet: Keypair) {
    const state = loadState();
    const now = new Date();
    let updated = false;

    for (const transfer of state) {
        const nextRun = new Date(transfer.nextRunDate);
        if (now >= nextRun) {
            console.log(`🕒 Executing recurring transfer for ${transfer.recipient} (${transfer.amount} SOL)...`);

            // Check spend limits
            const limitCheck = checkSpendLimits(transfer.amount);
            if (!limitCheck.allowed) {
                console.warn(`⚠️ Skipping recurring transfer: ${limitCheck.reason}`);
                continue;
            }

            try {
                await sendSol(connection, wallet, transfer.recipient, transfer.amount);
                recordSpend(transfer.amount);
                console.log(`✅ Recurring transfer successful!`);

                // Update next run date
                transfer.lastRunDate = now.toISOString();
                const nextDate = new Date(now);
                if (transfer.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (transfer.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (transfer.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

                transfer.nextRunDate = nextDate.toISOString();
                updated = true;
            } catch (error) {
                console.error(`❌ Recurring transfer failed for ${transfer.recipient}:`, error);

                // Still push the next run date forward to avoid infinite retry loops if it keeps failing due to balance etc.
                const nextDate = new Date(now);
                if (transfer.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (transfer.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (transfer.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                transfer.nextRunDate = nextDate.toISOString();
                updated = true;
            }
        }
    }

    if (updated) {
        saveState(state);
    }
}
