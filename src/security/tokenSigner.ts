import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { TradeIntent, SignedPayload } from "../types/intent";
import { ACTIVE_POLICY } from "./policies";
// ============================================================
// TOKEN SIGNER
// HMAC-SHA256 based cryptographic signing for trade payloads
// ============================================================
export class TokenSigner {
  private secret: Buffer;
  constructor(secretHex?: string) {
    if (secretHex && secretHex.length >= 32) {
      this.secret = Buffer.from(secretHex, "hex");
    } else {
      this.secret = randomBytes(32);
      console.warn("[TokenSigner] No secret key provided — using ephemeral key");
    }
  }
  sign(intent: TradeIntent): SignedPayload {
    const validatedAt = new Date().toISOString();
    const expiry = new Date(
      Date.now() + ACTIVE_POLICY.signatureValidityMs
    ).toISOString();
    const data = this.buildSignableString(intent, expiry);
    const signature = createHmac("sha256", this.secret)
      .update(data)
      .digest("hex");
    return { intent, signature, expiry, validatedAt };
  }
  verify(payload: SignedPayload): { valid: boolean; reason?: string } {
    // Check expiry
    if (new Date(payload.expiry) < new Date()) {
      return { valid: false, reason: "Signed payload has expired" };
    }
    // Rebuild expected signature
    const data = this.buildSignableString(payload.intent, payload.expiry);
    const expected = createHmac("sha256", this.secret)
      .update(data)
      .digest("hex");
    // Constant-time comparison prevents timing attacks
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(payload.signature, "hex");
    if (expectedBuf.length !== actualBuf.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }
    const match = timingSafeEqual(expectedBuf, actualBuf);
    return match
      ? { valid: true }
      : { valid: false, reason: "Signature mismatch — payload tampered" };
  }
  private buildSignableString(intent: TradeIntent, expiry: string): string {
    return JSON.stringify({
      intentId: intent.intentId,
      ticker: intent.ticker,
      quantity: intent.quantity,
      maxBudget: intent.maxBudget,
      action: intent.action,
      expiry,
    });
  }
}