import { IntentParser } from "./parser/intentParser";
import { ArmorClaw } from "./security/armorClaw";
import { AlpacaExecutor } from "./execution/alpacaExecutor";
import { AuditLogger } from "./audit/auditLogger";

export class TradingOrchestrator {
  private parser = new IntentParser();
  private armor: ArmorClaw;
  private executor: AlpacaExecutor;
  private logger = new AuditLogger();

  constructor(
    alpacaCfg: { keyId: string; secretKey: string; paper: boolean },
    signerKey: string
  ) {
    this.armor = new ArmorClaw(signerKey);
    this.executor = new AlpacaExecutor(alpacaCfg, this.armor);
  }

  async processInstruction(text: string) {
    console.log(`Instruction: "${text}"`);
    const intent = await this.parser.parse(text);
    const validation = await this.armor.validate(intent);
    if (validation.status !== "APPROVED") {
      console.log("❌ Blocked:", validation.reason);
      this.logger.log({
        action: intent.action,
        ticker: intent.ticker,
        status: "BLOCKED",
        reason: validation.reason,
      });
      return;
    }
    console.log("✅ Approved, executing...");
    try {
      const result = await this.executor.execute(
        intent,
        validation.signature,
        validation.expiry
      );
      const status = result.success ? "EXECUTED" : "FAILED";
      this.logger.log({
        action: intent.action,
        ticker: intent.ticker,
        status,
        reason: result.success ? "Order sent" : result.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log("❌ Execution error:", message);
      this.logger.log({
        action: intent.action,
        ticker: intent.ticker,
        status: "FAILED",
        reason: message,
      });
    }
  }
}
