# Marinade Finance Liquid Staking

The Staking module (`features/staking.ts`) handles autonomous interactions with the Marinade Program, exchanging SOL for yielding mSOL.

SDK docs: https://github.com/marinade-finance/marinade-ts-sdk

---

## Core Functions

- `initializeMarinade(connection, wallet)`: Creates a `MarinadeConfig` with the wallet's public key and returns a `Marinade` instance.
- `stakeSol(connection, wallet, amountSol)`: Converts SOL → mSOL. Internally converts to lamports using `BN`, calls `marinade.deposit()`, and signs with `sendAndConfirmTransaction`.
- `unstakeSol(connection, wallet, amountLamports)`: Liquid unstake via `marinade.liquidUnstake()`. Note: takes **lamports** not SOL.
- `getMSolBalance(connection, wallet)`: Derives the ATA for mSOL mint, reads the balance, and returns 0 instead of crashing on `TokenAccountNotFoundError`.
- `getStakingStats(connection)`: Returns hardcoded 8% APY + live TVL from `marinadeState.availableReserveBalance`.

---

## Example: Initialize Marinade

```typescript
// From features/staking.ts
import { Marinade, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk';

export async function initializeMarinade(
  connection: Connection,
  wallet: Keypair
): Promise<Marinade> {
  const config = new MarinadeConfig({
    connection,
    publicKey: wallet.publicKey,
  });
  return new Marinade(config);
}
```

---

## Example: Stake SOL → mSOL

```typescript
// From features/staking.ts
export async function stakeSol(
  connection: Connection,
  wallet: Keypair,
  amountSol: number
): Promise<{ signature: string; mSolTokenAccount: string }> {
  const marinade = await initializeMarinade(connection, wallet);
  const amountLamports = new BN(Math.floor(amountSol * 1e9));

  console.log(`Staking ${amountSol} SOL (${amountLamports.toString()} lamports) with Marinade...`);

  const { associatedMSolTokenAccountAddress, transaction } = await marinade.deposit(amountLamports);
  const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);

  console.log(`Staking successful! Signature: ${signature}`);
  return {
    signature,
    mSolTokenAccount: associatedMSolTokenAccountAddress.toString(),
  };
}
```

---

## Example: Get mSOL Balance (Safe — handles empty wallets)

```typescript
// From features/staking.ts
export async function getMSolBalance(connection: Connection, wallet: Keypair): Promise<number> {
  try {
    const marinade = await initializeMarinade(connection, wallet);
    const marinadeState = await marinade.getMarinadeState();

    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
    const mSolMint = marinadeState.mSolMintAddress;
    const associatedTokenAddress = await getAssociatedTokenAddress(mSolMint, wallet.publicKey);

    const accountInfo = await getAccount(connection, associatedTokenAddress);
    return Number(accountInfo.amount) / 1e9; // mSOL has 9 decimals
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0; // Expected for new wallets — not an error
    }
    console.error('Error fetching mSOL balance:', error);
    return 0;
  }
}
```

---

## AI Sizing: How Much to Stake

The `getStakingAmount` function in `agentTools.ts` asks the AI to decide the stake amount within a safe cap:

```typescript
// From features/agentTools.ts
export async function getStakingAmount(agent: AgentChat, solBalance: number): Promise<number> {
  const maxAmount = Math.min(solBalance * 0.7, 2.0); // Hard cap: 2 SOL

  const prompt = `You are a staking AI agent. Decide how much SOL to stake with Marinade.

Your SOL Balance: ${solBalance.toFixed(4)} SOL
STRICT LIMIT: You cannot spend more than 2.0 SOL per transaction.
Recommended Range: 0.1 to ${maxAmount.toFixed(4)} SOL

Consider:
- Keep some SOL for transaction fees and trading
- Staking locks your SOL but generates yield
- Typical range is 0.1 to 2.0 SOL

Respond with ONLY a number (e.g., 1.5):`;

  const response = await agent.chat(prompt);
  const amount = parseFloat(response.trim());
  if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
    return Math.min(1.0, maxAmount); // Safe fallback
  }
  return amount;
}
```
