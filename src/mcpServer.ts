import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

// Import existing components
import { TradingOrchestrator } from "./orchestrator";
import { ACTIVE_POLICY } from "./security/policies";

// ============================================================
// ARMORIQ MCP SERVER
// Exposes trading functionality via MCP for AI agents
// ============================================================

// Initialize the ArmorIQ-compatible Server
const server = new McpServer({
  name: "ArmorIQ-Trade-Guard",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {} // These are the actions the AI can take
  }
});

// Initialize orchestrator with existing config
const orchestrator = new TradingOrchestrator({
  openrouterApiKey: process.env.OPENROUTER_API_KEY!,
  alpaca: {
    keyId: process.env.ALPACA_API_KEY!,
    secretKey: process.env.ALPACA_SECRET_KEY!,
    paper: true,
  },
  armoriqApiKey: process.env.ARMORIQ_API_KEY!,
  armoriqMcpUrl: process.env.ARMORIQ_MCP_URL,
  signerSecretKey: process.env.SIGNER_SECRET_KEY!,
  auditDbPath: process.env.AUDIT_DB_PATH || "./audit.db",
});

// 2. Define the 'execute_trade' tool
server.tool(
  "execute_trade",
  {
    ticker: z.string().describe("The stock symbol (e.g., AAPL)"),
    quantity: z.number().int().positive().describe("Number of shares"),
    action: z.enum(["BUY", "SELL"]).describe("Trade action")
  },
  async ({ ticker, quantity, action }) => {
    console.log(`MCP Request: ${action} ${quantity} of ${ticker}`);

    try {
      // Call the existing orchestrator logic
      const result = await orchestrator.executeTrade({
        intentId: "mcp-" + Date.now(),
        ticker: ticker.toUpperCase(),
        quantity,
        maxBudget: 10000, // Default budget
        action: action as "BUY" | "SELL",
        limitPrice: undefined,
        expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        originalInstruction: `MCP: ${action} ${quantity} ${ticker}`,
        createdAt: new Date().toISOString(),
      });

      if (result.success) {
        return {
          content: [{ type: "text", text: `Trade executed successfully: ${result.message}` }]
        };
      } else {
        return {
          content: [{ type: "text", text: `Trade failed: ${result.message}` }]
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error executing trade: ${(error as Error).message}` }]
      };
    }
  }
);

// Add tool to get ArmorIQ logs/policy checks
server.tool(
  "get_armoriq_logs",
  {
    limit: z.number().int().positive().optional().describe("Number of recent logs to fetch (default 10)")
  },
  async ({ limit = 10 }) => {
    try {
      // Fetch from ArmorIQ API or local audit
      const logs = await orchestrator.getAuditLog();
      return {
        content: [{ type: "text", text: JSON.stringify(logs.slice(0, limit), null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching logs: ${(error as Error).message}` }]
      };
    }
  }
);

// Add tool to get active policies
server.tool(
  "get_policies",
  {},
  async () => {
    try {
      const policies = {
        allowedTickers: ACTIVE_POLICY.allowedTickers,
        maxBudgetPerTrade: ACTIVE_POLICY.maxBudgetPerTrade,
        maxQuantityPerTrade: ACTIVE_POLICY.maxQuantityPerTrade,
        signatureValidityMs: ACTIVE_POLICY.signatureValidityMs,
        allowAfterHours: ACTIVE_POLICY.allowAfterHours,
        rateLimiting: ACTIVE_POLICY.rateLimiting,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(policies, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching policies: ${(error as Error).message}` }]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ArmorIQ MCP Server running on stdio");
}

main().catch(console.error);