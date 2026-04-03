export const ACTIVE_POLICY = {
  allowedTickers: new Set(["AAPL", "MSFT", "GOOGL"]),
  maxBudgetPerTrade: 5000,
  maxQuantityPerTrade: 100,
  signatureValidityMs: 30000,
};
