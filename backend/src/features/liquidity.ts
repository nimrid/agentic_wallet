import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import BN from 'bn.js';
import { AgentChat } from '@services/chat';

export async function getAvailablePools(connection: Connection): Promise<any[]> {
  try {
    const response = await fetch('https://dlmm-api.devnet.meteora.ag/pair/all');
    
    if (!response.ok) {
      console.error(`API returned status: ${response.status}`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('API returned empty response');
      return [];
    }
    
    const pools = JSON.parse(text);
    
    const filtered = Array.isArray(pools) 
      ? pools.filter((pool: any) => 
          !pool.hide && 
          !pool.is_blacklisted && 
          pool.liquidity && 
          parseFloat(pool.liquidity) > 0
        )
      : [];
    
    console.log(`Found ${filtered.length} devnet pools with liquidity`);
    return filtered.slice(0, 35); // Return all 35 pools
  } catch (error) {
    console.error('Error fetching pools:', error);
    return [];
  }
}

export async function getPoolsForDisplay(connection: Connection): Promise<any[]> {
  const allPools = await getAvailablePools(connection);
  return allPools.slice(0, 10); // Display top 10 to user
}



export async function addLiquidity(
  connection: Connection,
  wallet: Keypair,
  poolAddress: string,
  solAmount: number
) {
  try {
    console.log(`🚀 Adding liquidity to pool: ${poolAddress}`);
    console.log(`💰 Amount: ${solAmount} SOL`);
    
    // Validate pool address
    try {
      new PublicKey(poolAddress);
    } catch (e) {
      throw new Error(`Invalid pool address: ${poolAddress}`);
    }
    
    // Try to create DLMM pool instance with timeout
    let dlmmPool: any;
    try {
      dlmmPool = await Promise.race([
        DLMM.create(connection, new PublicKey(poolAddress)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Pool fetch timeout')), 10000))
      ]);
    } catch (error) {
      console.error('Failed to fetch pool:', error);
      throw new Error(`Failed to fetch pool data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Get active bin
    let activeBin: any;
    try {
      activeBin = await dlmmPool.getActiveBin();
    } catch (error) {
      console.error('Failed to get active bin:', error);
      throw new Error(`Failed to get pool bin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (!activeBin || activeBin.binId === undefined) {
      throw new Error('This pool is empty. Please select a pool with existing liquidity.');
    }
    
    console.log(`✅ Active bin ID: ${activeBin.binId}`);
    
    // Only deposit SOL (Token Y) - single-sided
    const totalXAmount = new BN(0);
    const totalYAmount = new BN(Math.floor(solAmount * 1e9));

    const TOTAL_RANGE_INTERVAL = 10;
    const minBinId = activeBin.binId;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL * 2;
    
    console.log(`📊 Using Spot strategy, bin range: ${minBinId} to ${maxBinId}`);

    const newBalancePosition = new Keypair();
    
    let createPositionTx: any;
    try {
      createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newBalancePosition.publicKey,
        user: wallet.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });
    } catch (error) {
      console.error('Failed to create position transaction:', error);
      throw new Error(`Failed to create position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(`🔄 Sending transaction...`);
    const txHash = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [wallet, newBalancePosition]
    );
    
    console.log(`✅ Transaction confirmed: ${txHash}`);
    return { txHash, positionPubKey: newBalancePosition.publicKey.toString() };
  } catch (error) {
    console.error('❌ Error adding liquidity:', error);
    throw error;
  }
}

export async function getUserPositions(
  connection: Connection,
  wallet: Keypair,
  poolAddress: string
) {
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(wallet.publicKey);
  
  if (userPositions.length === 0) {
    return [];
  }
  
  return userPositions.map((pos: any) => ({
    publicKey: pos.publicKey.toString(),
    binData: pos.positionData.positionBinData,
    lowerBinId: pos.positionData.lowerBinId,
    upperBinId: pos.positionData.upperBinId,
  }));
}

export async function closePosition(
  connection: Connection,
  wallet: Keypair,
  poolAddress: string,
  positionAddress: string
) {
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
  
  // Get the position object
  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(wallet.publicKey);
  const position = userPositions.find((pos: any) => pos.publicKey.toString() === positionAddress);
  
  if (!position) {
    throw new Error('Position not found');
  }
  
  const closePositionTx = await dlmmPool.closePosition({
    owner: wallet.publicKey,
    position: position,
  });

  const txHash = await sendAndConfirmTransaction(
    connection,
    closePositionTx,
    [wallet]
  );
  
  return txHash;
}
