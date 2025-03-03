import axios from "axios";
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import OpenAI from "openai";
import DLMM from "@meteora-ag/dlmm";
import { StrategyType } from "@meteora-ag/dlmm";
import { BN } from "@coral-xyz/anchor";
import dotenv from 'dotenv';
dotenv.config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PoolInfo {
  Pool: string;
  Address: string;
  "Bin Step": number;
  "Base Fee": string;
  "24h Fee/TVL Ratio": string;
  "24h Fees"?: string;
  "24h Volume"?: string;
}

class MeteoraService {
  static createPosition(dlmmPool: void, userKeypair: Keypair, amountStr: number) {
    throw new Error("Method not implemented.");
  }
  static createDLMM(Address: any) {
    throw new Error("Method not implemented.");
  }
  static createDLMMInstance(Address: any) {
    throw new Error("Method not implemented.");
  }
  getPoolInfo(foundPool: string) {
    throw new Error("Method not implemented.");
  }
  private connection: Connection;
  private apiUrl: string;

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);
    this.apiUrl = "https://dlmm-api.meteora.ag/pair/all";
  }

  private preprocessPools(pools: any[]): any[] {
    return pools.map((pool) => ({
      address: pool.address,
      name: pool.name,
      fees_24h: pool.fees_24h,
      fee_tvl_ratio: pool.fee_tvl_ratio?.hour_24 || 0,
    }));
  }

  private extractPoolAddress(response: string): string | null {
    const addressMatch = response.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    return addressMatch ? addressMatch[0] : null;
  }

  private async findBestPoolWithOpenAI(tokenPools: any[]): Promise<any> {
    try {
      const processedPools = this.preprocessPools(tokenPools);

      const prompt = {
        role: "user" as const,
        content: `Given these liquidity pools, return ONLY the address of the pool with the highest fees and best metrics. Consider fees_24h as primary metric and fee_tvl_ratio as secondary metric. Pools: ${JSON.stringify(processedPools)}`,
      };

      const response = await openai.chat.completions.create({
        messages: [prompt],
        model: "gpt-3.5-turbo",
        temperature: 0.1,
        max_tokens: 60,
      });

      const rawResponse = response?.choices[0]?.message?.content?.trim();
      console.log("Raw OpenAI response:", rawResponse);

      const poolAddress = rawResponse ? this.extractPoolAddress(rawResponse) : null;
      console.log("Extracted pool address:", poolAddress);

      if (!poolAddress) {
        console.warn("Could not extract valid pool address from OpenAI response");
        return this.getFallbackPool(tokenPools);
      }

      const selectedPool = tokenPools.find((pool) => pool.address === poolAddress);
      if (!selectedPool) {
        console.warn("Extracted address not found in pool list");
        return this.getFallbackPool(tokenPools);
      }

      return selectedPool;
    } catch (error) {
      console.error("Error in finding best pool with OpenAI:", error);
      return this.getFallbackPool(tokenPools);
    }
  }

  private getFallbackPool(tokenPools: any[]): any {
    return tokenPools.reduce((max, pool) => {
      return parseFloat(pool.fees_24h) > parseFloat(max.fees_24h) ? pool : max;
    }, tokenPools[0]);
  }

  async getOptimalPool(tokenSymbol: string): Promise<PoolInfo> {
    try {
      const response = await axios.get(this.apiUrl);
      const pools = response.data as any[];

      const tokenPools = pools.filter((pool) => {
        const poolName = pool.name?.toUpperCase();
        return poolName?.includes(tokenSymbol.toUpperCase()) && /\bSOL\b/.test(poolName);
      });

      if (tokenPools.length === 0) {
        throw new Error(`No ${tokenSymbol}-SOL pools found`);
      }

      const bestPool = await this.findBestPoolWithOpenAI(tokenPools);

      const detailsResponse = await axios.get(`https://dlmm-api.meteora.ag/pair/${bestPool.address}`);
      const poolDetails = detailsResponse.data as {
        name: string;
        address: string;
        bin_step: number;
        base_fee_percentage: number;
        fee_tvl_ratio: { hour_24: number };
        fees_24h: string;
        trade_volume_24h: string;
      };

      return {
        Pool: poolDetails.name,
        Address: poolDetails.address,
        "Bin Step": poolDetails.bin_step,
        "Base Fee": `${poolDetails.base_fee_percentage}%`,
        "24h Fee/TVL Ratio": poolDetails.fee_tvl_ratio.hour_24.toFixed(4),
        "24h Fees": poolDetails.fees_24h,
        "24h Volume": poolDetails.trade_volume_24h,
      };
    } catch (error) {
      console.error("Error finding optimal pool:", error);
      throw error;
    }
  }

  async createDLMM(poolAddress: string): Promise<any> {
    try {
      console.log("Creating DLMM instance for pool:", poolAddress);

      const poolPublicKey = new PublicKey(poolAddress);
      console.log("Pool PublicKey created:", poolPublicKey.toString());

      console.log("Loading DLMM program state...");
      const dlmmPool = await DLMM.create(this.connection, poolPublicKey);

      console.log("DLMM instance created:", {
        address: dlmmPool.pubkey?.toString(),
        tokenX: dlmmPool.tokenX?.toString(),
        tokenY: dlmmPool.tokenY?.toString(),
      });

      console.log("Fetching active bin...");
      const activeBin = await dlmmPool.getActiveBin();
      console.log("Active bin data:", activeBin);

      const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));

      console.log("Fetching bins around active bin...");
      const BINS_TO_FETCH_LEFT = 10;
      const BINS_TO_FETCH_RIGHT = 10;
      const { bins } = await dlmmPool.getBinsAroundActiveBin(BINS_TO_FETCH_LEFT,BINS_TO_FETCH_RIGHT);

      return {
        dlmmPool,
        activeBin,
        activeBinPricePerToken,
        surroundingBins: bins,
        feeInfo: dlmmPool.getFeeInfo(),
        dynamicFee: dlmmPool.getDynamicFee(),
      };
    } catch (error) {
      console.error("Detailed error in createDLMM:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        poolAddress,
      });
      throw error;
    }
  }

  async createPosition(userId: string, token: string, autoRebalance: boolean, poolInfo: PoolInfo, wallet: any): Promise<any> {
    try {
      console.log("Creating position with params:", {
        userId,
        token,
        autoRebalance,
        poolAddress: poolInfo.Address,
      });

      const poolPublicKey = new PublicKey(poolInfo.Address);
      const dlmmPool = await DLMM.create(this.connection, poolPublicKey);

      console.log("DLMM pool loaded:", {
        address: dlmmPool.pubkey.toString(),
        tokenX: dlmmPool.tokenX.toString(),
        tokenY: dlmmPool.tokenY.toString(),
      });

      const activeBin = await dlmmPool.getActiveBin();
      console.log("Active bin retrieved:", activeBin);

      const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));

      const TOTAL_RANGE_INTERVAL = 10;
      const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
      const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

      const newPositionKeypair = Keypair.generate();
      const totalXAmount = new BN(100 * 1e6);
      const totalYAmount = totalXAmount.mul(new BN(Math.floor(Number(activeBinPricePerToken)))); // Convert to number

      const userKeypair = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(wallet.secretKey, "hex")));

      console.log("Creating position transaction with parameters:", {
        minBinId,
        maxBinId,
        activeBinPrice: activeBinPricePerToken,
        totalXAmount: totalXAmount.toString(),
        totalYAmount: totalYAmount.toString(),
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

      const createPositionTxHash = await sendAndConfirmTransaction(this.connection, createPositionTx, [userKeypair, newPositionKeypair]);

      const position = {
        positionId: newPositionKeypair.publicKey.toString(),
        transactionHash: createPositionTxHash,
        tokenX: token,
        tokenY: "SOL",
        amountX: totalXAmount.toString(),
        amountY: totalYAmount.toString(),
        activeBin: {
          binId: activeBin.binId,
          price: activeBin.price.toString(),
          pricePerToken: activeBinPricePerToken,
        },
        binRange: {
          min: minBinId,
          max: maxBinId,
        },
        autoRebalance,
        status: "active",
      };

      console.log("Final position details:", position);
      return position;
    } catch (error) {
      console.error("Detailed error in createPosition:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        userId,
        token,
        poolInfo,
      });
      throw error;
    }
  }

  async getUserPositions(userId: string, wallet: any): Promise<any[]> {
    try {
      const userPublicKey = new PublicKey(wallet.publicKey);
      const pools = await this.getAllPools();

      let allPositions: any[] = [];

      for (const pool of pools) {
        const dlmmPool = await DLMM.create(this.connection, new PublicKey(pool.address));
        const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(userPublicKey);

        if (userPositions.length > 0) {
          const positions = userPositions.map((pos:any) => ({
            poolName: pool.name,
            positionAddress: pos.publicKey.toString(),
            binData: pos.positionData.positionBinData,
            liquidityProvided: pos.positionData.totalXAmount.toString(),
            rewardsEarned: "Calculating...",
            autoRebalance: true,
          }));

          allPositions = [...allPositions, ...positions];
        }
      }

      return allPositions;
    } catch (error) {
      console.error("Error fetching user positions:", error);
      throw error;
    }
  }

  async getAllPools(): Promise<any[]> {
    const response = await axios.get(this.apiUrl);
    return response.data as any[];
  }
}

export default MeteoraService;