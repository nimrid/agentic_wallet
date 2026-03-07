import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const WALLET_PATH = path.join(__dirname, '../.wallet.encrypted.json');
const OLD_WALLET_PATH = path.join(__dirname, '../.wallet.json');

// Generate or retrieve the encryption key
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!envKey) {
    console.warn('⚠️ WALLET_ENCRYPTION_KEY not found in environment. Using insecure fallback key (NOT SAFE FOR MAINNET!)');
  }
  return crypto.scryptSync(envKey || 'default-insecure-key-agent', 'wallet-salt', 32);
};

// Encrypt the wallet secret
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

// Decrypt the wallet secret
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

export async function loadOrCreateWallet(onNewWallet?: (address: string) => Promise<void>): Promise<Keypair> {
  // Migration Check: If old unencrypted wallet exists, we should migrate it
  if (fs.existsSync(OLD_WALLET_PATH) && !fs.existsSync(WALLET_PATH)) {
    console.log('🔄 Migrating unencrypted wallet to encrypted storage...');
    const oldData = fs.readFileSync(OLD_WALLET_PATH, 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(oldData));

    fs.writeFileSync(WALLET_PATH, encryptWallet(secretKey));
    fs.renameSync(OLD_WALLET_PATH, OLD_WALLET_PATH + '.bak');
    console.log('✅ Migration complete (.wallet.json -> .wallet.encrypted.json)');
  }

  if (fs.existsSync(WALLET_PATH)) {
    try {
      const encryptedData = fs.readFileSync(WALLET_PATH, 'utf-8');
      const secretKey = decryptWallet(encryptedData);
      console.log('🔒 Loaded ENCRYPTED existing wallet');
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      console.error('❌ Failed to decrypt wallet! Check your WALLET_ENCRYPTION_KEY.');
      throw error;
    }
  }

  const wallet = Keypair.generate();
  fs.writeFileSync(WALLET_PATH, encryptWallet(wallet.secretKey));
  console.log('🔐 Created new ENCRYPTED wallet:', wallet.publicKey.toString());

  if (onNewWallet) {
    await onNewWallet(wallet.publicKey.toString());
  }

  return wallet;
}
