// MeteoraPositionService remains unchanged
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { BN } from "@coral-xyz/anchor";
import dotenv from 'dotenv';
import Decimal from 'decimal.js';
import axios from "axios";
dotenv.config();

interface Position {
  positionId: string;
  transactionHash: string;
  positionDetails: {
    binRange: { minBinId: number; maxBinId: number };
    amounts: { x: string; y: string };
    activeBin: { binId: number; price: string; pricePerToken: number };
  };
}

interface UserPosition {
  positionAddress: string;
  binData: any;
  liquidityProvided: { x: string; y: string };
  status: string;
}

class MeteoraPositionService {

  private connection: Connection;
  private baseUrl = "https://dlmm-api.meteora.ag";
  public getBaseUrl(): string {
    return this.baseUrl;
  }
  
  constructor(connection?: Connection) {
    this.connection = connection || new Connection(
      process.env.HELIUS_API_KEY 
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` 
        : 'https://api.mainnet-beta.solana.com');
  }
  
  async createDLMMInstance(poolAddress: string): Promise<any> {
    try {
      const poolPublicKey = new PublicKey(poolAddress);
      const dlmmPool = await DLMM.create(this.connection, poolPublicKey);
      console.log("DLMM instance created:", { address: poolPublicKey.toString() });
      return dlmmPool;
    } catch (error) {
      console.error("Error creating DLMM instance:", error);
      throw error;
    }
  }
  
  async getActiveBinInfo(dlmmPool: any): Promise<{ activeBin: any; activeBinPricePerToken: number; binId: number }> {
    try {
      const activeBin = await dlmmPool.getActiveBin();
      const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));
      console.log("Active bin info fetched:", { binId: activeBin.binId, price: activeBinPricePerToken });
      return {
        activeBin,
        activeBinPricePerToken,
        binId: activeBin.binId,
      };
    } catch (error) {
      console.error("Error getting active bin:", error);
      throw error;
    }
  }
  
  async createPosition(dlmmPool: any, userKeypair: Keypair, amount: number, options: { rangeInterval?: number } = {}): Promise<Position> {
    try {
      const newPositionKeypair = Keypair.generate();
      const rangeInterval = options.rangeInterval || 20;
      
      const { activeBin, activeBinPricePerToken, binId } = await this.getActiveBinInfo(dlmmPool);
      const minBinId = binId - rangeInterval;
      const maxBinId = binId + rangeInterval;

      const totalXAmount = new BN(amount * 10 ** 6); 
      const totalYAmount = totalXAmount.mul(new BN(Math.round(Number(activeBinPricePerToken) * 10 ** 6)));

      console.log("Creating position with parameters:", {
        positionId: newPositionKeypair.publicKey.toString(),
        minBinId,
        maxBinId,
        totalXAmount: totalXAmount.toString(),
        totalYAmount: totalYAmount.toString(),
        activeBinPricePerToken,
      });

      const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newPositionKeypair.publicKey,
        user: userKeypair.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.SpotBalanced,
        },
      });

      const txHash = await sendAndConfirmTransaction(this.connection, createPositionTx, [userKeypair, newPositionKeypair]);
      console.log("Position created successfully with tx hash:", txHash);

      return {
        positionId: newPositionKeypair.publicKey.toString(),
        transactionHash: txHash,
        positionDetails: {
          binRange: { minBinId, maxBinId },
          amounts: {
            x: totalXAmount.toString(),
            y: totalYAmount.toString(),
          },
          activeBin: {
            binId: activeBin.binId,
            price: activeBin.price.toString(),
            pricePerToken: activeBinPricePerToken,
          },
        },
      };
    } catch (error) {
      console.error("Error creating position:", error);
      throw error;
    }
  }
  
  async getUserPositions(userPublicKey: PublicKey, poolAddresses: string[]): Promise<any[]> {
    try {
      const allPositions = [];
      
      for (const poolAddress of poolAddresses) {
        if (!poolAddress) continue;
        
        const dlmmPool = await this.createDLMMInstance(poolAddress);
        const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(userPublicKey);
        
        if (userPositions.length > 0) {
          console.log(`Found ${userPositions.length} positions for user ${userPublicKey.toBase58()} in pool ${poolAddress}`);
        } else {
          console.log(`No positions found in pool ${poolAddress} for user ${userPublicKey.toBase58()}`);
        }
        
        if (userPositions && userPositions.length > 0) {
          const enhancedPositions = userPositions.map((position: any) => {
            return {
              ...position,
              pool: {
                publicKey: new PublicKey(poolAddress),
                tokenA: { symbol: "Token A" },
                tokenB: { symbol: "Token B" }
              }
            };
          });
          allPositions.push(...enhancedPositions);
        }
      }
      
      return allPositions;
    } catch (error) {
      console.error("Error fetching user positions:", error);
      throw error;
    }
  }
  
  async removePositionLiquidity(dlmmPool: any, userKeypair: Keypair, positionAddress: string): Promise<string[]> {
    try {
      const positionPublicKey = new PublicKey(positionAddress);
      const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(userKeypair.publicKey);
      
      const userPosition = userPositions.find(
        ({ publicKey }: { publicKey: PublicKey }) => publicKey.equals(positionPublicKey)
      );
      
      if (!userPosition) {
        throw new Error("Position not found in user's portfolio");
      }
      
      // Get bin IDs from positionData.positionBinData (keep negative values as is)
      const binIdsToRemove = userPosition.positionData.positionBinData
        .map((bin: { binId: any }) => bin.binId)
        .filter((binId: any) => binId !== undefined && typeof binId === 'number');
      
      console.log(`Checking liquidity for position ${positionAddress} with bin IDs:`, binIdsToRemove);
      console.log("Raw positionBinData:", userPosition.positionData.positionBinData);
      
      // Update the liquidity check to use positionXAmount and positionYAmount with validation
      const BN = require("bn.js");
      const hasLiquidity = userPosition.positionData.positionBinData.some((bin: any) => {
        try {
          let positionXAmount: BN;
          let positionYAmount: BN;
  
          // Handle positionXAmount
          if (bin.positionXAmount === undefined || bin.positionXAmount === null) {
            positionXAmount = new BN(0);
          } else if (typeof bin.positionXAmount === 'string') {
            const numericValue = new Decimal(bin.positionXAmount).mul(new Decimal(10 ** 9)).toFixed(0); // Adjust decimals as needed (e.g., 9 for SOL)
            positionXAmount = new BN(numericValue);
          } else if (typeof bin.positionXAmount === 'number') {
            positionXAmount = new BN(Math.floor(bin.positionXAmount * 10 ** 9)); // Adjust decimals as needed
          } else {
            throw new Error(`Invalid positionXAmount format: ${bin.positionXAmount}`);
          }
  
          // Handle positionYAmount
          if (bin.positionYAmount === undefined || bin.positionYAmount === null) {
            positionYAmount = new BN(0);
          } else if (typeof bin.positionYAmount === 'string') {
            const numericValue = new Decimal(bin.positionYAmount).mul(new Decimal(10 ** 9)).toFixed(0); // Adjust decimals as needed
            positionYAmount = new BN(numericValue);
          } else if (typeof bin.positionYAmount === 'number') {
            positionYAmount = new BN(Math.floor(bin.positionYAmount * 10 ** 9)); // Adjust decimals as needed
          } else {
            throw new Error(`Invalid positionYAmount format: ${bin.positionYAmount}`);
          }
  
          return positionXAmount.gt(new BN(0)) || positionYAmount.gt(new BN(0));
        } catch (error) {
          console.error(`Error processing bin ${bin.binId}:`, error);
          return false; // Skip this bin if there's an error, but continue checking others
        }
      });
      
      if (!hasLiquidity) {
        console.log(`No liquidity found in position ${positionAddress}`);
        throw new Error("No liquidity available to remove from this position");
      }
      
      console.log(`Removing liquidity from position ${positionAddress} with bin IDs:`, binIdsToRemove);
      
      // Use a single bps value (10000 for 100%) instead of an array, as per SDK
      const bps = new BN(10000); // 100% in basis points for the entire range
      
      // Use negative bin IDs directly (remove the positive conversion)
      const adjustedBinIds = binIdsToRemove; // Keep negative values (e.g., -4958 to -4918)
      
      // Log all parameters before calling removeLiquidity for debugging
      console.log("removeLiquidity params:", {
        position: userPosition.publicKey.toString(),
        user: userKeypair.publicKey.toString(),
        binIds: adjustedBinIds,
        bps: bps,
        shouldClaimAndClose: true
      });
      
      try {
        const removeLiquidityTx = await dlmmPool.removeLiquidity({
          position: userPosition.publicKey,
          user: userKeypair.publicKey,
          binIds: adjustedBinIds, // Use negative bin IDs
          bps: bps, // Use 100% for full removal
          shouldClaimAndClose: true
        });
        
        const txSignatures = [];
        for (let tx of Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx]) {
          const signature = await sendAndConfirmTransaction(
            this.connection,
            tx,
            [userKeypair],
            { 
              skipPreflight: false, 
              preflightCommitment: "confirmed",
              maxRetries: 5 // Increase retries for robustness
            }
          );
          txSignatures.push(signature);
          console.log(`Transaction confirmed: ${signature}`);
        }
        
        console.log(`Liquidity removed and position closed with tx signatures:`, txSignatures);
        return txSignatures;
      } catch (error) {
        console.error("Detailed error in removeLiquidity:", error);
        if (error instanceof Error) {
          throw new Error(`Failed to remove liquidity: ${error.message}. Check logs for params.`);
        }
        throw new Error("Failed to remove liquidity due to an unknown error. Check logs for details.");
      }
      
    } catch (error) {
      console.error("Error processing position liquidity removal:", error);
      if (error instanceof Error) {
        throw new Error(`Liquidity removal failed: ${error.message}`);
      }
      throw new Error("Liquidity removal failed due to an unknown error.");
    }
  }

// Custom function to fetch position data from the API with better error handling
async fetchPositionData(positionAddress: string) {
  try {
    console.log(`Fetching position data for: ${positionAddress} from ${this.baseUrl}/position/${positionAddress}`);
    const response = await axios.get(`${this.baseUrl}/position/${positionAddress}`, {
      timeout: 10000 // 10 second timeout
    });
    console.log(`API Response status: ${response.status}, data:`, response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Error fetching position data: ${error.response?.status} - ${error.message}`);
      console.error(`Request URL: ${this.baseUrl}/position/${positionAddress}`);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
    } else {
      console.error("Unknown error fetching position data:", error);
    }
    return null;
  }
}
}

export default MeteoraPositionService;