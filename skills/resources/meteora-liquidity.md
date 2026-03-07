# Meteora DLMM Liquidity Provision

This module allows the agent to autonomously provide single-sided SOL liquidity to concentrated liquidity pools on Meteora.

### Core Functions

- `getAvailablePools(connection)`: Fetches active DLMM pools from Meteora API. Filters out empty or blacklisted pools.
- `addLiquidity(connection, wallet, poolAddress, solAmount)`: The primary action. Creates a Spot DLMM strategy spanning +/- 10 bins around the active bin, depositing only SOL (Token Y).
- `getUserPositions(connection, wallet, poolAddress)`: Retrieves active liquidity bin ranges for the user.
- `closePosition(connection, wallet, poolAddress, positionAddress)`: Withdraws all liquidity and closes the DLMM position.

### AI Integration
Before `addLiquidity` is called, `agentTools.ts` is queried using `getAISolAmount` to determine the exact `solAmount`, constrained by `spendLimits.ts` (max 2.0 SOL).

### Example Usage
```typescript
import { addLiquidity } from '@features/liquidity';

const result = await addLiquidity(
  connection,
  wallet,
  'Pool_Address_String',
  0.5 // Safe SOL amount decided by AI
);

console.log('Tx Hash:', result.txHash);
console.log('Position Account:', result.positionPubKey);
```
