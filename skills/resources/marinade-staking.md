# Marinade Finance Liquid Staking

The Staking module (`features/staking.ts`) handles autonomous interactions with the Marinade Program, exchanging SOL for yielding mSOL.

### Core Functions

- `getStakingStats(connection)`: Fetches global mSOL APY and TVL from Marinade State.
- `stakeSol(connection, wallet, amount)`: Converts standard SOL into mSOL tokens at the prevailing exchange rate.
- `unstakeSol(connection, wallet, amountLamports)`: Triggers delayed unstaking matching standard Marinade operations (takes ~1 epoch).
- `getMSolBalance(connection, wallet)`: Safely fetches the mSOL balance. Catching `TokenAccountNotFoundError` to avoid application crashes on uninitiated wallets.

### Example Usage
```typescript
import { stakeSol, getStakingStats } from '@features/staking';
import { getStakingAmount } from '@features/agentTools';

// The AI computes a safe amount based on current balances
const stakeAmount = await getStakingAmount(chatAgent, currentSolBalance);

// Stake the determined amount
const result = await stakeSol(connection, wallet, stakeAmount);
console.log('Staked to account:', result.mSolTokenAccount);
```
