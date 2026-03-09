let isLoading = false;
let pendingAction = null;
let tradingStreamInterval = null;
let lastHistoryLength = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadWalletInfo();
  addSystemMessage('👋 Welcome to Money Glitch! I can help with staking, trading, liquidity, transfers, and more. What would you like to do?');

  // Refresh wallet info every 10 seconds
  setInterval(loadWalletInfo, 10000);
});

// Load wallet information
async function loadWalletInfo() {
  try {
    const response = await fetch('/api/wallet');
    const data = await response.json();

    document.getElementById('publicKey').textContent = data.publicKey;
    document.getElementById('solBalance').textContent = data.solBalance.toFixed(4);
    document.getElementById('msolBalance').textContent = data.mSolBalance.toFixed(4);
    document.getElementById('usdcBalance').textContent = data.usdcBalance.toFixed(2);
    document.getElementById('devUsdcBalance').textContent = data.devUsdcBalance.toFixed(2);

    // Update header
    document.getElementById('walletInfo').textContent = `${data.solBalance.toFixed(2)} SOL | ${data.usdcBalance.toFixed(2)} USDC`;
  } catch (error) {
    console.error('Error loading wallet info:', error);
  }
}

// Handle wallet button click
document.getElementById('walletBtn').addEventListener('click', () => {
  document.getElementById('walletModal').classList.toggle('hidden');
});

// Close modal when clicking outside
document.getElementById('walletModal').addEventListener('click', (e) => {
  if (e.target.id === 'walletModal') {
    document.getElementById('walletModal').classList.add('hidden');
  }
});

// Handle key press in input
function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();

  if (!message || isLoading) return;

  isLoading = true;
  input.value = '';

  // Add user message
  addUserMessage(message);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    handleResponse(data);
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
  }
}

// Quick action
function quickAction(action) {
  document.getElementById('messageInput').value = action;
  sendMessage();
}

// Handle API response
function handleResponse(data) {
  if (data.type === 'info') {
    addBotMessage(data.message);
  } else if (data.type === 'message') {
    addBotMessage(data.message);
  } else if (data.type === 'action') {
    handleAction(data);
  }
}

// Handle action responses
function handleAction(action) {
  if (action.action === 'stake') {
    addBotMessage(action.message);
    addActionButtons([
      { label: '✅ Proceed', onclick: `confirmStake(${action.amount})` },
      { label: '❌ Cancel', onclick: 'clearAction()' }
    ]);
  } else if (action.action === 'unstake') {
    addBotMessage(action.message);
    addInputField('unstake', action.availableAmount);
  } else if (action.action === 'send') {
    addBotMessage(action.message);
    // Show saved beneficiaries if any
    displayBeneficiaries();
    addBotMessage('Or enter a new recipient:');
    addInputField('send');
  } else if (action.action === 'airdrop') {
    addBotMessage(action.message);
    confirmAirdrop();
  } else if (action.action === 'trading') {
    addBotMessage(action.message);
    addActionButtons([
      { label: '🚀 Start Trading', onclick: 'startTrading()' },
      { label: '❌ Cancel', onclick: 'clearAction()' }
    ]);
  } else if (action.action === 'liquidity') {
    addBotMessage(action.message);
    if (action.pools && action.pools.length > 0) {
      displayPoolsForLiquidity(action.pools);
      addBotMessage('🤖 AI agent will analyze all 35 pools and select the best one for liquidity provision...');
      addActionButtons([
        { label: '🚀 Provide Liquidity', onclick: 'provideAutonomousLiquidity()' },
        { label: '❌ Cancel', onclick: 'clearAction()' }
      ]);
    }
  } else if (action.action === 'moneyglitch') {
    addBotMessage(action.message);
    addActionButtons([
      { label: '🚀 Open Builder', onclick: 'openMoneyGlitchModal()' },
      { label: '❌ Cancel', onclick: 'clearAction()' }
    ]);
  } else if (action.action === 'earn') {
    addBotMessage(action.message);
    if (action.reserves && action.reserves.length > 0) {
      displayReserves(action.reserves);
      addBotMessage('🤖 AI agent will analyze all reserves and select the best one for earning...');
      addActionButtons([
        { label: '💰 Start Earning', onclick: 'startEarning()' },
        { label: '❌ Cancel', onclick: 'clearAction()' }
      ]);
    }
  }
}

// Add user message to chat
function addUserMessage(text) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageEl = document.createElement('div');
  messageEl.className = 'message-enter flex justify-end';
  messageEl.innerHTML = `
    <div class="bg-purple-600 text-white px-4 py-3 rounded-lg max-w-xs lg:max-w-md">
      <p class="text-sm">${escapeHtml(text)}</p>
    </div>
  `;
  messagesDiv.appendChild(messageEl);
  scrollToBottom();
}

// Add bot message to chat
function addBotMessage(text) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageEl = document.createElement('div');
  messageEl.className = 'message-enter flex justify-start';
  messageEl.innerHTML = `
    <div class="bg-white border border-gray-200 px-4 py-3 rounded-lg max-w-xs lg:max-w-md shadow-sm">
      <p class="text-sm text-gray-800">${escapeHtml(text)}</p>
    </div>
  `;
  messagesDiv.appendChild(messageEl);
  scrollToBottom();
}

// Add system message
function addSystemMessage(text) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageEl = document.createElement('div');
  messageEl.className = 'message-enter flex justify-center';
  messageEl.innerHTML = `
    <div class="bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-200 px-4 py-3 rounded-lg max-w-xs lg:max-w-md text-center">
      <p class="text-sm text-gray-700">${escapeHtml(text)}</p>
    </div>
  `;
  messagesDiv.appendChild(messageEl);
  scrollToBottom();
}

// Show follow-up options after completing a DeFi action
function showFollowUpMenu(completedLabel) {
  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  const allOptions = [
    { label: 'Stake', cmd: 'stake SOL with Marinade' },
    { label: 'Unstake', cmd: 'unstake mSOL' },
    { label: 'Liquidity', cmd: 'provide liquidity to a pool' },
    { label: 'Trade', cmd: 'start trading SOL/USDC' },
    { label: 'Earn', cmd: 'earn yield on Solend' },
    { label: 'Send', cmd: 'send SOL to a wallet' },
    { label: 'Glitch', cmd: 'money glitch' },
  ];

  // Filter out the action that was just done
  const filtered = allOptions.filter(o =>
    !o.label.toLowerCase().includes((completedLabel || '').toLowerCase())
  );

  const chipsHtml = filtered.map(opt =>
    `<button onclick="quickAction('${opt.cmd}')" ` +
    `style="background:#111827;border:1px solid #7c3aed;color:#4ade80;` +
    `padding:4px 12px;border-radius:9999px;font-size:11px;font-family:monospace;` +
    `cursor:pointer;white-space:nowrap;transition:background 0.2s;" ` +
    `onmouseover="this.style.background='#7c3aed'" ` +
    `onmouseout="this.style.background='#111827'">` +
    `${opt.label}</button>`
  ).join('');

  containerEl.innerHTML =
    `<div style="background:#0d1117;border:1px solid #374151;padding:12px 16px;` +
    `border-radius:8px;max-width:360px;">` +
    `<p style="font-size:11px;color:#6b7280;font-family:monospace;margin-bottom:8px;">` +
    `// AGENT READY — next operation?</p>` +
    `<div style="display:flex;flex-wrap:wrap;gap:6px;">${chipsHtml}</div></div>`;

  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Add action buttons
function addActionButtons(buttons) {
  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start gap-2';

  const buttonsHtml = buttons.map(btn =>
    `<button onclick="${btn.onclick}" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition">${btn.label}</button>`
  ).join('');

  containerEl.innerHTML = `<div class="flex gap-2">${buttonsHtml}</div>`;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Add input field for user action
function addInputField(action, maxAmount = null) {
  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  let inputHtml = '';
  if (action === 'unstake') {
    inputHtml = `
      <div class="bg-white border border-gray-200 px-4 py-3 rounded-lg w-full max-w-xs lg:max-w-md">
        <input type="number" id="unstakeAmount" placeholder="Enter amount (max: ${maxAmount.toFixed(4)})" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" max="${maxAmount}">
        <div class="flex gap-2 mt-2">
          <button onclick="confirmUnstake()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition">Unstake</button>
          <button onclick="clearAction()" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded-lg text-sm transition">Cancel</button>
        </div>
      </div>
    `;
  } else if (action === 'send') {
    inputHtml = `
      <div class="bg-white border border-gray-200 px-4 py-3 rounded-lg w-full max-w-xs lg:max-w-md">
        <input type="text" id="sendRecipient" placeholder="Recipient wallet address" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2">
        <input type="number" id="sendAmount" placeholder="Amount (SOL)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2" step="0.01">
        <div class="flex gap-2">
          <button onclick="processSendTransaction()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition">Continue</button>
          <button onclick="clearAction()" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded-lg text-sm transition">Cancel</button>
        </div>
      </div>
    `;
  }

  containerEl.innerHTML = inputHtml;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Add pool buttons
function addPoolButtons(pools) {
  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  const poolsHtml = pools.map((pool, idx) => `
    <button onclick="selectPool('${pool.address}')" class="block w-full text-left bg-white border border-gray-200 hover:border-purple-500 p-3 rounded-lg mb-2 transition">
      <p class="font-semibold text-sm">${pool.name}</p>
      <p class="text-xs text-gray-600">Liquidity: ${pool.liquidity}</p>
    </button>
  `).join('');

  containerEl.innerHTML = `<div class="w-full max-w-xs lg:max-w-md">${poolsHtml}</div>`;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Confirm stake
async function confirmStake(amount) {
  isLoading = true;
  try {
    const response = await fetch('/api/staking/stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ ${data.message}\nTransaction: ${data.signature.substring(0, 20)}...`);
      loadWalletInfo();
      showFollowUpMenu('Stake');
    } else {
      addBotMessage(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}

// Confirm airdrop
async function confirmAirdrop() {
  isLoading = true;
  try {
    const response = await fetch('/api/wallet/airdrop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ ${data.message}\nAgent Decision: ${data.agentDecision}\nTransaction: ${data.signature ? data.signature.substring(0, 20) + '...' : 'Pending'}`);
      loadWalletInfo();
      showFollowUpMenu('');
    } else {
      addBotMessage(`❌ ${data.message}\nAgent Decision: ${data.agentDecision}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}

// Confirm unstake
async function confirmUnstake() {
  const amount = parseFloat(document.getElementById('unstakeAmount').value);
  if (!amount || amount <= 0) {
    addBotMessage('❌ Please enter a valid amount');
    return;
  }

  isLoading = true;
  try {
    const response = await fetch('/api/staking/unstake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ ${data.message}\nTransaction: ${data.signature.substring(0, 20)}...`);
      loadWalletInfo();
      showFollowUpMenu('Unstake');
    } else {
      addBotMessage(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}

// Confirm send
async function confirmSend() {
  const recipient = document.getElementById('sendRecipient').value.trim();
  const amount = parseFloat(document.getElementById('sendAmount').value);

  if (!recipient || !amount || amount <= 0) {
    addBotMessage('❌ Please enter valid recipient and amount');
    return;
  }

  isLoading = true;
  try {
    const response = await fetch('/api/wallet/send-sol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, amount })
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ ${data.message}\nTransaction: ${data.signature.substring(0, 20)}...`);
      loadWalletInfo();
      showFollowUpMenu('Send');
    } else {
      addBotMessage(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}

// Process send transaction - collect info and ask about beneficiary
async function processSendTransaction() {
  const recipient = document.getElementById('sendRecipient').value.trim();
  const amount = parseFloat(document.getElementById('sendAmount').value);

  if (!recipient || !amount || amount <= 0) {
    addBotMessage('❌ Please enter valid recipient address and amount');
    return;
  }

  // Show confirmation
  addBotMessage(`📤 Sending ${amount} SOL to ${recipient.substring(0, 20)}...`);

  // Ask about beneficiary
  addBotMessage('Would you like to save this address as a beneficiary for future transfers?');
  addActionButtons([
    { label: '✅ Yes, save as beneficiary', onclick: `askRecurringTransfer('${recipient}', ${amount})` },
    { label: '❌ No, just send once', onclick: `autoSendTransaction('${recipient}', ${amount})` }
  ]);
}

// Ask about recurring transfer
function askRecurringTransfer(recipient, amount) {
  addBotMessage('Would you like to make this a recurring transfer?');
  addActionButtons([
    { label: '📅 Daily', onclick: `setupRecurring('${recipient}', ${amount}, 'daily')` },
    { label: '📆 Weekly', onclick: `setupRecurring('${recipient}', ${amount}, 'weekly')` },
    { label: '🗓️ Monthly', onclick: `setupRecurring('${recipient}', ${amount}, 'monthly')` },
    { label: '❌ No, one-time only', onclick: `saveBeneficiaryAndSend('${recipient}', ${amount})` }
  ]);
}

// Setup recurring transfer schedule
async function setupRecurring(recipient, amount, frequency) {
  const d = new Date();
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);

  const transfer = {
    recipient,
    amount,
    frequency,
    nextRunDate: d.toISOString(),
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch('/api/wallet/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transfer)
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`🔄 Scheduled a **${frequency}** recurring transfer of ${amount} SOL to this beneficiary.`);
    } else {
      addBotMessage('❌ Failed to schedule recurring transfer.');
    }
  } catch (error) {
    console.error('Error scheduling recurring transfer:', error);
    addBotMessage('❌ Error scheduling recurring transfer on server.');
  }

  await saveBeneficiaryAndSend(recipient, amount);
}

// Save beneficiary and auto-send
async function saveBeneficiaryAndSend(recipient, amount) {
  // Save to local storage
  let beneficiaries = JSON.parse(localStorage.getItem('beneficiaries') || '[]');

  // Check if already exists
  const exists = beneficiaries.some(b => b.address === recipient);
  if (!exists) {
    beneficiaries.push({
      address: recipient,
      addedAt: new Date().toISOString(),
      nickname: `Beneficiary ${beneficiaries.length + 1}`
    });
    localStorage.setItem('beneficiaries', JSON.stringify(beneficiaries));
    addBotMessage(`✅ Saved ${recipient.substring(0, 20)}... as beneficiary`);
  }

  // Auto-send transaction
  await autoSendTransaction(recipient, amount);
}

// Auto-send transaction without user confirmation
async function autoSendTransaction(recipient, amount) {
  isLoading = true;
  try {
    addBotMessage('🚀 Sending transaction...');

    const response = await fetch('/api/wallet/send-sol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, amount })
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ Transaction successful!\n📤 Sent ${amount} SOL to ${recipient.substring(0, 20)}...\n🔗 Signature: ${data.signature ? data.signature.substring(0, 20) + '...' : 'Pending'}`);
      loadWalletInfo();
      showFollowUpMenu('Send');
    } else {
      addBotMessage(`❌ Transaction failed: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error sending transaction: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}

// Clear action
function clearAction() {
  pendingAction = null;
}

// Get saved beneficiaries
function getSavedBeneficiaries() {
  return JSON.parse(localStorage.getItem('beneficiaries') || '[]');
}

// Display saved beneficiaries
function displayBeneficiaries() {
  const beneficiaries = getSavedBeneficiaries();
  if (beneficiaries.length === 0) {
    return null;
  }

  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  const beneficiariesHtml = beneficiaries.map((b, idx) => `
    <button onclick="quickSendToBeneficiary('${b.address}')" class="block w-full text-left bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 hover:border-purple-500 p-3 rounded-lg mb-2 transition">
      <p class="font-semibold text-sm">${b.nickname}</p>
      <p class="text-xs text-gray-600 font-mono">${b.address.substring(0, 20)}...</p>
    </button>
  `).join('');

  containerEl.innerHTML = `<div class="w-full max-w-xs lg:max-w-md"><p class="text-sm font-semibold text-gray-700 mb-2">💾 Saved Beneficiaries:</p>${beneficiariesHtml}</div>`;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Quick send to beneficiary
function quickSendToBeneficiary(address) {
  addBotMessage(`📤 Sending to ${address.substring(0, 20)}...`);
  addBotMessage('How much SOL would you like to send?');

  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  containerEl.innerHTML = `
    <div class="bg-white border border-gray-200 px-4 py-3 rounded-lg w-full max-w-xs lg:max-w-md">
      <input type="number" id="quickSendAmount" placeholder="Amount (SOL)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2" step="0.01">
      <div class="flex gap-2">
        <button onclick="autoSendTransaction('${address}', parseFloat(document.getElementById('quickSendAmount').value))" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition">Send</button>
        <button onclick="clearAction()" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded-lg text-sm transition">Cancel</button>
      </div>
    </div>
  `;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Scroll to bottom
function scrollToBottom() {
  const messagesDiv = document.getElementById('chatMessages');
  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 0);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start trading - autonomous AI agent
async function startTrading() {
  isLoading = true;
  try {
    addBotMessage('🚀 Starting AI-powered trading...');

    const response = await fetch('/api/trading/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ Trading started\n🤖 AI agent is now autonomous. Monitoring prices and making decisions...\n\n📊 Live Activity:`);
      lastHistoryLength = 0;
      startTradingStream();
    } else {
      addBotMessage(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
  }
}

// Stream trading activity in real-time
function startTradingStream() {
  if (tradingStreamInterval) return;

  tradingStreamInterval = setInterval(async () => {
    try {
      const response = await fetch('/api/trading/status');
      const data = await response.json();

      if (!data.active) {
        clearInterval(tradingStreamInterval);
        tradingStreamInterval = null;
        addBotMessage('⏹️ Trading session ended');
        return;
      }

      if (data.priceHistory && data.priceHistory.length > lastHistoryLength) {
        const newPrices = data.priceHistory.slice(lastHistoryLength);

        newPrices.forEach((priceData, idx) => {
          const price = priceData.price;
          const prevPrice = idx === 0 && lastHistoryLength > 0
            ? data.priceHistory[lastHistoryLength - 1].price
            : (idx > 0 ? newPrices[idx - 1].price : price);

          const change = price - prevPrice;
          const changePercent = ((change / prevPrice) * 100).toFixed(2);
          const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
          const changeStr = change > 0 ? `+${change.toFixed(2)}` : `${change.toFixed(2)}`;

          addBotMessage(`📊 SOL/USD: $${price.toFixed(2)} ${emoji} (${changeStr}, ${changePercent}%)\n📈 Avg: $${data.averagePrice}`);
        });

        lastHistoryLength = data.priceHistory.length;
      }

      // Display latest AI decision
      if (data.decisions && data.decisions.length > 0) {
        const latestDecision = data.decisions[data.decisions.length - 1];
        const decisionEmoji = latestDecision.decision === 'buy' ? '💰' : latestDecision.decision === 'sell' ? '💸' : '⏸️';
        addBotMessage(`${decisionEmoji} 🤖 AI Decision: ${latestDecision.decision.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Error streaming trading activity:', error);
    }
  }, 3000);
}


// Display pools for liquidity provision
function displayPoolsForLiquidity(pools) {
  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  const poolsHtml = pools.map((pool, idx) => `
    <div class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-3 rounded-lg mb-2">
      <p class="font-semibold text-sm">${pool.name}</p>
      <p class="text-xs text-gray-600">💰 Liquidity: $${pool.liquidity}</p>
      <p class="text-xs text-gray-600">📊 Volume 24h: $${pool.volume_24h}</p>
      <p class="text-xs text-gray-600">💸 Fee: ${pool.fee}%</p>
    </div>
  `).join('');

  containerEl.innerHTML = `<div class="w-full max-w-xs lg:max-w-md"><p class="text-sm font-semibold text-gray-700 mb-2">📊 Top 10 Pools:</p>${poolsHtml}</div>`;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Provide liquidity autonomously
async function provideAutonomousLiquidity() {
  isLoading = true;
  try {
    addBotMessage('🤖 AI agent analyzing all 35 pools to select the best one...');

    const response = await fetch('/api/liquidity/provide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ ${data.message}`);
      addBotMessage(`🤖 AI Decision: ${data.agentDecision}`);
      addBotMessage(`📍 Pool: ${data.pool}\n💰 Amount: ${data.amount} SOL\n🔗 Signature: ${data.signature ? data.signature.substring(0, 20) + '...' : 'Pending'}`);
      loadWalletInfo();
      showFollowUpMenu('Liquidity');
    } else {
      addBotMessage(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}


// Money Glitch - Autonomous feature chaining
let moneyGlitchActive = false;
let moneyGlitchInterval = null;
let featureChain = [];

function openMoneyGlitchModal() {
  document.getElementById('moneyGlitchModal').classList.remove('hidden');
  featureChain = [];
  updateChainDisplay();
}

function closeMoneyGlitchModal() {
  document.getElementById('moneyGlitchModal').classList.add('hidden');
}

function dragStart(event, featureType) {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('featureType', featureType);
}

function dragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  event.currentTarget.classList.add('bg-purple-100');
}

function dropFeature(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('bg-purple-100');

  const featureType = event.dataTransfer.getData('featureType');
  if (featureType) {
    featureChain.push(featureType);
    updateChainDisplay();
  }
}

function updateChainDisplay() {
  const chainBuilder = document.getElementById('chainBuilder');

  if (featureChain.length === 0) {
    chainBuilder.innerHTML = '<p class="text-gray-500 text-sm text-center py-12">Drop features here to build your chain</p>';
    return;
  }

  const featureIcons = {
    stake: '💰 STK_PROT',
    trade: '📈 TRD_ALGO',
    liquidity: '💧 LIQ_POOL',
    airdrop: '🎁 ARDRP_REQ',
    earn: '🏦 YIELD_FAR'
  };

  const chainHTML = featureChain.map((feature, idx) => `
    <div class="flex items-center gap-2">
      <div class="flex-1 bg-white border-2 border-gray-300 p-3 rounded-lg">
        <p class="font-semibold text-sm">${featureIcons[feature] || feature}</p>
      </div>
      <button onclick="removeFromChain(${idx})" class="text-red-600 hover:text-red-800 text-lg">
        <i class="fas fa-trash"></i>
      </button>
      ${idx < featureChain.length - 1 ? '<div class="text-center text-gray-400 text-lg"><i class="fas fa-arrow-down"></i></div>' : ''}
    </div>
  `).join('');

  chainBuilder.innerHTML = chainHTML;
}

function removeFromChain(index) {
  featureChain.splice(index, 1);
  updateChainDisplay();
}

function clearChain() {
  featureChain = [];
  updateChainDisplay();
}

async function startChain() {
  if (featureChain.length === 0) {
    addBotMessage('❌ Please add at least one feature to your chain');
    return;
  }

  closeMoneyGlitchModal();

  if (moneyGlitchActive) {
    addBotMessage('💰 Money Glitch already running!');
    return;
  }

  moneyGlitchActive = true;
  document.getElementById('killSwitchBtn').classList.remove('hidden');
  const chainDisplay = featureChain.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(' → ');

  addBotMessage(`🔄 Money Glitch activated!`);
  addBotMessage(`🤖 Chain: ${chainDisplay}`);
  addBotMessage(`⏱️ Running every 15 seconds...`);
  addActionButtons([
    { label: '🛑 Stop Cycle', onclick: 'stopMoneyGlitch()' }
  ]);

  // Start the autonomous loop
  moneyGlitchInterval = setInterval(async () => {
    if (!moneyGlitchActive) return;

    try {
      // Execute each feature in the chain
      for (const feature of featureChain) {
        if (!moneyGlitchActive) break;

        const featureMessages = {
          stake: '💰 [AUTONOMOUS]: Initializing Stake Sequence...',
          trade: '📈 [AUTONOMOUS]: Triggering Trading Engine...',
          liquidity: '💧 [AUTONOMOUS]: Allocating Liquidity...',
          airdrop: '🎁 [AUTONOMOUS]: Extracting Faucet Funds...',
          earn: '🏦 [AUTONOMOUS]: Deploying to Earning Protocol...'
        };

        addBotMessage(featureMessages[feature] || `Executing ${feature}...`);

        const commandMap = {
          stake: 'Stake SOL',
          trade: 'Start trading',
          liquidity: 'Provide liquidity',
          airdrop: 'Request airdrop',
          earn: 'Start earning'
        };

        // Get instructions from agent
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: commandMap[feature] })
        });

        const data = await response.json();

        // Automated Execution based on intent
        if (data.type === 'action') {
          switch (data.action) {
            case 'stake':
              await confirmStake(data.amount);
              break;
            case 'airdrop':
              await confirmAirdrop();
              break;
            case 'trading':
              await startTrading();
              break;
            case 'liquidity':
              await provideAutonomousLiquidity();
              break;
            case 'earn':
              await startEarning();
              break;
          }
        }

        // Wait 4 seconds between features for network stability
        await new Promise(resolve => setTimeout(resolve, 4000));
      }

      loadWalletInfo();
      addBotMessage('💎 [CYCLE_COMPLETE]: Awaiting next iteration...');
    } catch (error) {
      console.error('Money Glitch error:', error);
      addBotMessage(`⚠️ [SYSTEM_INTERRUPT]: ${error.message}`);
    }
  }, 30000); // Run every 30 seconds to allow for full sequence completion
}

function stopMoneyGlitch() {
  if (!moneyGlitchActive) return;

  moneyGlitchActive = false;
  document.getElementById('killSwitchBtn').classList.add('hidden');
  if (moneyGlitchInterval) {
    clearInterval(moneyGlitchInterval);
    moneyGlitchInterval = null;
  }

  addBotMessage('🛑 Money Glitch stopped!');
  addBotMessage('✅ All autonomous operations halted. Wallet is safe.');
  loadWalletInfo();
}


// Display reserves for earning
function displayReserves(reserves) {
  const messagesDiv = document.getElementById('chatMessages');
  const containerEl = document.createElement('div');
  containerEl.className = 'message-enter flex justify-start';

  const reservesHtml = reserves.map((reserve, idx) => `
    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-3 rounded-lg mb-2">
      <p class="font-semibold text-sm">${reserve.symbol}</p>
      <p class="text-xs text-gray-600">📈 APY: ${reserve.apy}%</p>
      <p class="text-xs text-gray-600">💰 Total Deposits: $${reserve.totalDeposits}</p>
    </div>
  `).join('');

  containerEl.innerHTML = `<div class="w-full max-w-xs lg:max-w-md"><p class="text-sm font-semibold text-gray-700 mb-2">🏦 Top Earning Reserves:</p>${reservesHtml}</div>`;
  messagesDiv.appendChild(containerEl);
  scrollToBottom();
}

// Start earning autonomously
async function startEarning() {
  isLoading = true;
  try {
    addBotMessage('🤖 AI agent analyzing all Solend reserves to select the best one...');

    const response = await fetch('/api/earn/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    if (data.success) {
      addBotMessage(`✅ ${data.message}`);
      addBotMessage(`🤖 AI Decision: ${data.agentDecision}`);
      addBotMessage(`📊 Reserve: ${data.reserve}\n💰 Amount: ${data.amount} ${data.token}\n📈 APY: ${data.apy}%\n🔗 Signature: ${data.signature ? data.signature.substring(0, 20) + '...' : 'Pending'}`);
      loadWalletInfo();
      showFollowUpMenu('Earn');
    } else {
      addBotMessage(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    addBotMessage('❌ Error: ' + error.message);
  } finally {
    isLoading = false;
    clearAction();
  }
}
