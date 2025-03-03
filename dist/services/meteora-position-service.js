var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// MeteoraPositionService remains unchanged
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { BN } from "@coral-xyz/anchor";
import dotenv from 'dotenv';
import Decimal from 'decimal.js';
import axios from "axios";
dotenv.config();
class MeteoraPositionService {
    getBaseUrl() {
        return this.baseUrl;
    }
    constructor(connection) {
        this.baseUrl = "https://dlmm-api.meteora.ag";
        this.connection = connection || new Connection(process.env.HELIUS_API_KEY
            ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
            : 'https://api.mainnet-beta.solana.com');
    }
    createDLMMInstance(poolAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const poolPublicKey = new PublicKey(poolAddress);
                const dlmmPool = yield DLMM.create(this.connection, poolPublicKey);
                console.log("DLMM instance created:", { address: poolPublicKey.toString() });
                return dlmmPool;
            }
            catch (error) {
                console.error("Error creating DLMM instance:", error);
                throw error;
            }
        });
    }
    getActiveBinInfo(dlmmPool) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeBin = yield dlmmPool.getActiveBin();
                const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));
                console.log("Active bin info fetched:", { binId: activeBin.binId, price: activeBinPricePerToken });
                return {
                    activeBin,
                    activeBinPricePerToken,
                    binId: activeBin.binId,
                };
            }
            catch (error) {
                console.error("Error getting active bin:", error);
                throw error;
            }
        });
    }
    createPosition(dlmmPool_1, userKeypair_1, amount_1) {
        return __awaiter(this, arguments, void 0, function* (dlmmPool, userKeypair, amount, options = {}) {
            try {
                const newPositionKeypair = Keypair.generate();
                const rangeInterval = options.rangeInterval || 20;
                const { activeBin, activeBinPricePerToken, binId } = yield this.getActiveBinInfo(dlmmPool);
                const minBinId = binId - rangeInterval;
                const maxBinId = binId + rangeInterval;
                const totalXAmount = new BN(amount * Math.pow(10, 6));
                const totalYAmount = totalXAmount.mul(new BN(Math.round(Number(activeBinPricePerToken) * Math.pow(10, 6))));
                console.log("Creating position with parameters:", {
                    positionId: newPositionKeypair.publicKey.toString(),
                    minBinId,
                    maxBinId,
                    totalXAmount: totalXAmount.toString(),
                    totalYAmount: totalYAmount.toString(),
                    activeBinPricePerToken,
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
                const txHash = yield sendAndConfirmTransaction(this.connection, createPositionTx, [userKeypair, newPositionKeypair]);
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
            }
            catch (error) {
                console.error("Error creating position:", error);
                throw error;
            }
        });
    }
    getUserPositions(userPublicKey, poolAddresses) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const allPositions = [];
                for (const poolAddress of poolAddresses) {
                    if (!poolAddress)
                        continue;
                    const dlmmPool = yield this.createDLMMInstance(poolAddress);
                    const { userPositions } = yield dlmmPool.getPositionsByUserAndLbPair(userPublicKey);
                    if (userPositions.length > 0) {
                        console.log(`Found ${userPositions.length} positions for user ${userPublicKey.toBase58()} in pool ${poolAddress}`);
                    }
                    else {
                        console.log(`No positions found in pool ${poolAddress} for user ${userPublicKey.toBase58()}`);
                    }
                    if (userPositions && userPositions.length > 0) {
                        const enhancedPositions = userPositions.map((position) => {
                            return Object.assign(Object.assign({}, position), { pool: {
                                    publicKey: new PublicKey(poolAddress),
                                    tokenA: { symbol: "Token A" },
                                    tokenB: { symbol: "Token B" }
                                } });
                        });
                        allPositions.push(...enhancedPositions);
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
    removePositionLiquidity(dlmmPool, userKeypair, positionAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const positionPublicKey = new PublicKey(positionAddress);
                const { userPositions } = yield dlmmPool.getPositionsByUserAndLbPair(userKeypair.publicKey);
                const userPosition = userPositions.find(({ publicKey }) => publicKey.equals(positionPublicKey));
                if (!userPosition) {
                    throw new Error("Position not found in user's portfolio");
                }
                // Get bin IDs from positionData.positionBinData (keep negative values as is)
                const binIdsToRemove = userPosition.positionData.positionBinData
                    .map((bin) => bin.binId)
                    .filter((binId) => binId !== undefined && typeof binId === 'number');
                console.log(`Checking liquidity for position ${positionAddress} with bin IDs:`, binIdsToRemove);
                console.log("Raw positionBinData:", userPosition.positionData.positionBinData);
                // Update the liquidity check to use positionXAmount and positionYAmount with validation
                const BN = require("bn.js");
                const hasLiquidity = userPosition.positionData.positionBinData.some((bin) => {
                    try {
                        let positionXAmount;
                        let positionYAmount;
                        // Handle positionXAmount
                        if (bin.positionXAmount === undefined || bin.positionXAmount === null) {
                            positionXAmount = new BN(0);
                        }
                        else if (typeof bin.positionXAmount === 'string') {
                            const numericValue = new Decimal(bin.positionXAmount).mul(new Decimal(Math.pow(10, 9))).toFixed(0); // Adjust decimals as needed (e.g., 9 for SOL)
                            positionXAmount = new BN(numericValue);
                        }
                        else if (typeof bin.positionXAmount === 'number') {
                            positionXAmount = new BN(Math.floor(bin.positionXAmount * Math.pow(10, 9))); // Adjust decimals as needed
                        }
                        else {
                            throw new Error(`Invalid positionXAmount format: ${bin.positionXAmount}`);
                        }
                        // Handle positionYAmount
                        if (bin.positionYAmount === undefined || bin.positionYAmount === null) {
                            positionYAmount = new BN(0);
                        }
                        else if (typeof bin.positionYAmount === 'string') {
                            const numericValue = new Decimal(bin.positionYAmount).mul(new Decimal(Math.pow(10, 9))).toFixed(0); // Adjust decimals as needed
                            positionYAmount = new BN(numericValue);
                        }
                        else if (typeof bin.positionYAmount === 'number') {
                            positionYAmount = new BN(Math.floor(bin.positionYAmount * Math.pow(10, 9))); // Adjust decimals as needed
                        }
                        else {
                            throw new Error(`Invalid positionYAmount format: ${bin.positionYAmount}`);
                        }
                        return positionXAmount.gt(new BN(0)) || positionYAmount.gt(new BN(0));
                    }
                    catch (error) {
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
                    const removeLiquidityTx = yield dlmmPool.removeLiquidity({
                        position: userPosition.publicKey,
                        user: userKeypair.publicKey,
                        binIds: adjustedBinIds, // Use negative bin IDs
                        bps: bps, // Use 100% for full removal
                        shouldClaimAndClose: true
                    });
                    const txSignatures = [];
                    for (let tx of Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx]) {
                        const signature = yield sendAndConfirmTransaction(this.connection, tx, [userKeypair], {
                            skipPreflight: false,
                            preflightCommitment: "confirmed",
                            maxRetries: 5 // Increase retries for robustness
                        });
                        txSignatures.push(signature);
                        console.log(`Transaction confirmed: ${signature}`);
                    }
                    console.log(`Liquidity removed and position closed with tx signatures:`, txSignatures);
                    return txSignatures;
                }
                catch (error) {
                    console.error("Detailed error in removeLiquidity:", error);
                    if (error instanceof Error) {
                        throw new Error(`Failed to remove liquidity: ${error.message}. Check logs for params.`);
                    }
                    throw new Error("Failed to remove liquidity due to an unknown error. Check logs for details.");
                }
            }
            catch (error) {
                console.error("Error processing position liquidity removal:", error);
                if (error instanceof Error) {
                    throw new Error(`Liquidity removal failed: ${error.message}`);
                }
                throw new Error("Liquidity removal failed due to an unknown error.");
            }
        });
    }
    // Custom function to fetch position data from the API with better error handling
    fetchPositionData(positionAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                console.log(`Fetching position data for: ${positionAddress} from ${this.baseUrl}/position/${positionAddress}`);
                const response = yield axios.get(`${this.baseUrl}/position/${positionAddress}`, {
                    timeout: 10000 // 10 second timeout
                });
                console.log(`API Response status: ${response.status}, data:`, response.data);
                return response.data;
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    console.error(`Error fetching position data: ${(_a = error.response) === null || _a === void 0 ? void 0 : _a.status} - ${error.message}`);
                    console.error(`Request URL: ${this.baseUrl}/position/${positionAddress}`);
                    if (error.response) {
                        console.error("Response data:", error.response.data);
                    }
                }
                else {
                    console.error("Unknown error fetching position data:", error);
                }
                return null;
            }
        });
    }
}
export default MeteoraPositionService;
//# sourceMappingURL=meteora-position-service.js.map