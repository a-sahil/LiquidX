var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import dotenv from 'dotenv';
dotenv.config();
class TokenService {
    getTokenPrice(token) {
        throw new Error("Method not implemented.");
    }
    constructor() {
        this.baseUrl = "https://api.coingecko.com/api/v3";
        this.connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, "confirmed");
    }
    formatToMillions(value) {
        return `${(value / 1000000).toFixed(3)}M`;
    }
    formatPrice(value) {
        return `${value.toFixed(3)}`;
    }
    formatPercentage(value) {
        return `${value.toFixed(3)}%`;
    }
    getTokenInfo() {
        return __awaiter(this, arguments, void 0, function* (coinId = "usd-coin") {
            var _a, _b;
            try {
                const response = yield axios.get(`${this.baseUrl}/coins/${coinId}`);
                const data = response.data;
                return {
                    price: this.formatPrice(data.market_data.current_price.usd),
                    marketCap: this.formatToMillions(data.market_data.market_cap.usd),
                    volumeStats: {
                        "1h": this.formatPercentage(((_a = data.market_data.price_change_percentage_1h_in_currency) === null || _a === void 0 ? void 0 : _a.usd) || 0),
                        "24h": this.formatPercentage(data.market_data.price_change_percentage_24h || 0),
                        "7d": this.formatPercentage(data.market_data.price_change_percentage_7d || 0),
                    },
                    solanaAddress: ((_b = data.platforms) === null || _b === void 0 ? void 0 : _b.solana) || "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                };
            }
            catch (error) {
                console.error("Error fetching token info:", error.message);
                throw error;
            }
        });
    }
    getTokenBalance(walletAddress, tokenMintAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const publicKey = new PublicKey(walletAddress);
                const tokenMint = new PublicKey(tokenMintAddress);
                const tokenAccounts = yield this.connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: TOKEN_PROGRAM_ID,
                });
                const tokenAccount = tokenAccounts.value.find((accountInfo) => {
                    const accountData = accountInfo.account.data.parsed;
                    return accountData.info.mint === tokenMint.toString();
                });
                if (tokenAccount) {
                    const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
                    const decimals = tokenAccount.account.data.parsed.info.tokenAmount.decimals;
                    return {
                        amount: balance,
                        symbol: "USDC",
                        decimals,
                    };
                }
                else {
                    return {
                        amount: 0,
                        symbol: "USDC",
                        decimals: 6,
                    };
                }
            }
            catch (error) {
                console.error("Error fetching token balance:", error.message);
                return {
                    amount: 0,
                    symbol: "USDC",
                    decimals: 6,
                };
            }
        });
    }
}
export default TokenService;
//# sourceMappingURL=token.js.map