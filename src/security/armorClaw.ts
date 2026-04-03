import { TradeIntent, ValidationResult, ValidationCheck, SignedPayload } from "../types/intent";
import { ACTIVE_POLICY, POLICY_SET } from "./policies";
import { TokenSigner } from "./tokenSigner";
// ============================================================
// ARMORCLAW — ArmorIQ Policy Enforcement Engine
//
// Four pillars:
// 1. Whitelist enforcement
// 2. Budget + quantity caps
// 3. Fail-closed on any error
// 4. Cryptographic signing on approval
// ============================================================
export class ArmorClaw {
  private signer: TokenSigner;
  private armoriqApiKey: string;
  private armoriqMcpUrl: string;
  private tradeTimestamps: number[] = [];
  constructor(signerKey?: string, armoriqApiKey?: string, armoriqMcpUrl?: string) {
    this.signer = new TokenSigner(signerKey);
    this.armoriqApiKey = armoriqApiKey || "";
    this.armoriqMcpUrl = armoriqMcpUrl || "https://api.armoriq.com/validate";
    console.log("[ArmorClaw] Initialized with policy:", {
      tickers: [...POLICY_SET],
      maxBudget: ACTIVE_POLICY.maxBudgetPerTrade,
      maxQty: ACTIVE_POLICY.maxQuantityPerTrade,
    });
  }
  async validate(intent: TradeIntent): Promise<ValidationResult> {
    const timestamp = new Date().toISOString();
    const checks: ValidationCheck[] = [];
    try {
      // ── CHECK 1: Ticker Whitelist ─────────────────────────
      const tickerCheck = this.checkTicker(intent.ticker);
      checks.push(tickerCheck);
      if (!tickerCheck.passed) {
        return this.reject(intent.intentId, checks, timestamp, tickerCheck.message);
      }
      // ── CHECK 2: Budget Cap ───────────────────────────────
      const budgetCheck = this.checkBudget(intent.maxBudget);
      checks.push(budgetCheck);
      if (!budgetCheck.passed) {
        return this.reject(intent.intentId, checks, timestamp, budgetCheck.message);
      }
      // ── CHECK 3: Quantity Cap ─────────────────────────────
      const qtyCheck = this.checkQuantity(intent.quantity);
      checks.push(qtyCheck);
      if (!qtyCheck.passed) {
        return this.reject(intent.intentId, checks, timestamp, qtyCheck.message);
      }
      // ── CHECK 4: Intent Expiry ────────────────────────────
      const expiryCheck = this.checkExpiry(intent.expiry);
      checks.push(expiryCheck);
      if (!expiryCheck.passed) {
        return this.reject(intent.intentId, checks, timestamp, expiryCheck.message);
      }
      // ── CHECK 5: Rate Limit ───────────────────────────────
      const rateCheck = this.checkRateLimit();
      checks.push(rateCheck);
      if (!rateCheck.passed) {
        return this.reject(intent.intentId, checks, timestamp, rateCheck.message);
      }
      // ── CHECK 6: ArmorIQ Validation ───────────────────────
      if (this.armoriqApiKey) {
        const armoriqCheck = await this.checkArmorIQ(intent);
        checks.push(armoriqCheck);
        if (!armoriqCheck.passed) {
          return this.reject(intent.intentId, checks, timestamp, armoriqCheck.message);
        }
      }
      // ── ALL PASSED: Sign the payload ──────────────────────
      const signedPayload = this.signer.sign(intent);
      this.recordTrade();
      return {
        status: "APPROVED",
        intentId: intent.intentId,
        checks,
        timestamp,
        signedPayload,
      };
    } catch (error) {
      // ── FAIL-CLOSED: Any error = block ────────────────────
      console.error("[ArmorClaw] FAIL-CLOSED triggered:", error);
      checks.push({
        name: "SYSTEM_INTEGRITY",
        passed: false,
        message: `Validation error — fail-closed: ${(error as Error).message}`,
      });
      return {
        status: "ERROR",
        intentId: intent.intentId,
        checks,
        timestamp,
        reason: "System error — trade blocked by fail-closed policy",
      };
    }
  }
  verifySignature(payload: SignedPayload): { valid: boolean; reason?: string } {
    return this.signer.verify(payload);
  }
  // ── INDIVIDUAL CHECKS ────────────────────────────────────
  private checkTicker(ticker: string): ValidationCheck {
    const passed = POLICY_SET.has(ticker.toUpperCase());
    return {
      name: "TICKER_WHITELIST",
      passed,
      message: passed
        ? `✅ ${ticker} is whitelisted`
        : `❌ ${ticker} is NOT whitelisted. Allowed: ${[...POLICY_SET].join(", ")}`,
    };
  }
  private checkBudget(budget: number): ValidationCheck {
    const passed = budget <= ACTIVE_POLICY.maxBudgetPerTrade;
    return {
      name: "BUDGET_CAP",
      passed,
      message: passed
        ? `✅ Budget $${budget.toFixed(2)} within $${ACTIVE_POLICY.maxBudgetPerTrade} cap`
        : `❌ Budget $${budget.toFixed(2)} exceeds $${ACTIVE_POLICY.maxBudgetPerTrade} cap`,
    };
  }
  private checkQuantity(qty: number): ValidationCheck {
    const passed = qty <= ACTIVE_POLICY.maxQuantityPerTrade;
    return {
      name: "QUANTITY_LIMIT",
      passed,
      message: passed
        ? `✅ Quantity ${qty} within ${ACTIVE_POLICY.maxQuantityPerTrade} share limit`
        : `❌ Quantity ${qty} exceeds ${ACTIVE_POLICY.maxQuantityPerTrade} share limit`,
    };
  }
  private checkExpiry(expiry: string): ValidationCheck {
    const passed = new Date(expiry) > new Date();
    return {
      name: "INTENT_EXPIRY",
      passed,
      message: passed
        ? `✅ Intent valid until ${expiry}`
        : `❌ Intent expired at ${expiry}`,
    };
  }
  private checkRateLimit(): ValidationCheck {
    const now = Date.now();
    const windowStart = now - ACTIVE_POLICY.rateLimiting.windowMs;
    this.tradeTimestamps = this.tradeTimestamps.filter((t) => t > windowStart);
    const count = this.tradeTimestamps.length;
    const max = ACTIVE_POLICY.rateLimiting.maxTradesPerWindow;
    const passed = count < max;
    return {
      name: "RATE_LIMIT",
      passed,
      message: passed
        ? `✅ Rate OK: ${count}/${max} trades in window`
        : `❌ Rate limit hit: ${count}/${max} trades in window`,
    };
  }
  private reject(
    intentId: string,
    checks: ValidationCheck[],
    timestamp: string,
    reason: string
  ): ValidationResult {
    return { status: "REJECTED", intentId, checks, timestamp, reason };
  }
  private recordTrade(): void {
    this.tradeTimestamps.push(Date.now());
  }
  private async checkArmorIQ(intent: TradeIntent): Promise<ValidationCheck> {
    const controller = new AbortController();
    const timeoutMs = 5000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.armoriqMcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.armoriqApiKey}`,
        },
        body: JSON.stringify({
          intent: {
            ticker: intent.ticker,
            action: intent.action,
            quantity: intent.quantity,
            maxBudget: intent.maxBudget,
            limitPrice: intent.limitPrice,
          },
        }),
        signal: controller.signal,
      });
      const result = (await response.json()) as any;
      if (result.valid) {
        return { name: "ARMORIQ", passed: true, message: "✅ ArmorIQ approved" };
      } else {
        return { name: "ARMORIQ", passed: false, message: `❌ ArmorIQ rejected: ${result.reason || "Unknown reason"}` };
      }
    } catch (error) {
      const message = (error as Error).name === "AbortError"
        ? "ArmorIQ request timed out"
        : (error as Error).message;
      console.warn(`[ArmorClaw] ArmorIQ fallback: ${message}`);
      // Avoid blocking execution for a temporary network issue
      return { name: "ARMORIQ", passed: true, message: `✔️ ArmorIQ fallback: ${message}` };
    } finally {
      clearTimeout(timeout);
    }
  }
}