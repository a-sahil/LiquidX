# LiquidX: Solana LP Manager for Meteora from Solana Agent Kit.

LiquidX is a seamless platform for liquidity provisioning on Solana DEXes, directly from Telegram!

Enter a token, pick an LP strategy of your choice, and create the position — the agent finds optimal pools and can auto-rebalance positions when needed to maximize fees and reduce impermanent loss.

## 🎯 Key Features

*   **📱 Easy Telegram Commands:** Intuitive commands for all your LP needs.
*   **🔄 Automated LP Management:** Sophisticated automation to keep your LPs performing optimally.
*   **📊 Market Intelligence:** Data-driven insights to make informed decisions.
*   **🛡️ Secure by Design:** Aims for non-custodial principles and user-controlled permissions.

## 📱 Easy Telegram Commands

*   `/start` - Begin your LP journey with CleopetraBot.
*   `/analyze` - Get market analysis and insights.
*   `/open_position` - View and manage your LP positions (corresponds to `/portfolio` in current code).
*   `/wallet` - Access wallet features.
*   `/portfolio` - View your positions.
*   `/optimize` - Get suggestions and execute optimizations for your positions.
*   `/alerts` - Set custom alerts for market movements or position status.
*   `/help` - Get a full list of commands and how to use them.


## 🔄 Automated LP Management

*   **Real-time Position Monitoring:** Keep a constant eye on your LP performance.
*   **Automated Yield Optimization:** The bot, powered by the **Solana Agent Kit**, can automatically rebalance positions to chase higher yields and adapt to market changes (experimental feature based on current code's auto-rebalancing).
*   **Risk Management Alerts:** Receive notifications for significant risk factors affecting your positions.
*   **Performance Tracking:** Detailed analytics on your LP earnings and overall performance.

## 📊 Market Intelligence

*   **Pool Performance Metrics:** Access data on which pools are performing best.
*   **Yield Opportunities:** Discover new and promising LP opportunities.
*   **Risk Assessments:** Understand the risks associated with different pools and strategies.
*   **Market Trends:** Stay ahead with insights on current market dynamics.

## ⚡ How It Works

1.  **Start the Bot:**
    *   Add **CleopetraBot** on Telegram.
    *   The bot will guide you through creating/accessing your managed Solana wallet.
    *   Set your initial preferences (e.g., for auto-rebalancing).
2.  **Manage Positions:**
    *   View your current LP positions and their status.
    *   Get optimization suggestions from the Solana Agent Kit.
    *   Execute trades (add/remove liquidity) directly through the bot.
    *   Monitor performance and earned fees.
3.  **Stay Updated:**
    *   Receive real-time alerts for important events (e.g., rebalancing actions).
    *   (Planned) Get daily or weekly performance summaries.
    *   Track your earnings over time.
    *   (Planned) Set custom notifications for specific market conditions.

## 🚀 Getting Started

1.  **Get  to use LiquidX** .
2.  Find CleopetraBot on Telegram and click **"Start"**.
3.  Follow the **setup wizard** to connect or set up your wallet and preferences.
4.  Begin **optimizing your LP positions** using the available commands!

## 🔗 Integrations

*   **Solana Agent Kit:** Powers advanced AI capabilities for market analysis, pool selection, and automated decision-making.
*   **Meteora:** Direct DEX integration for managing DLMM liquidity pools.
*   **Telegram:** User-friendly interface for all interactions.
*   **Wallet Adapters (Conceptual/Planned):** Aims to support secure connections to user wallets, aligning with non-custodial principles. (Current implementation generates a wallet managed by the bot).
*   **CoinGecko API:** For fetching token price information.
*   **MongoDB:** For persistent storage of user and position data.

## 🛡️ Security Features

```javascript
const SECURITY = {
    wallet_integration: "Non-custodial", // Aspirational: The bot aims for non-custodial principles.
                                       // Current code: bot manages a generated wallet, private key can be viewed by user.
    permissions: "User-controlled",      // You control the bot's actions on your behalf.
    monitoring: "24/7 alert system",   // For significant events and (planned) risk factors.
    protection: "Risk management protocols" // e.g., Automated rebalancing to mitigate IL.
};
