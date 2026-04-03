import Alpaca from "@alpacahq/alpaca-trade-api";
import type { TradeIntent } from "../types/intent";
import { ArmorClaw } from "../security/armorClaw";

export class AlpacaExecutor {
  private client: InstanceType<typeof Alpaca>;
  private armor: ArmorClaw;

  constructor(
    config: { keyId: string; secretKey: string; paper: boolean },
    armor: ArmorClaw
  ) {
    this.client = new Alpaca(config);
    this.armor = armor;
  }

  async execute(intent: TradeIntent, sig: string, expiry: string) {
    if (!this.armor.verify(intent, sig, expiry))
      return { success: false as const, message: "Invalid signature" };
    const order = await this.client.createOrder({
      symbol: intent.ticker,
      qty: intent.quantity,
      side: intent.action.toLowerCase(),
      type: "market",
      time_in_force: "day",
    });
    return { success: true as const, order };
  }
}
