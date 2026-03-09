# Solend Yield Earning

The Earn module (`features/earn.ts`) integrates with Solend's protocol to generate yield by depositing assets into reserves.

SDK docs: https://sdk.solend.fi/

---

## Core Functions

- `getAvailableVaults(connection)`: Initializes `SolendMarket`, loads reserves, and filters for supported tokens ('SOL', 'USDC', 'USDT'). It handles Devnet-specific "weird" values (APY/TVL) by providing sane defaults when data is missing.
- `selectBestVault(agent, vaults, wallet, connection)`: AI-guided selection that checks the **actual** token balance for each reserve's specific mint address before recommending a deposit.
- `getAIDepositAmountForReserve(agent, reserve, walletAddress, connection)`: Prompts the AI to decide a safe deposit amount based on the user's specific token balance and predefined safety caps.
- `depositToVault(connection, wallet, reserve, depositAmount)`: Executes the deposit using `SolendAction.buildDepositTxns`. It handles amount scaling based on token decimals and Confirmations.

---

## Example: Load Available Reserves

```typescript
// From features/earn.ts
export async function getAvailableVaults(connection: Connection): Promise<ReserveInfo[]> {
  const isDevnet = connection.rpcEndpoint.includes('devnet');
  const env = isDevnet ? 'devnet' : 'production';

  const market = await SolendMarket.initialize(connection, env);
  await market.loadReserves();

  return market.reserves
    .filter(r => SUPPORTED_TOKENS.includes(r.config.liquidityToken.symbol))
    .map(r => ({
      symbol: r.config.liquidityToken.symbol,
      address: r.config.address,
      mintAddress: r.config.liquidityToken.mint,
      supplyApy: Number(r.stats?.supplyInterestAPY) || 0,
      tvlUsd: Number(r.stats?.totalDepositsWads?.toString() || 0) / 1e18,
      decimals: r.config.liquidityToken.decimals,
    }));
}
```

---

## Example: AI Reserve Selection (Mint-Aware)

The AI is informed of the user's **actual** balance for each specific mint (e.g., Circle USDC vs Solend Dev USDC) to avoid invalid deposit attempts:

```typescript
// From features/earn.ts
export async function selectBestVault(
  agent: AgentChat,
  vaults: ReserveInfo[],
  wallet: PublicKey,
  connection: Connection
): Promise<ReserveInfo> {
  const vaultsWithBalances = await Promise.all(vaults.map(async (v) => {
    let bal = 0;
    if (v.symbol === 'SOL') {
      bal = await getBalance(connection, wallet);
    } else {
      bal = await getTokenBalance(connection, wallet, v.mintAddress);
    }
    return { ...v, balance: bal };
  }));

  // AI prompt includes the real balance for each mint...
  const prompt = `Select the best Solend reserve... You have ${v.balance} ${v.symbol}...`;
  // ...
}
```

---

## Example: Execute Deposit

Solend requires the amount to be passed in **base units** (scaled by decimals).

```typescript
// From features/earn.ts
export async function depositToVault(
  connection: Connection,
  wallet: Keypair,
  reserve: ReserveInfo,
  depositAmount: number
): Promise<any> {
  // Scale units (e.g., 0.5 SOL -> 500,000,000)
  const scaledAmount = Math.floor(depositAmount * Math.pow(10, reserve.decimals)).toString();

  const solendAction = await SolendAction.buildDepositTxns(
    connection,
    scaledAmount,
    reserve.symbol,
    wallet.publicKey,
    env
  );

  // Send and confirm transactions...
  await solendAction.sendTransactions(async (txn) => {
    txn.partialSign(wallet);
    return await connection.sendRawTransaction(txn.serialize());
  });
}
```

---

## Devnet Specifics

Solend on Devnet uses specific mock mints that differ from standard faucets. The system automatically tracks:
- **SOL**: `So11111111111111111111111111111111111111112`
- **USDC (Solend Dev)**: `zVzi5VAf4qMEwzv7NXECVx5v2pQ7xnqVVjCXZwS9XzA`

The `ChatController` and `EarnController` are configured to monitor these specific mints to ensure the Agent knows exactly where the yield-bearing funds are.
