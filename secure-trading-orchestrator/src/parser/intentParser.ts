import { TradeIntent, TradeIntentSchema } from "../types/intent";

export class IntentParser {
  async parse(instruction: string): Promise<TradeIntent> {
    const { v4: uuidv4 } = await import("uuid");
    const tickerMatch = instruction.match(/\b[A-Z]{2,5}\b/);
    const qtyMatch = instruction.match(/(\d+)\s+shares?/i);
    const limitMatch = instruction.match(/\$(\d+(\.\d+)?)/);

    const ticker = tickerMatch ? tickerMatch[0] : "AAPL";
    const quantity = qtyMatch ? parseInt(qtyMatch[1]!, 10) : 1;
    const limitPrice = limitMatch ? parseFloat(limitMatch[1]!) : undefined;
    const now = new Date();
    const action = instruction.toLowerCase().includes("sell")
      ? ("SELL" as const)
      : ("BUY" as const);
    const intent = {
      intentId: uuidv4(),
      ticker,
      quantity,
      maxBudget: (limitPrice ?? 200) * quantity,
      action,
      limitPrice,
      expiry: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      originalInstruction: instruction,
      createdAt: now.toISOString(),
    };
    TradeIntentSchema.parse(intent);
    return intent;
  }
}
