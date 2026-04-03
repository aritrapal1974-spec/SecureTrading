import dotenv from "dotenv";
import { TradingOrchestrator } from "./orchestrator";

dotenv.config({ quiet: true });

(async () => {
  const orchestrator = new TradingOrchestrator(
    {
      keyId: process.env.ALPACA_API_KEY!,
      secretKey: process.env.ALPACA_SECRET_KEY!,
      paper: true,
    },
    process.env.SIGNER_SECRET_KEY!
  );
  await orchestrator.processInstruction("Buy 1 share of AAPL");
  await orchestrator.processInstruction("Buy 10 shares of NVDA");
})();
