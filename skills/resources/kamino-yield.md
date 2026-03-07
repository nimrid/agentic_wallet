# Kamino Yield Farming

The Earn module (`features/earn.ts`) integrates with Kamino vaults to generate lending/deposit yields (e.g., SOL or USDC vaults).

### Core Architecture

- **`getAvailableVaults(connection)`**: Queries active Kamino vaults on the network.
- **`selectBestVault(agent, vaults)`**: Submits the top 10 vault statistics to the Groq AI agent. The AI decides which vault is best based on APY, Asset type, and TVL. Returns the single top reserve.
- **`getAIDepositAmount(agent, symbol, balance)`**: Determines the maximum acceptable amount mathematically (`min(0.3 * bal, 2)`), and allows the AI agent to finalize the specific drop based on historical risk appetite.
- **`depositToVault(connection, wallet, vault, amount)`**: Prepares or executes a token injection into the specific KAMINO reserve structure.

### Smart Terminology
- **Vault vs. Reserve**: The UI strictly calls these "Reserves" or "Earning Pools." Wait until the backend parses "pools" before mapping correctly to the frontend's expected properties (`totalDeposits`, `reserves`).

### Deposit Flow
```typescript
import { selectBestVault, getAIDepositAmount, depositToVault } from '@features/earn';

const selectedVault = await selectBestVault(chatModel, allVaults);
const depositAmount = await getAIDepositAmount(chatModel, selectedVault.symbol, balance);

// Check limits, then:
const result = depositToVault(connection, wallet, selectedVault.address, depositAmount);
// Record spend
```
