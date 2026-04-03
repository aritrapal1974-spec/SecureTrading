import { z } from "zod";
// ============================================================
// TRADE INTENT SCHEMA
// The strict typed contract for every trade request
// ============================================================
export const TradeActionSchema = z.enum(["BUY", "SELL"]);
export const TradeIntentSchema = z.object({
  intentId: z.string().uuid(),
  ticker: z.string().min(1).max(5),
  quantity: z.number().int().positive(),
  maxBudget: z.number().positive(),
  action: TradeActionSchema,
  limitPrice: z.number().positive().optional(),
  expiry: z.string().datetime(),
  originalInstruction: z.string(),
  createdAt: z.string().datetime(),
});
export type TradeIntent = z.infer<typeof TradeIntentSchema>;
export type TradeAction = z.infer<typeof TradeActionSchema>;
// ============================================================
// VALIDATION RESULT
// ============================================================
export interface ValidationResult {
  status: "APPROVED" | "REJECTED" | "ERROR";
  intentId: string;
  reason?: string;
  checks: ValidationCheck[];
  signedPayload?: SignedPayload;
  timestamp: string;
}
export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}
export interface SignedPayload {
  intent: TradeIntent;
  signature: string;
  expiry: string;
  validatedAt: string;
}
// ============================================================
// EXECUTION RESULT
// ============================================================
export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  message: string;
  details?: Record<string, unknown>;
}
// ============================================================
// AUDIT LOG ENTRY
// ============================================================
export interface AuditEntry {
  id?: number;
  timestamp: string;
  intentId: string;
  action: string;
  ticker: string;
  quantity: number;
  status: "ALLOWED" | "BLOCKED" | "EXECUTED" | "FAILED";
  reason: string;
  payload: string;
  signature?: string;
}
// ============================================================
// POLICY CONFIG
// ============================================================
export interface PolicyConfig {
  allowedTickers: string[];
  maxBudgetPerTrade: number;
  maxQuantityPerTrade: number;
  signatureValidityMs: number;
  allowAfterHours: boolean;
  rateLimiting: {
    maxTradesPerWindow: number;
    windowMs: number;
  };
}