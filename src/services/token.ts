import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import dotenv from 'dotenv';
dotenv.config();

interface TokenInfo {
  price: string;
  marketCap: string;
  volumeStats: { [key: string]: string };
  solanaAddress: string;
}

interface TokenBalance {
  amount: number;
  symbol: string;
  decimals: number;
}

class TokenService {
  getTokenPrice(token: any) {
    throw new Error("Method not implemented.");
  }
  private baseUrl: string;
  private connection: Connection;

  constructor() {
    this.baseUrl = "https://api.coingecko.com/api/v3";
    this.connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, "confirmed");
  }

  formatToMillions(value: number): string {
    return `${(value / 1000000).toFixed(3)}M`;
  }

  formatPrice(value: number): string {
    return `${value.toFixed(3)}`;
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(3)}%`;
  }

  async getTokenInfo(coinId: string = "usd-coin"): Promise<TokenInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/coins/${coinId}`);
      const data = response.data as { market_data: { current_price: { usd: number }, market_cap: { usd: number }, price_change_percentage_1h_in_currency?: { usd?: number }, price_change_percentage_24h?: number,price_change_percentage_7d?: number },  platforms?: { [key: string]: string }  };
      return {
        price: this.formatPrice(data.market_data.current_price.usd),
        marketCap: this.formatToMillions(data.market_data.market_cap.usd),
        volumeStats: {
          "1h": this.formatPercentage(data.market_data.price_change_percentage_1h_in_currency?.usd || 0),
          "24h": this.formatPercentage(data.market_data.price_change_percentage_24h || 0),
          "7d": this.formatPercentage(data.market_data.price_change_percentage_7d || 0),
        },
        solanaAddress: data.platforms?.solana || "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      };
    } catch (error) {
      console.error("Error fetching token info:", (error as Error).message);
      throw error;
    }
  }

  async getTokenBalance(walletAddress: string, tokenMintAddress: string): Promise<TokenBalance> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const tokenMint = new PublicKey(tokenMintAddress);

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
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
      } else {
        return {
          amount: 0,
          symbol: "USDC",
          decimals: 6,
        };
      }
    } catch (error) {
      console.error("Error fetching token balance:", (error as Error).message);
      return {
        amount: 0,
        symbol: "USDC",
        decimals: 6,
      };
    }
  }
}

export default TokenService;