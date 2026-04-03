import { v4 as uuidv4 } from "uuid";
// import { TokenSigner } from "../security/tokenSigner";
import { readFileSync } from "fs";
import { join } from "path";
import { SignedPayload } from "../types/intent";

// Types
interface IntentTokenPayload {
  intentId: string;
  ticker: string;
  allowedTickers: string[];
  maxDelegation: number;
  issuedBy: string;
  exp: number;
}

interface DelegationRequest {
  status: "delegation_request" | "error" | "rejected";
  parent_token_id?: string;
  recommendation_id?: string;
  ticker?: string;
  side?: "buy" | "sell" | "hold";
  suggested_quantity?: number;
  suggested_price?: number;
  estimated_total?: number;
  order_type?: "market";
  rationale?: string;
  risk_level?: "low" | "medium" | "high";
  confidence_score?: number;
  within_token_scope?: boolean;
  pass_to_risk_agent?: boolean;
  security_flag?: boolean;
  timestamp?: string;
  reason?: string;
  detail?: string;
  token_a_id?: string; // For rejected
  allowedTickers?: string[];
}

interface MarketData {
  price: number;
  volume: number;
  pe: number;
  marketCap: number;
  change1d: number;
}

interface NewsData {
  articles: { title: string; sentiment: "positive" | "negative" | "neutral" }[];
  overallSentiment: "bullish" | "neutral" | "bearish";
}

interface AnalysisResult {
  technicalOutlook: string;
  riskFactors: string[];
  confidenceScore: number;
}

// Mock implementations for tools - replace with real APIs
class AnalystTools {
  // private signer: TokenSigner;

  // constructor(signerKey?: string) {
  //   this.signer = new TokenSigner(signerKey);
  // }

  verifyIntentToken(payload: SignedPayload): { valid: boolean; payload?: IntentTokenPayload; reason?: string } {
    try {
      // Check expiry
      const now = new Date();
      const expiry = new Date(payload.expiry);
      if (now > expiry) return { valid: false, reason: "Token expired" };

      // Extract from intent
      const intent = payload.intent;
      return {
        valid: true,
        payload: {
          intentId: intent.intentId,
          ticker: intent.ticker,
          allowedTickers: ["AAPL", "MSFT", "GOOGL", "AMZN", "META"], // From policy
          maxDelegation: 1000, // From policy
          issuedBy: "ArmorClaw",
          exp: expiry.getTime() / 1000
        }
      };
    } catch (error) {
      return { valid: false, reason: (error as Error).message };
    }
  }

  readPolicy(): any {
    try {
      const policyPath = join(process.cwd(), "config", "policy.json");
      const data = readFileSync(policyPath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      throw new Error("Failed to read policy file");
    }
  }

  async fetchFinancialData(ticker: string): Promise<MarketData> {
    // Mock data - replace with real API call
    const mockData: Record<string, MarketData> = {
      AAPL: { price: 175, volume: 50000000, pe: 28, marketCap: 2800000000000, change1d: 1.5 },
      MSFT: { price: 420, volume: 30000000, pe: 35, marketCap: 3100000000000, change1d: -0.8 },
      GOOGL: { price: 140, volume: 25000000, pe: 25, marketCap: 1800000000000, change1d: 2.1 },
      AMZN: { price: 155, volume: 40000000, pe: 50, marketCap: 1600000000000, change1d: 0.5 },
      META: { price: 480, volume: 20000000, pe: 22, marketCap: 1200000000000, change1d: -1.2 },
    };
    return mockData[ticker] || { price: 100, volume: 1000000, pe: 20, marketCap: 100000000, change1d: 0 };
  }

  async fetchNews(ticker: string, days: number): Promise<NewsData> {
    // Mock news data
    const mockNews: Record<string, NewsData> = {
      AAPL: {
        articles: [
          { title: "Apple reports strong iPhone sales", sentiment: "positive" },
          { title: "Apple faces supply chain issues", sentiment: "negative" },
        ],
        overallSentiment: "bullish"
      },
      MSFT: {
        articles: [
          { title: "Microsoft AI initiatives gain traction", sentiment: "positive" },
          { title: "Microsoft cloud revenue grows", sentiment: "positive" },
        ],
        overallSentiment: "bullish"
      },
    };
    return mockNews[ticker] || {
      articles: [{ title: "Market update", sentiment: "neutral" }],
      overallSentiment: "neutral"
    };
  }

  async analyzeData(marketData: MarketData, newsData: NewsData, ticker: string): Promise<AnalysisResult> {
    // Simple analysis logic
    const sentimentScore = newsData.overallSentiment === "bullish" ? 0.8 : newsData.overallSentiment === "bearish" ? 0.3 : 0.5;
    const priceChange = marketData.change1d;
    const confidenceScore = (sentimentScore + (priceChange > 0 ? 0.6 : 0.4)) / 2;

    return {
      technicalOutlook: priceChange > 0 ? "Positive momentum" : "Neutral to bearish",
      riskFactors: priceChange < -1 ? ["Recent price decline"] : [],
      confidenceScore
    };
  }

  generateDelegationRequest(analysis: AnalysisResult, ticker: string, tokenAId: string, marketData: MarketData): DelegationRequest {
    const side = analysis.confidenceScore >= 0.5 ? "buy" : "hold"; // Always buy if confident
    const suggestedQuantity = side !== "hold" ? Math.floor(1000 / marketData.price) : 0; // Max delegation 1000
    const estimatedTotal = suggestedQuantity * marketData.price;

    let riskLevel: "low" | "medium" | "high" = "high";
    if (analysis.confidenceScore > 0.85) riskLevel = "low";
    else if (analysis.confidenceScore > 0.7) riskLevel = "medium";

    return {
      status: "delegation_request",
      parent_token_id: tokenAId,
      recommendation_id: uuidv4(),
      ticker,
      side,
      suggested_quantity: suggestedQuantity,
      suggested_price: marketData.price,
      estimated_total: estimatedTotal,
      order_type: "market",
      rationale: `${ticker} analysis shows ${analysis.technicalOutlook}. ${analysis.riskFactors.length > 0 ? 'Risk factors: ' + analysis.riskFactors.join(', ') : 'No major risks identified'}.`,
      risk_level: riskLevel,
      confidence_score: analysis.confidenceScore,
      within_token_scope: true,
      pass_to_risk_agent: true,
      security_flag: false,
      timestamp: new Date().toISOString()
    };
  }
}

export class AnalystAgent {
  private tools: AnalystTools;

  constructor() {
    this.tools = new AnalystTools();
  }

  async analyze(tokenA: SignedPayload): Promise<DelegationRequest> {
    // Step 0: Verify Token A
    const tokenVerification = this.tools.verifyIntentToken(tokenA);
    if (!tokenVerification.valid) {
      return {
        status: "error",
        reason: "invalid or missing Intent Token A — cannot proceed",
        detail: tokenVerification.reason
      };
    }

    const payload = tokenVerification.payload!;
    const tokenAId = payload.intentId; // Assuming intentId is the token id
    const allowedTickers = payload.allowedTickers;
    const maxDelegation = payload.maxDelegation;

    // Step 1: Validate ticker (assuming ticker is in payload)
    const ticker = payload.ticker;
    if (!allowedTickers.includes(ticker)) {
      return {
        status: "rejected",
        reason: `ticker ${ticker} not in Token A scope`,
        parent_token_id: tokenAId,
        allowedTickers
      };
    }

    // Step 2: Check market hours
    const policy = this.tools.readPolicy();
    if (policy.marketHoursOnly) {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const day = et.getDay();
      const hour = et.getHours();
      if (day === 0 || day === 6 || hour < 9.5 || hour > 16) {
        return {
          status: "rejected",
          reason: "outside market hours",
          parent_token_id: tokenAId
        };
      }
    }

    // Step 3: Research
    const marketData = await this.tools.fetchFinancialData(ticker);
    const newsData = await this.tools.fetchNews(ticker, 7);
    const analysis = await this.tools.analyzeData(marketData, newsData, ticker);

    // Step 4: Determine recommendation
    let side: "buy" | "sell" | "hold" = "hold";
    if (analysis.confidenceScore >= 0.5) {
      side = Math.random() > 0.5 ? "buy" : "sell";
    }

    // Step 5: Generate delegation request
    return this.tools.generateDelegationRequest(analysis, ticker, tokenAId, marketData);
  }
}