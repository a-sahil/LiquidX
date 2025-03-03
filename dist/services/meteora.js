var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fetch from "node-fetch";
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
class MeteoraService {
    static createPosition(dlmmPool, userKeypair, amountStr) {
        throw new Error("Method not implemented.");
    }
    static createDLMM(Address) {
        throw new Error("Method not implemented.");
    }
    static createDLMMInstance(Address) {
        throw new Error("Method not implemented.");
    }
    getPoolInfo(foundPool) {
        throw new Error("Method not implemented.");
    }
    constructor(connection) {
        this.connection = connection || new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);
        this.apiUrl = "https://dlmm-api.meteora.ag/pair/all";
    }
    preprocessPools(pools) {
        return pools.map((pool) => {
            var _a;
            return ({
                address: pool.address,
                name: pool.name,
                fees_24h: pool.fees_24h,
                fee_tvl_ratio: ((_a = pool.fee_tvl_ratio) === null || _a === void 0 ? void 0 : _a.hour_24) || 0,
            });
        });
    }
    extractPoolAddress(response) {
        const addressMatch = response.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        return addressMatch ? addressMatch[0] : null;
    }
    findBestPoolWithOpenAI(tokenPools) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const processedPools = this.preprocessPools(tokenPools);
                const prompt = {
                    role: "user",
                    content: `Given these liquidity pools, return ONLY the address of the pool with the highest fees and best metrics. Consider fees_24h as primary metric and fee_tvl_ratio as secondary metric. Pools: ${JSON.stringify(processedPools)}`,
                };
                const response = yield openai.chat.completions.create({
                    messages: [prompt],
                    model: "gpt-3.5-turbo",
                    temperature: 0.1,
                    max_tokens: 60,
                });
                const rawResponse = (_c = (_b = (_a = response === null || response === void 0 ? void 0 : response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim();
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
            }
            catch (error) {
                console.error("Error in finding best pool with OpenAI:", error);
                return this.getFallbackPool(tokenPools);
            }
        });
    }
    getFallbackPool(tokenPools) {
        return tokenPools.reduce((max, pool) => {
            return parseFloat(pool.fees_24h) > parseFloat(max.fees_24h) ? pool : max;
        }, tokenPools[0]);
    }
    getOptimalPool(tokenSymbol) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(this.apiUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch pools: ${response.statusText}`);
                }
                const pools = (yield response.json());
                const tokenPools = pools.filter((pool) => {
                    var _a;
                    const poolName = (_a = pool.name) === null || _a === void 0 ? void 0 : _a.toUpperCase();
                    return (poolName === null || poolName === void 0 ? void 0 : poolName.includes(tokenSymbol.toUpperCase())) && /\bSOL\b/.test(poolName);
                });
                if (tokenPools.length === 0) {
                    throw new Error(`No ${tokenSymbol}-SOL pools found`);
                }
                const bestPool = yield this.findBestPoolWithOpenAI(tokenPools);
                const detailsResponse = yield fetch(`https://dlmm-api.meteora.ag/pair/${bestPool.address}`);
                if (!detailsResponse.ok) {
                    throw new Error(`Failed to fetch pool details: ${detailsResponse.statusText}`);
                }
                const poolDetails = yield detailsResponse.json();
                return {
                    Pool: poolDetails.name,
                    Address: poolDetails.address,
                    "Bin Step": poolDetails.bin_step,
                    "Base Fee": `${poolDetails.base_fee_percentage}%`,
                    "24h Fee/TVL Ratio": poolDetails.fee_tvl_ratio.hour_24.toFixed(4),
                    "24h Fees": poolDetails.fees_24h,
                    "24h Volume": poolDetails.trade_volume_24h,
                };
            }
            catch (error) {
                console.error("Error finding optimal pool:", error);
                throw error;
            }
        });
    }
    createDLMM(poolAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                console.log("Creating DLMM instance for pool:", poolAddress);
                const poolPublicKey = new PublicKey(poolAddress);
                console.log("Pool PublicKey created:", poolPublicKey.toString());
                console.log("Loading DLMM program state...");
                const dlmmPool = yield DLMM.create(this.connection, poolPublicKey);
                console.log("DLMM instance created:", {
                    address: (_a = dlmmPool.pubkey) === null || _a === void 0 ? void 0 : _a.toString(),
                    tokenX: (_b = dlmmPool.tokenX) === null || _b === void 0 ? void 0 : _b.toString(),
                    tokenY: (_c = dlmmPool.tokenY) === null || _c === void 0 ? void 0 : _c.toString(),
                });
                console.log("Fetching active bin...");
                const activeBin = yield dlmmPool.getActiveBin();
                console.log("Active bin data:", activeBin);
                const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));
                console.log("Fetching bins around active bin...");
                const BINS_TO_FETCH_LEFT = 10;
                const BINS_TO_FETCH_RIGHT = 10;
                const { bins } = yield dlmmPool.getBinsAroundActiveBin(BINS_TO_FETCH_LEFT, BINS_TO_FETCH_RIGHT);
                return {
                    dlmmPool,
                    activeBin,
                    activeBinPricePerToken,
                    surroundingBins: bins,
                    feeInfo: dlmmPool.getFeeInfo(),
                    dynamicFee: dlmmPool.getDynamicFee(),
                };
            }
            catch (error) {
                console.error("Detailed error in createDLMM:", {
                    message: error.message,
                    stack: error.stack,
                    poolAddress,
                });
                throw error;
            }
        });
    }
    createPosition(userId, token, autoRebalance, poolInfo, wallet) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Creating position with params:", {
                    userId,
                    token,
                    autoRebalance,
                    poolAddress: poolInfo.Address,
                });
                const poolPublicKey = new PublicKey(poolInfo.Address);
                const dlmmPool = yield DLMM.create(this.connection, poolPublicKey);
                console.log("DLMM pool loaded:", {
                    address: dlmmPool.pubkey.toString(),
                    tokenX: dlmmPool.tokenX.toString(),
                    tokenY: dlmmPool.tokenY.toString(),
                });
                const activeBin = yield dlmmPool.getActiveBin();
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
                const createPositionTx = yield dlmmPool.initializePositionAndAddLiquidityByStrategy({
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
                const createPositionTxHash = yield sendAndConfirmTransaction(this.connection, createPositionTx, [userKeypair, newPositionKeypair]);
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
            }
            catch (error) {
                console.error("Detailed error in createPosition:", {
                    message: error.message,
                    stack: error.stack,
                    userId,
                    token,
                    poolInfo,
                });
                throw error;
            }
        });
    }
    getUserPositions(userId, wallet) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userPublicKey = new PublicKey(wallet.publicKey);
                const pools = yield this.getAllPools();
                let allPositions = [];
                for (const pool of pools) {
                    const dlmmPool = yield DLMM.create(this.connection, new PublicKey(pool.address));
                    const { userPositions } = yield dlmmPool.getPositionsByUserAndLbPair(userPublicKey);
                    if (userPositions.length > 0) {
                        const positions = userPositions.map((pos) => ({
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
            }
            catch (error) {
                console.error("Error fetching user positions:", error);
                throw error;
            }
        });
    }
    getAllPools() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(this.apiUrl);
            return (yield response.json());
        });
    }
}
export default MeteoraService;
//# sourceMappingURL=meteora.js.map