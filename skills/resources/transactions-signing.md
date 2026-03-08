# Sending & Signing Transactions

This covers the core transaction utilities in `core/transaction.ts`, `core/airdrop.ts`, and how `WalletController.ts` orchestrates them with safety checks.

---

## Key Modules

| File | Purpose |
|------|---------|
| `core/transaction.ts` | SOL transfer, SOL balance, SPL token balance |
| `core/airdrop.ts` | Devnet airdrop request + confirmation |
| `core/spendLimits.ts` | Safety gate before any outgoing transaction |
| `controllers/WalletController.ts` | Express route handlers wrapping all of the above |

---

## Token Mint Addresses (WalletController)

```typescript
// From controllers/WalletController.ts
const USDC_MINT    = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Circle Devnet USDC
const DEVUSDC_MINT = 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k'; // Orca native Devnet USDC
```

---

## Example: Send SOL

Uses `SystemProgram.transfer` to build and sign a native SOL transfer. Amount passed as SOL (not lamports) — the function handles conversion internally via `LAMPORTS_PER_SOL`.

```typescript
// From core/transaction.ts
import {
  Connection, Keypair, PublicKey,
  SystemProgram, Transaction,
  LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from '@solana/web3.js';

export async function sendSol(
  connection: Connection,
  fromWallet: Keypair,
  toAddress: string,
  amount: number
): Promise<string> {
  const toPubkey = new PublicKey(toAddress);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromWallet]);
  return signature;
}
```

---

## Example: Get SOL Balance

```typescript
// From core/transaction.ts
export async function getBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL; // Returns SOL, not lamports
}
```

---

## Example: Get SPL Token Balance (with safe error handling)

Derives the ATA for any SPL mint and returns the balance. Returns `0` instead of throwing if the token account doesn't exist yet.

```typescript
// From core/transaction.ts
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

export async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  tokenMint: string
): Promise<number> {
  try {
    const tokenMintPublicKey = new PublicKey(tokenMint);
    const associatedTokenAddress = await getAssociatedTokenAddress(tokenMintPublicKey, wallet);

    const accountInfo = await getAccount(connection, associatedTokenAddress);
    return Number(accountInfo.amount) / 1e6; // Assumes 6 decimals (USDC)
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0; // Normal for new wallets — not an error condition
    }
    console.error('Error fetching token balance:', error);
    return 0;
  }
}
```

---

## Example: Full Wallet Info Response

`WalletController.getWalletInfo` fetches all four balances in parallel and returns them in one JSON payload:

```typescript
// From controllers/WalletController.ts
getWalletInfo = async (req: Request, res: Response) => {
  const balance       = await getBalance(this.state.connection, this.state.wallet.publicKey);
  const usdcBalance   = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, USDC_MINT);
  const devUsdcBalance = await getTokenBalance(this.state.connection, this.state.wallet.publicKey, DEVUSDC_MINT);
  const mSolBalance   = await getMSolBalance(this.state.connection, this.state.wallet);

  res.json({
    publicKey:    this.state.wallet.publicKey.toString(),
    solBalance:   balance,
    usdcBalance,
    devUsdcBalance,
    mSolBalance,
  });
};
```

---

## Example: Send SOL with Safety Gate (WalletController)

Every outgoing SOL transfer goes through `checkSpendLimits` first:

```typescript
// From controllers/WalletController.ts
sendSol = async (req: Request, res: Response) => {
  const { recipient, amount } = req.body;

  // 1. Balance check
  const currentBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);
  const estimatedFee = 0.00001;
  if (amount + estimatedFee > currentBalance) {
    return res.status(400).json({
      error: `Insufficient balance. Need ${amount + estimatedFee} SOL, have ${currentBalance} SOL`
    });
  }

  // 2. Spend limit gate
  const limitCheck = checkSpendLimits(amount);
  if (!limitCheck.allowed) {
    return res.status(400).json({ error: limitCheck.reason });
  }

  // 3. Execute & record
  const signature = await sendSol(this.state.connection, this.state.wallet, recipient, amount);
  recordSpend(amount);

  const newBalance = await getBalance(this.state.connection, this.state.wallet.publicKey);
  res.json({ success: true, signature, newBalance, message: `Sent ${amount} SOL to ${recipient}` });
};
```

---

## Example: Request Devnet Airdrop (AI-Gated)

The airdrop is not free-for-all — the AI agent reviews the request and approves or denies it based on current balance:

```typescript
// From controllers/WalletController.ts
requestAirdrop = async (req: Request, res: Response) => {
  const targetAddress = req.body.walletAddress || this.state.wallet.publicKey.toString();
  const balance = await getBalance(this.state.connection, new PublicKey(targetAddress));

  const agentPrompt = `A user is requesting an airdrop for wallet: ${targetAddress}
Current Balance: ${balance.toFixed(4)} SOL

You have the power to approve or deny this airdrop request. Consider:
- The wallet balance is ${balance.toFixed(4)} SOL.
- Legitimate requests usually happen when balance is low (< 0.5 SOL).
- How much SOL should be airdropped? (1-5 SOL typical)
- Should you approve this?
Respond with ONLY:
- "APPROVE: X" where X is the amount (e.g., "APPROVE: 2")
- "DENY" if you don't approve`;

  const agentDecision = await this.state.chat.chat(agentPrompt);

  if (agentDecision.toUpperCase().includes('APPROVE')) {
    const match = agentDecision.match(/APPROVE:\s*(\d+(?:\.\d+)?)/i);
    const airdropAmount = match ? parseFloat(match[1]) : 2;

    const result = await requestDevnetAirdrop(targetAddress, airdropAmount);
    if (result.success) {
      const newBalance = await getBalance(this.state.connection, new PublicKey(targetAddress));
      res.json({ success: true, signature: result.signature, newBalance, agentDecision: `Approved airdrop of ${airdropAmount} SOL` });
    }
  } else {
    res.status(400).json({ success: false, message: 'Airdrop request denied', agentDecision: 'Agent denied the airdrop request' });
  }
};
```

---

## Example: Raw Airdrop Execution (core/airdrop.ts)

```typescript
// From core/airdrop.ts
export async function requestDevnetAirdrop(
  walletAddress: string,
  solAmount: number = 2
): Promise<{ success: boolean; signature?: string; message: string }> {
  const publicKey = new PublicKey(walletAddress);

  // Convert SOL → lamports for the RPC call
  const signature = await DEVNET_CONNECTION.requestAirdrop(publicKey, solAmount * LAMPORTS_PER_SOL);

  // Confirm with blockhash strategy (not just signature polling)
  const latestBlockHash = await DEVNET_CONNECTION.getLatestBlockhash();
  await DEVNET_CONNECTION.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature,
  });

  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  console.log(`✅ Airdrop successful! View: ${explorerUrl}`);

  return { success: true, signature, message: `Successfully airdropped ${solAmount} SOL to ${walletAddress}` };
}
```

---

## Transaction Confirmation Strategy

All transactions in this codebase use `sendAndConfirmTransaction` with default `'confirmed'` commitment. The one exception is the airdrop, which uses the **blockhash + lastValidBlockHeight** strategy to avoid timeout issues on devnet:

```typescript
// Robust confirmation (used in core/airdrop.ts)
const latestBlockHash = await connection.getLatestBlockhash();
await connection.confirmTransaction({
  blockhash: latestBlockHash.blockhash,
  lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  signature,
});

// Simple confirmation (used in staking, liquidity, trading)
const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
```
