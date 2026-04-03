import dotenv from "dotenv";
dotenv.config();
import { TradingOrchestrator } from "./orchestrator";
import { SecureTradingBot } from "./bot/telegramBot";
// ============================================================
// ENTRY POINT
// ============================================================
function validateEnv(): void {
  const required = [
    "TELEGRAM_BOT_TOKEN",
    "OPENROUTER_API_KEY",
    "ARMORIQ_API_KEY",
    "ALPACA_API_KEY",
    "ALPACA_SECRET_KEY",
    "SIGNER_SECRET_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("❌ Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
}
async function main(): Promise<void> {
  console.log("🚀 Starting Secure Trading Orchestrator...");
  validateEnv();
  // Initialize orchestrator
  const orchestrator = new TradingOrchestrator({
    openrouterApiKey: process.env.OPENROUTER_API_KEY!,
    alpaca: {
      keyId: process.env.ALPACA_API_KEY!,
      secretKey: process.env.ALPACA_SECRET_KEY!,
      paper: true, // Use paper trading
    },
    armoriqApiKey: process.env.ARMORIQ_API_KEY!,
    armoriqMcpUrl: process.env.ARMORIQ_MCP_URL,
    signerSecretKey: process.env.SIGNER_SECRET_KEY!,
    auditDbPath: process.env.AUDIT_DB_PATH || "./audit.db",
  });
  // Initialize Telegram bot
  new SecureTradingBot(process.env.TELEGRAM_BOT_TOKEN!, orchestrator);
  console.log("✅ SecureTrader Bot is live. Open Telegram and send /start");
  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    orchestrator.shutdown();
    process.exit(0);
  });
}
main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});