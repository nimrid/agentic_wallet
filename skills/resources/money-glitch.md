# The Money Glitch: Autonomous AI Loop

The **Money Glitch** is the centerpiece of the Agent Wallet's autonomous operations. It leverages Express.js, a front-end terminal UI (`app.js`), and multiple DeFi integrations (Marinade, Orca, Meteora) into a recursive chain.

## How It Works

The loop relies on `setInterval` in `app.js` to dispatch sequential requests to the `/api/chat` endpoint. Once started, the AI is prompted repeatedly to perform actions.

### 1. The Trigger (`app.js`)

When the user types `money glitch`, the AI responds with an action object that starts the cycle and displays the Kill Switch.

```javascript
// Function in public/app.js
function startChain() {
  addBotMessage('🔄 Auto-pilot engaged. Starting feature loop...');
  chainInterval = setInterval(async () => {
    // Determine the current step in the sequence
    const action = getNextFeature(); // Loops: Stake -> Trade -> Liquidity -> Earn

    // Send the simulated user command to the AI
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: action })
    });
    
    // Automatically click the execute button when the AI prompts
    setTimeout(executeAction, 5000); 

  }, 30000); // 30-Second Cycles
}
```

### 2. The Kill Switch

Because this loop can drain SOL rapidly or hit the daily spend limit if unchecked, an emergency stop is provided.

```javascript
function stopMoneyGlitch() {
  clearInterval(chainInterval);
  document.getElementById('killSwitch').classList.add('hidden');
  addBotMessage('🛑 Money Glitch terminated. Returning to manual mode.');
}
```

### 3. Server-Side Execution

Each action hit by the Money Glitch loop routes through `ChatController.ts` and invokes the AI (`AgentChat`) to calculate transaction sizes before routing to the respective Feature Controller (e.g. `EarnController.ts` or `LiquidityController.ts`). 

> **Important**: All automated transactions are constrained by `checkSpendLimits` centrally. No loop can exceed 2.0 SOL per execution.
