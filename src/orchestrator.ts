import { IntentParser } from "./parser/intentParser";
import { ArmorClaw } from "./security/armorClaw";
import { AlpacaExecutor } from "./execution/alpacaExecutor";
import { AuditLogger } from "./audit/auditLogger";
import { AnalystAgent } from "./agents/analystAgent";
import {
  TradeIntent,
  ValidationResult,
  ExecutionResult,
  AuditEntry,
  SignedPayload,
} from "./types/intent";
// ============================================================
// TRADING ORCHESTRATOR
// Coordinates all layers: parsing → validation → execution → audit
// ============================================================
export interface OrchestratorConfig {
  openrouterApiKey: string;
  alpaca: { keyId: string; secretKey: string; paper: boolean };
  armoriqApiKey: string;
  armoriqMcpUrl?: string;
  signerSecretKey?: string;
  auditDbPath?: string;
}
export class TradingOrchestrator {
  private parser: IntentParser;
  private armor: ArmorClaw;
  private executor: AlpacaExecutor;
  private logger: AuditLogger;
  private analyst: AnalystAgent;
  constructor(config: OrchestratorConfig) {
    this.parser = new IntentParser(config.openrouterApiKey);
    this.armor = new ArmorClaw(config.signerSecretKey, config.armoriqApiKey, config.armoriqMcpUrl);
    this.executor = new AlpacaExecutor(config.alpaca, this.armor);
    this.logger = new AuditLogger(config.auditDbPath || "./audit.db", config.armoriqMcpUrl, config.armoriqApiKey);
    this.analyst = new AnalystAgent();
    console.log("[Orchestrator] Initialized");
  }
  // ── Parse natural language ─────────────────────────────
  async parseInstruction(instruction: string): Promise<TradeIntent> {
    return this.parser.parse(instruction);
  }
  // ── Validate intent ────────────────────────────────────
  async validateIntent(intent: TradeIntent): Promise<ValidationResult> {
    return this.armor.validate(intent);
  }

  // ── Analyze intent with signed token ───────────────────
  async analyzeIntent(signedPayload: SignedPayload): Promise<any> {
    const delegation = await this.analyst.analyze(signedPayload);
    // For now, return delegation - in full implementation, pass to risk agent
    return delegation;
  }

  // ── Execute validated trade ────────────────────────────
  async executeIntent(
    intent: TradeIntent,
    validation: ValidationResult
  ): Promise<ExecutionResult> {
    if (!validation.signedPayload) {
      throw new Error("No signed payload — cannot execute");
    }
    const result = await this.executor.execute(validation.signedPayload);
    // Log execution
    await this.logger.log({
      timestamp: new Date().toISOString(),
      intentId: intent.intentId,
      action: intent.action,
      ticker: intent.ticker,
      quantity: intent.quantity,
      status: result.success ? "EXECUTED" : "FAILED",
      reason: result.message,
      payload: JSON.stringify(intent),
      signature: validation.signedPayload.signature,
    });
    return result;
  }
  // ── Full flow ──────────────────────────────────────────
  async processInstruction(instruction: string): Promise<{
    intent: TradeIntent;
    validation: ValidationResult;
    execution?: ExecutionResult;
  }> {
    const intent = await this.parseInstruction(instruction);
    const validation = await this.validateIntent(intent);
    // Log every attempt
    const logEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      intentId: intent.intentId,
      action: intent.action,
      ticker: intent.ticker,
      quantity: intent.quantity,
      status: validation.status === "APPROVED" ? "ALLOWED" : "BLOCKED",
      reason: validation.reason || validation.status,
      payload: JSON.stringify(intent),
    };
    if (validation.status !== "APPROVED") {
      await this.logger.log(logEntry);
      return { intent, validation };
    }
    logEntry.status = "EXECUTED";
    await this.logger.log(logEntry);
    const execution = await this.executeIntent(intent, validation);
    return { intent, validation, execution };
  }
  // ── Direct trade execution for MCP ─────────────────────
  async executeTrade(intent: TradeIntent): Promise<ExecutionResult> {
    const validation = await this.validateIntent(intent);
    if (validation.status !== "APPROVED") {
      return { success: false, message: validation.reason || "Validation failed" };
    }
    return this.executeIntent(intent, validation);
  }
  // ── Broker helpers ─────────────────────────────────────
  async getAccount(): Promise<any> {
    return this.executor.getAccount();
  }
  async getPositions(): Promise<any[]> {
    return this.executor.getPositions();
  }
  async getOrders(): Promise<any[]> {
    return this.executor.getOrders();
  }
  // ── Audit helpers ──────────────────────────────────────
  async getAuditLog(): Promise<AuditEntry[]> {
    return this.logger.getRecent(10);
  }
  async getAuditStats(): Promise<Record<string, number>> {
    return this.logger.getStats();
  }
  // ── Trading stats ──────────────────────────────────────
  async getTradingStats(): Promise<any> {
    return this.executor.getTradingStats();
  }
  shutdown(): void {
    this.logger.close();
  }
}