# Safety & Spend Limits

The `SpendLimits` module (`core/spendLimits.ts`) is the primary defense against rogue AI decisions and autonomous feedback loops.

### Protocol Parameters

- **`MAX_SPEND_PER_TX`**: `2.0 SOL`
- **`DAILY_SPEND_LIMIT`**: `10.0 SOL`

### Core Functions

- **`checkSpendLimits(amount)`**:
  - Validates if the intended transaction `amount` exceeds `MAX_SPEND_PER_TX`.
  - Aggregates the `recentSpends` array to determine if the `DAILY_SPEND_LIMIT` has been exceeded in the past 24 hours.
  - Returns: `{ allowed: boolean, reason?: string }`

- **`recordSpend(amount)`**:
  - Pushes an executed transaction `{ amount, timestamp }` to the local cache.
  - Clears out log entries older than 24 hours.

### Example Integration
Before signing *any* Solana transaction, `checkSpendLimits` must be invoked.

```typescript
import { checkSpendLimits, recordSpend } from '@core/spendLimits';

const decisionAmount = await getAiDecision(); // i.e., 2.5 SOL

const limitCheck = checkSpendLimits(decisionAmount);

if (!limitCheck.allowed) {
  // Gracefully reject the AI's parameter
  return { error: limitCheck.reason }; 
  // e.g., "Transaction exceeds 2 SOL limit"
}

// Fire Transaction
await executeTransaction(decisionAmount);

// Successful tx, track it
recordSpend(decisionAmount);
```

### The Kill Switch (`index.html` & `app.js`)
At the UI level, the safety protocol relies on the "Kill Switch" to halt the `setInterval` orchestrating the chain of backend requests, preventing daily limits from being hit accidentally when the user isn't watching the terminal.
