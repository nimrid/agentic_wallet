import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';


const DEVNET_CONNECTION = new Connection(clusterApiUrl('devnet'), 'confirmed');
const LOW_BALANCE_THRESHOLD = 0.1; // SOL

export async function requestDevnetAirdrop(
  walletAddress: string,
  solAmount: number = 2
): Promise<{ success: boolean; signature?: string; message: string }> {
  try {
    const publicKey = new PublicKey(walletAddress);

    console.log(`Requesting ${solAmount} SOL airdrop for ${walletAddress}...`);

    // Request the airdrop (amount must be in lamports)
    const signature = await DEVNET_CONNECTION.requestAirdrop(
      publicKey,
      solAmount * LAMPORTS_PER_SOL
    );

    // Confirm the transaction
    const latestBlockHash = await DEVNET_CONNECTION.getLatestBlockhash();
    await DEVNET_CONNECTION.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature,
    });

    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
    console.log(`✅ Airdrop successful! ${solAmount} SOL sent to ${walletAddress}`);
    console.log(`View transaction: ${explorerUrl}`);

    return {
      success: true,
      signature,
      message: `Successfully airdropped ${solAmount} SOL to ${walletAddress}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Airdrop failed:', errorMessage);

    return {
      success: false,
      message: `Airdrop failed: ${errorMessage}`,
    };
  }
}



export async function getWalletBalance(
  walletAddress: string,
  connection: Connection = DEVNET_CONNECTION
): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balanceLamports = await connection.getBalance(publicKey);
    return balanceLamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
}
