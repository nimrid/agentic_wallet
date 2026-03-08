# Meteora DLMM Liquidity Provision

This module allows the agent to autonomously provide single-sided SOL liquidity to concentrated liquidity pools on Meteora.

SDK docs: https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started

---

## Core Functions

- `getAvailablePools(connection)`: Hits `https://dlmm-api.devnet.meteora.ag/pair/all`, filters out hidden/blacklisted/zero-liquidity pools. Returns top 35.
- `addLiquidity(connection, wallet, poolAddress, solAmount)`: Creates a `StrategyType.Spot` DLMM position spanning 10 bins above the active bin. Deposits only Token Y (SOL). Creates a new position `Keypair` per tx.
- `getUserPositions(connection, wallet, poolAddress)`: Returns all active bin ranges for the user in a given pool.
- `closePosition(connection, wallet, poolAddress, positionAddress)`: Closes the DLMM position and withdraws liquidity.

---

## Example: Fetch Active Pools

```typescript
// From features/liquidity.ts
export async function getAvailablePools(connection: Connection): Promise<any[]> {
  const response = await fetch('https://dlmm-api.devnet.meteora.ag/pair/all');
  const text = await response.text();
  const pools = JSON.parse(text);

  const filtered = Array.isArray(pools)
    ? pools.filter((pool: any) =>
        !pool.hide &&
        !pool.is_blacklisted &&
        pool.liquidity &&
        parseFloat(pool.liquidity) > 0
      )
    : [];

  console.log(`Found ${filtered.length} devnet pools with liquidity`);
  return filtered.slice(0, 35);
}
```

---

## Example: Add Liquidity (Spot — Single-Sided SOL)

```typescript
// From features/liquidity.ts
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';

export async function addLiquidity(
  connection: Connection,
  wallet: Keypair,
  poolAddress: string,
  solAmount: number
) {
  // Create the DLMM pool instance (10 second timeout)
  const dlmmPool = await Promise.race([
    DLMM.create(connection, new PublicKey(poolAddress)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Pool fetch timeout')), 10000))
  ]);

  const activeBin = await dlmmPool.getActiveBin();
  if (!activeBin || activeBin.binId === undefined) {
    throw new Error('This pool is empty. Please select a pool with existing liquidity.');
  }

  console.log(`✅ Active bin ID: ${activeBin.binId}`);

  // Single-sided SOL deposit (Token Y only — X = 0)
  const totalXAmount = new BN(0);
  const totalYAmount = new BN(Math.floor(solAmount * 1e9));

  const TOTAL_RANGE_INTERVAL = 10;
  const minBinId = activeBin.binId;
  const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL * 2;

  // Each position needs its own keypair
  const newBalancePosition = new Keypair();

  const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: newBalancePosition.publicKey,
    user: wallet.publicKey,
    totalXAmount,
    totalYAmount,
    strategy: {
      maxBinId,
      minBinId,
      strategyType: StrategyType.Spot,
    },
  });

  const txHash = await sendAndConfirmTransaction(
    connection,
    createPositionTx,
    [wallet, newBalancePosition]   // Both signers required
  );

  console.log(`✅ Transaction confirmed: ${txHash}`);
  return { txHash, positionPubKey: newBalancePosition.publicKey.toString() };
}
```

---

## Example: Close a Position

```typescript
// From features/liquidity.ts
export async function closePosition(
  connection: Connection,
  wallet: Keypair,
  poolAddress: string,
  positionAddress: string
) {
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(wallet.publicKey);

  const position = userPositions.find(
    (pos: any) => pos.publicKey.toString() === positionAddress
  );
  if (!position) throw new Error('Position not found');

  const closePositionTx = await dlmmPool.closePosition({
    owner: wallet.publicKey,
    position,
  });

  return await sendAndConfirmTransaction(connection, closePositionTx, [wallet]);
}
```

---

## AI Sizing: How Much SOL to Deposit

```typescript
// From features/agentTools.ts
export async function getAISolAmount(agent: AgentChat, poolName: string, solBalance: number): Promise<number> {
  const maxAmount = Math.min(solBalance * 0.5, 2.0); // Hard cap: 2 SOL

  const prompt = `You are a liquidity provider AI agent. Decide how much SOL to deposit into this pool.

Pool: ${poolName}
Your SOL Balance: ${solBalance.toFixed(4)} SOL
STRICT LIMIT: You cannot spend more than 2.0 SOL per transaction.
Recommended Range: 0.1 to ${maxAmount.toFixed(4)} SOL

Consider:
- Don't use all your balance, keep some for trading
- Start with a reasonable amount
- Typical range is 0.1 to 1 SOL

Respond with ONLY a number (e.g., 0.5):`;

  const response = await agent.chat(prompt);
  const amount = parseFloat(response.trim());
  if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
    return Math.min(0.5, maxAmount); // Safe fallback
  }
  return amount;
}
```
