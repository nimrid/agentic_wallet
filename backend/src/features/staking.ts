import { Marinade, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import BN from 'bn.js';

export async function initializeMarinade(
  connection: Connection,
  wallet: Keypair
): Promise<Marinade> {
  const config = new MarinadeConfig({
    connection,
    publicKey: wallet.publicKey,
  });

  return new Marinade(config);
}


export async function stakeSol(
  connection: Connection,
  wallet: Keypair,
  amountSol: number
): Promise<{ signature: string; mSolTokenAccount: string }> {
  const marinade = await initializeMarinade(connection, wallet);

  const amountLamports = new BN(Math.floor(amountSol * 1e9));

  console.log(`Staking ${amountSol} SOL (${amountLamports.toString()} lamports) with Marinade...`);

  const { associatedMSolTokenAccountAddress, transaction } = await marinade.deposit(
    amountLamports
  );

  // Sign and send the transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);

  console.log(`Staking successful! Signature: ${signature}`);
  console.log(`mSOL token account: ${associatedMSolTokenAccountAddress.toString()}`);

  return {
    signature,
    mSolTokenAccount: associatedMSolTokenAccountAddress.toString(),
  };
}

export async function unstakeSol(
  connection: Connection,
  wallet: Keypair,
  amountLamports: number
): Promise<{ signature: string; mSolTokenAccount: string }> {
  const marinade = await initializeMarinade(connection, wallet);

  const amountBN = new BN(amountLamports);

  console.log(`Unstaking ${(amountLamports / 1e9).toFixed(4)} SOL from Marinade...`);

  const { associatedMSolTokenAccountAddress, transaction } = await marinade.liquidUnstake(
    amountBN
  );

  // Sign and send the transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);

  console.log(`Unstaking successful! Signature: ${signature}`);
  console.log(`mSOL token account: ${associatedMSolTokenAccountAddress.toString()}`);

  return {
    signature,
    mSolTokenAccount: associatedMSolTokenAccountAddress.toString(),
  };
}

export async function getMSolBalance(
  connection: Connection,
  wallet: Keypair
): Promise<number> {
  try {
    const marinade = await initializeMarinade(connection, wallet);
    const marinadeState = await marinade.getMarinadeState();

    // Get mSOL token balance using the mSOL mint
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
    const mSolMint = marinadeState.mSolMintAddress;
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mSolMint,
      wallet.publicKey
    );

    const accountInfo = await getAccount(connection, associatedTokenAddress);
    return Number(accountInfo.amount) / 1e9; // mSOL has 9 decimals
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0;
    }
    console.error('Error fetching mSOL balance:', error);
    return 0;
  }
}

export async function getStakingStats(
  connection: Connection
): Promise<{ apy: number; tvl: number }> {
  try {
    const marinade = await initializeMarinade(connection, Keypair.generate());
    const marinadeState = await marinade.getMarinadeState();

    // Calculate APY from state (this is a simplified calculation)
    // In production, you'd want to fetch this from an API or calculate it properly
    const apy = 0.08; // Default 8% APY

    // TVL is the total staked SOL
    const tvl = marinadeState.state.availableReserveBalance.toNumber() / 1e9;

    return { apy, tvl };
  } catch (error) {
    console.error('Error fetching staking stats:', error);
    return { apy: 0, tvl: 0 };
  }
}
