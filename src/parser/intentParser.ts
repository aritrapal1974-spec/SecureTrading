import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { TradeIntent, TradeIntentSchema } from "../types/intent";
import { ACTIVE_POLICY } from "../security/policies";
// ============================================================
// INTENT PARSER — Powered by OpenAI (via OpenRouter)
//
// Converts natural language → strictly typed TradeIntent
// OpenAI is UNTRUSTED — output is validated with Zod
// ============================================================
export class IntentParser {
  private client: OpenAI;
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  async parse(instruction: string): Promise<TradeIntent> {
    console.log("[IntentParser] Parsing:", instruction);
    const prompt = this.buildPrompt(instruction);
    const result = await this.client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    const text = result.choices[0].message.content;
    if (!text) {
      throw new Error("OpenAI returned null content");
    }
    console.log("[IntentParser] OpenAI text:", text);
    // Extract JSON from OpenAI response
    const parsed = this.extractJSON(text);
    if (!parsed) {
      throw new Error("OpenAI failed to return valid JSON");
    }
    // Build full intent
    const now = new Date();
    const expiry = new Date(now.getTime() + 5 * 60 * 1000);
    const intent: TradeIntent = {
      intentId: uuidv4(),
      ticker: String(parsed.ticker || "").toUpperCase().trim(),
      quantity: Number(parsed.quantity),
      maxBudget: Number(parsed.maxBudget) || this.estimateBudget(String(parsed.ticker), Number(parsed.quantity)),
      action: String(parsed.action || "BUY").toUpperCase() as "BUY" | "SELL",
      limitPrice: parsed.limitPrice ? Number(parsed.limitPrice) : undefined,
      expiry: expiry.toISOString(),
      originalInstruction: instruction,
      createdAt: now.toISOString(),
    };
    // Validate with Zod — rejects if OpenAI hallucinated invalid fields
    const validated = TradeIntentSchema.safeParse(intent);
    if (!validated.success) {
      throw new Error(`Intent schema failed: ${validated.error.message}`);
    }
    console.log("[IntentParser] Intent created:", validated.data.intentId);
    return validated.data;
  }
  private buildPrompt(instruction: string): string {
    return `
You are a trade intent parser. Extract trading information from this instruction.
Return ONLY valid JSON with these exact fields:
{
  "action": "BUY" or "SELL",
  "ticker": "stock symbol (e.g. AAPL)",
  "quantity": number of shares (must be exactly the number mentioned in the instruction),
  "limitPrice": limit price in USD (number or null),
  "maxBudget": maximum budget in USD (number)
}
Rules:
- action must be exactly "BUY" or "SELL". Set to "SELL" if the instruction mentions selling, shorting, or negative intent. Default to "BUY" only if clearly buying.
- ticker must be a valid stock symbol (uppercase, 1-5 letters)
- quantity must be exactly the number stated in the instruction (do not infer, change, or estimate)
- if no limit price is mentioned, set limitPrice to null
- if no budget is mentioned, estimate: quantity * likely_price * 1.1
- return ONLY the JSON object, no explanation

Examples:
- "Buy 10 shares of AAPL" → {"action":"BUY","ticker":"AAPL","quantity":10,"limitPrice":null,"maxBudget":1650}
- "Sell 5 shares of TSLA at $200" → {"action":"SELL","ticker":"TSLA","quantity":5,"limitPrice":200,"maxBudget":1000}
- "Purchase 2 shares of GOOGL" → {"action":"BUY","ticker":"GOOGL","quantity":2,"limitPrice":null,"maxBudget":2800}

Instruction: "${instruction}"
    `.trim();
  }
  private extractJSON(text: string): Record<string, unknown> | null {
    try {
      // Try direct parse
      return JSON.parse(text.trim());
    } catch {
      // Extract JSON block from markdown code fences
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch {
          return null;
        }
      }
      // Try to find raw JSON object in the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
  private estimateBudget(ticker: string, quantity: number): number {
    const estimates: Record<string, number> = {
      AAPL: 175, MSFT: 420, GOOGL: 175,
      AMZN: 185, META: 500,
    };
    return (estimates[ticker?.toUpperCase()] || 150) * quantity * 1.1;
  }
}