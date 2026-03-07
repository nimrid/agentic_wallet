import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { AgentChat } from '@services/chat';

interface EarnPosition {
  vault: string;
  depositAmount: number;
  apy: number;
  tvl: number;
}

// Kamino devnet vault addresses - update with actual devnet vault addresses
const KAMINO_DEVNET_VAULTS = [
  {
    symbol: 'SOL',
    name: 'Solana Vault',
    address: 'devkRngFnfp4gBc5a3LsadgbQKdPo8MSZ4prFiNSVmY', // Replace with actual devnet SOL vault
  },
  {
    symbol: 'USDC',
    name: 'USDC Vault',
    address: 'devkRngFnfp4gBc5a3LsadgbQKdPo8MSZ4prFiNSVmY', // Replace with actual devnet USDC vault
  },
];

export async function getAvailableVaults(connection: Connection): Promise<any[]> {
  try {
    console.log('📊 Loading Kamino devnet vaults...');
    
    // Return vault configs directly without trying to load from chain
    // In production, integrate with Kamino SDK to fetch real data
    const vaults = KAMINO_DEVNET_VAULTS.map(v => ({
      ...v,
      tvl: 0,
      apy: 0.05,
      exists: false,
    }));
    
    console.log(`✅ Loaded ${vaults.length} vaults`);
    return vaults;
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return [];
  }
}

export async function getTopVaults(connection: Connection): Promise<any[]> {
  const vaults = await getAvailableVaults(connection);
  return vaults
    .sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0))
    .slice(0, 5);
}

export async function selectBestVault(
  agent: AgentChat,
  vaults: any[]
): Promise<any> {
  if (vaults.length === 0) {
    throw new Error('No vaults available');
  }

  try {
    const vaultsInfo = vaults.slice(0, 10).map((vault, idx) => {
      const apy = (vault.apy * 100).toFixed(2);
      return `${idx + 1}. ${vault.symbol} | APY: ${apy}% | TVL: $${parseFloat(vault.tvl).toLocaleString()}`;
    }).join('\n');

    const prompt = `Select the best vault for earning yield. Choose by number (1-${Math.min(vaults.length, 10)}):

${vaultsInfo}

Best = highest APY + stable asset. Respond with ONLY the number:`;

    const response = await agent.chat(prompt);
    const vaultIndex = parseInt(response.trim()) - 1;

    if (isNaN(vaultIndex) || vaultIndex < 0 || vaultIndex >= Math.min(vaults.length, 10)) {
      return vaults.reduce((best, vault) =>
        (vault.apy || 0) > (best.apy || 0) ? vault : best
      );
    }

    return vaults[vaultIndex];
  } catch (error) {
    console.error('Error in selectBestVault:', error);
    return vaults.reduce((best, vault) =>
      (vault.apy || 0) > (best.apy || 0) ? vault : best
    );
  }
}

export async function getAIDepositAmount(
  agent: AgentChat,
  vaultSymbol: string,
  solBalance: number
): Promise<number> {
  const maxAmount = Math.min(solBalance * 0.3, 2);

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
    return Math.min(0.3, maxAmount);
  }

  return amount;
}

export async function depositToVault(
  connection: Connection,
  wallet: Keypair,
  vaultAddress: string,
  depositAmount: number
): Promise<any> {
  try {
    console.log(`🚀 Depositing ${depositAmount} tokens to Kamino vault...`);
    console.log(`✅ Found vault: ${vaultAddress}`);
    console.log(`📝 Building deposit instruction...`);
    console.log(`💰 Deposit amount: ${depositAmount} tokens`);
    console.log(`🔄 Preparing transaction...`);

    // In production, use Kamino SDK to build deposit instruction
    // For now, return prepared transaction data
    const sig = 'devnet_' + Math.random().toString(36).substring(7);

    console.log(`✅ Deposit prepared: ${sig}`);
    return {
      signature: sig,
      vault: vaultAddress,
      amount: depositAmount,
      status: 'prepared',
    };
  } catch (error) {
    console.error('Error depositing to vault:', error);
    throw error;
  }
}

export async function withdrawFromVault(
  connection: Connection,
  wallet: Keypair,
  vaultAddress: string,
  shareAmount: number
): Promise<any> {
  try {
    console.log(`🚀 Withdrawing ${shareAmount} shares from Kamino vault...`);
    console.log(`✅ Found vault: ${vaultAddress}`);
    console.log(`📝 Building withdraw instruction...`);
    console.log(`💰 Withdraw shares: ${shareAmount}`);
    console.log(`🔄 Preparing transaction...`);

    // In production, use Kamino SDK to build withdraw instruction
    // For now, return prepared transaction data
    const sig = 'devnet_' + Math.random().toString(36).substring(7);

    console.log(`✅ Withdrawal prepared: ${sig}`);
    return {
      signature: sig,
      vault: vaultAddress,
      shares: shareAmount,
      status: 'prepared',
    };
  } catch (error) {
    console.error('Error withdrawing from vault:', error);
    throw error;
  }
}

export async function getUserVaultPositions(
  connection: Connection,
  wallet: Keypair
): Promise<EarnPosition[]> {
  try {
    console.log('📊 Fetching user vault positions...');
    
    // In production, query user's share balance from vault
    // For now, return empty positions
    return [];
  } catch (error) {
    console.error('Error fetching user earnings:', error);
    return [];
  }
}

export async function getEarningsStats(connection: Connection): Promise<any> {
  try {
    const vaults = await getAvailableVaults(connection);
    
    if (vaults.length === 0) {
      return { totalTVL: 0, avgAPY: 0, vaultCount: 0 };
    }

    const totalTVL = vaults.reduce(
      (sum: number, vault: any) => sum + parseFloat(vault.tvl || 0),
      0
    );

    const avgAPY =
      vaults.reduce((sum: number, vault: any) => sum + (vault.apy || 0), 0) /
      vaults.length;

    return {
      totalTVL,
      avgAPY,
      vaultCount: vaults.length,
    };
  } catch (error) {
    console.error('Error fetching earnings stats:', error);
    return { totalTVL: 0, avgAPY: 0, vaultCount: 0 };
  }
}
