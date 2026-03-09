import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// Wallets directory — each agent gets its own isolated encrypted key file
const WALLETS_DIR = path.join(__dirname, '../wallets');

// Ensure wallets directory exists
if (!fs.existsSync(WALLETS_DIR)) {
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
}

function getWalletPath(agentId: string): string {
  // Sanitize agentId to prevent directory traversal
  const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(WALLETS_DIR, `${safe}.encrypted.json`);
}

// Generate or retrieve the encryption key
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('WALLET_ENCRYPTION_KEY is required in production. Set it in your .env file.');
    }
    console.warn('⚠️  WALLET_ENCRYPTION_KEY not set. Using insecure dev fallback — NOT SAFE FOR MAINNET!');
  }
  return crypto.scryptSync(envKey || 'default-insecure-key-agent', 'wallet-salt', 32);
};

// Encrypt the wallet secret key using AES-256-GCM (authenticated encryption)
const encryptWallet = (secretKey: Uint8Array): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(Buffer.from(secretKey)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex'),
    authTag: authTag.toString('hex')
  }, null, 2);
};

// Decrypt the wallet secret key
const decryptWallet = (encryptedJson: string): Uint8Array => {
  const data = JSON.parse(encryptedJson);
  const iv = Buffer.from(data.iv, 'hex');
  const encryptedText = Buffer.from(data.encryptedData, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return new Uint8Array(decrypted);
};

/**
 * Loads an existing wallet for a given agent, or creates a new one.
 * Each agent has its own isolated encrypted key file: wallets/{agentId}.encrypted.json
 */
export async function loadOrCreateWallet(
  agentId: string,
  onNewWallet?: (address: string) => Promise<void>
): Promise<Keypair> {
  const walletPath = getWalletPath(agentId);

  // One-time migration: if old unencrypted flat file exists and this is the 'default' agent
  const legacyPath = path.join(__dirname, '../.wallet.json');
  const legacyEncPath = path.join(__dirname, '../.wallet.encrypted.json');

  if (agentId === 'default' && !fs.existsSync(walletPath)) {
    if (fs.existsSync(legacyEncPath)) {
      console.log(`🔄 [${agentId}] Migrating legacy .wallet.encrypted.json → wallets/default.encrypted.json`);
      fs.copyFileSync(legacyEncPath, walletPath);
    } else if (fs.existsSync(legacyPath)) {
      console.log(`🔄 [${agentId}] Migrating plaintext .wallet.json → encrypted wallets/default.encrypted.json`);
      const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(legacyPath, 'utf-8')));
      fs.writeFileSync(walletPath, encryptWallet(secretKey));
      fs.renameSync(legacyPath, legacyPath + '.bak');
    }
  }

  if (fs.existsSync(walletPath)) {
    try {
      const encryptedData = fs.readFileSync(walletPath, 'utf-8');
      const secretKey = decryptWallet(encryptedData);
      console.log(`🔒 [${agentId}] Loaded encrypted wallet from wallets/${agentId}.encrypted.json`);
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      console.error(`❌ [${agentId}] Failed to decrypt wallet! Check your WALLET_ENCRYPTION_KEY.`);
      throw error;
    }
  }

  // Create a brand-new wallet for this agent
  const wallet = Keypair.generate();
  fs.writeFileSync(walletPath, encryptWallet(wallet.secretKey));
  console.log(`🔐 [${agentId}] Created new encrypted wallet: ${wallet.publicKey.toString()}`);

  if (onNewWallet) {
    await onNewWallet(wallet.publicKey.toString());
  }

  return wallet;
}

/** Returns a list of all registered agent IDs (based on wallet files). */
export function listAgents(): string[] {
  if (!fs.existsSync(WALLETS_DIR)) return [];
  return fs.readdirSync(WALLETS_DIR)
    .filter(f => f.endsWith('.encrypted.json'))
    .map(f => f.replace('.encrypted.json', ''));
}
