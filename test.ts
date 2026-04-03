import { TradingOrchestrator } from "./src/orchestrator";

async function test() {
  const orchestrator = new TradingOrchestrator({
    openrouterApiKey: process.env.OPENROUTER_API_KEY!,
    alpaca: {
      keyId: process.env.ALPACA_API_KEY!,
      secretKey: process.env.ALPACA_SECRET_KEY!,
      paper: true,
    },
    armoriqApiKey: process.env.ARMORIQ_API_KEY!,
    signerSecretKey: process.env.SIGNER_SECRET_KEY!,
    auditDbPath: "./audit.db",
  });

  try {
    console.log("Testing parsing: 'Buy 2 shares of AAPL'");
    const intent = await orchestrator.parseInstruction("Buy 2 shares of AAPL");
    console.log("Intent:", intent);

    console.log("Testing validation...");
    const validation = await orchestrator.validateIntent(intent);
    console.log("Validation:", validation);

    if (validation.status === "APPROVED") {
      console.log("Testing execution...");
      const execution = await orchestrator.executeIntent(intent, validation);
      console.log("Execution:", execution);
    }
  } catch (error) {
    console.error("Error:", error);
  }

  orchestrator.shutdown();
}

test();