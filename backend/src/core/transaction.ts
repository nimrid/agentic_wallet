import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

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
      toPubkey: toPubkey,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [
    fromWallet,
  ]);

  return signature;
}

export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

export async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  tokenMint: string
): Promise<number> {
  try {
    const tokenMintPublicKey = new PublicKey(tokenMint);
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      wallet
    );

    const accountInfo = await getAccount(connection, associatedTokenAddress);
    return Number(accountInfo.amount) / 1e6; // Assuming 6 decimals for USDC
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0;
    }
    console.error('Error fetching token balance:', error);
    return 0;
  }
}
