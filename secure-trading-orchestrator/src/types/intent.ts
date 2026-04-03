import { z } from "zod";

export const TradeIntentSchema = z.object({
  intentId: z.string().uuid(),
  ticker: z.string().toUpperCase(),
  quantity: z.number().positive(),
  maxBudget: z.number().positive(),
  action: z.enum(["BUY", "SELL"]),
  limitPrice: z.number().optional(),
  expiry: z.string(),
  originalInstruction: z.string(),
  createdAt: z.string(),
});

export type TradeIntent = z.infer<typeof TradeIntentSchema>;
