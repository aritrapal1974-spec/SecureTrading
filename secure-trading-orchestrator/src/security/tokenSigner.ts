import { createHmac, randomBytes } from "crypto";
import type { TradeIntent } from "../types/intent";

export class TokenSigner {
  private secret: Buffer;

  constructor(secretHex?: string) {
    this.secret = secretHex ? Buffer.from(secretHex, "hex") : randomBytes(32);
  }

  sign(intent: TradeIntent): { signature: string; expiry: string } {
    const expiry = new Date(Date.now() + 5 * 60_000).toISOString(); // 5 minutes validity
    const payload = this.canonicalPayload(intent, expiry);
    const sig = createHmac("sha256", this.secret).update(payload).digest("hex");
    return { signature: sig, expiry };
  }

  verify(intent: TradeIntent, signature: string, expiry: string) {
    if (new Date(expiry) < new Date()) return false;
    const payload = this.canonicalPayload(intent, expiry);
    const expected = createHmac("sha256", this.secret).update(payload).digest("hex");
    return signature === expected;
  }

  private canonicalPayload(intent: TradeIntent, expiry: string): string {
    const sortedIntent: any = {};
    Object.keys(intent)
      .sort()
      .forEach((key) => {
        sortedIntent[key] = (intent as any)[key];
      });
    return JSON.stringify({ intent: sortedIntent, expiry });
  }
}
