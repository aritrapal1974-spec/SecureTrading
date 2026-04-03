import type { TradeIntent } from "../types/intent";
import { ACTIVE_POLICY } from "./policies";
import { TokenSigner } from "./tokenSigner";

export class ArmorClaw {
  private signer: TokenSigner;

  constructor(secretKey?: string) {
    this.signer = new TokenSigner(secretKey);
  }

  async validate(intent: TradeIntent) {
    try {
      if (!ACTIVE_POLICY.allowedTickers.has(intent.ticker))
        throw new Error("Ticker not allowed");
      if (intent.maxBudget > ACTIVE_POLICY.maxBudgetPerTrade)
        throw new Error("Budget limit exceeded");
      if (intent.quantity > ACTIVE_POLICY.maxQuantityPerTrade)
        throw new Error("Too many shares");
      const { signature, expiry } = this.signer.sign(intent);
      return { status: "APPROVED" as const, signature, expiry };
    } catch (e) {
      return { status: "REJECTED" as const, reason: (e as Error).message };
    }
  }

  verify(intent: TradeIntent, sig: string, expiry: string) {
    return this.signer.verify(intent, sig, expiry);
  }
}
