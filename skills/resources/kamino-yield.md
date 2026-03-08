# Kamino Yield Farming

The Earn module (`features/earn.ts`) integrates with Kamino vaults to generate lending/deposit yields.

SDK docs: https://github.com/Kamino-Finance/klend-sdk  
CLI setup: https://kamino.com/docs/build/cli/installation-setup

> **Note**: Kamino does not maintain an active devnet deployment. The current implementation uses simulated vault addresses. The deposit logic returns a prepared signature without executing on-chain — this is intentional for devnet testing.

---

## Vault Configuration (Devnet Simulation)

```typescript
// From features/earn.ts
const KAMINO_DEVNET_VAULTS = [
  {
    symbol: 'SOL',
    name: 'Solana Vault',
    address: 'devkRngFnfp4gBc5a3LsadgbQKdPo8MSZ4prFiNSVmY',
  },
  {
    symbol: 'USDC',
    name: 'USDC Vault',
    address: 'devkRngFnfp4gBc5a3LsadgbQKdPo8MSZ4prFiNSVmY',
  },
];
```

---

## Example: Load Available Vaults

```typescript
// From features/earn.ts
export async function getAvailableVaults(connection: Connection): Promise<any[]> {
  console.log('📊 Loading Kamino devnet vaults...');

  // Simulated — production would call Kamino SDK to fetch on-chain reserve data
  const vaults = KAMINO_DEVNET_VAULTS.map(v => ({
    ...v,
    tvl: 0,
    apy: 0.05,   // Simulated 5% APY
    exists: false,
  }));

  console.log(`✅ Loaded ${vaults.length} vaults`);
  return vaults;
}
```

---

## Example: AI Vault Selection

The AI is given the top 10 vaults ranked by APY and TVL, and responds with only an index number:

```typescript
// From features/earn.ts
export async function selectBestVault(agent: AgentChat, vaults: any[]): Promise<any> {
  if (vaults.length === 0) throw new Error('No vaults available');

  const vaultsInfo = vaults.slice(0, 10).map((vault, idx) => {
    const apy = (vault.apy * 100).toFixed(2);
    return `${idx + 1}. ${vault.symbol} | APY: ${apy}% | TVL: $${parseFloat(vault.tvl).toLocaleString()}`;
  }).join('\n');

  const prompt = `Select the best vault for earning yield. Choose by number (1-${Math.min(vaults.length, 10)}):

${vaultsInfo}

Best = highest APY + stable asset. Respond with ONLY the number:`;

  const response = await agent.chat(prompt);
  const vaultIndex = parseInt(response.trim()) - 1;

  // Fallback to highest APY if AI response is invalid
  if (isNaN(vaultIndex) || vaultIndex < 0 || vaultIndex >= Math.min(vaults.length, 10)) {
    return vaults.reduce((best, vault) => (vault.apy || 0) > (best.apy || 0) ? vault : best);
  }

  return vaults[vaultIndex];
}
```

---

## Example: AI Deposit Amount

```typescript
// From features/earn.ts
export async function getAIDepositAmount(
  agent: AgentChat,
  vaultSymbol: string,
  solBalance: number
): Promise<number> {
  const maxAmount = Math.min(solBalance * 0.3, 2); // Hard cap: 2 SOL

  const prompt = `You are an earning AI agent. Decide how much SOL to deposit into Kamino ${vaultSymbol} vault.

Your SOL Balance: ${solBalance.toFixed(4)} SOL
Recommended Range: 0.1 to ${maxAmount.toFixed(4)} SOL

Consider:
- Don't use all your balance, keep some for other operations
- Start with a reasonable amount
- Typical range is 0.1 to 1 SOL

Respond with ONLY a number (e.g., 0.5):`;

  const response = await agent.chat(prompt);
  const amount = parseFloat(response.trim());

  if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
    return Math.min(0.3, maxAmount); // Safe fallback
  }
  return amount;
}
```

---

## Example: Deposit to Vault (Simulated on Devnet)

```typescript
// From features/earn.ts
export async function depositToVault(
  connection: Connection,
  wallet: Keypair,
  vaultAddress: string,
  depositAmount: number
): Promise<any> {
  console.log(`🚀 Depositing ${depositAmount} tokens to Kamino vault...`);
  console.log(`✅ Found vault: ${vaultAddress}`);
  console.log(`📝 Building deposit instruction...`);
  console.log(`💰 Deposit amount: ${depositAmount} tokens`);
  console.log(`🔄 Preparing transaction...`);

  // NOTE: Production would use Kamino SDK to build and submit real on-chain instruction.
  // Devnet simulation returns a mock signature.
  const sig = 'devnet_' + Math.random().toString(36).substring(7);

  console.log(`✅ Deposit prepared: ${sig}`);
  return {
    signature: sig,
    vault: vaultAddress,
    amount: depositAmount,
    status: 'prepared',
  };
}
```

---

## Full Flow (as used in EarnController)

```typescript
// From controllers/EarnController.ts
const allVaults = await getAvailableVaults(this.state.connection);
if (allVaults.length === 0) return res.status(400).json({ error: 'No vaults available' });

const selectedVault = await selectBestVault(this.state.chat, allVaults);
if (!selectedVault?.address) return res.status(400).json({ error: 'Failed to select a vault' });

const depositAmount = await getAIDepositAmount(this.state.chat, selectedVault.symbol, balance);

// Always check spend limits before executing
const limitCheck = checkSpendLimits(depositAmount);
if (!limitCheck.allowed) return res.status(400).json({ error: limitCheck.reason });

const result = await depositToVault(
  this.state.connection,
  this.state.wallet,
  selectedVault.address,
  depositAmount
);

recordSpend(depositAmount); // Track it against the daily limit
```

---

## Terminology Note

The UI and API responses use **"reserves"** and **"totalDeposits"** — not `vaults` and `tvl`. This was standardized to match between `ChatController`, `EarnController`, and `app.js`:

```typescript
// Correct response shape from EarnController
res.json({
  reserves: vaults.map((r: any) => ({
    symbol: r.symbol,
    name: r.name,
    apy: (r.apy * 100).toFixed(2),
    totalDeposits: parseFloat(r.tvl || 0).toLocaleString(),
  }))
});
```
