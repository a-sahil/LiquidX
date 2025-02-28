interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
  poolAddress?: string;
}

export const SUPPORTED_TOKENS: { [key: string]: TokenConfig } = {
  USDC: {
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimals: 9,
    symbol: "USDC",
    poolAddress: "",
  },
  SOL: {
    address: "So11111111111111111111111111111111111111112",
    decimals: 9,
    symbol: "SOL",
  },
};