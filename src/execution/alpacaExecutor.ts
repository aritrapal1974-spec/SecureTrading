import Alpaca from "@alpacahq/alpaca-trade-api";
import { TradeIntent, ExecutionResult, SignedPayload } from "../types/intent";
import { ArmorClaw } from "../security/armorClaw";
// ============================================================
// ALPACA EXECUTOR
// Only accepts ArmorClaw-signed payloads
// ============================================================
export class AlpacaExecutor {
  private client: any;
  private armor: ArmorClaw;
  constructor(
    config: { keyId: string; secretKey: string; paper: boolean },
    armor: ArmorClaw
  ) {
    this.client = new Alpaca({
      keyId: config.keyId,
      secretKey: config.secretKey,
      paper: config.paper,
    });
    this.armor = armor;
  }
  async execute(signedPayload: SignedPayload): Promise<ExecutionResult> {
    // Verify signature before any Alpaca call
    const verification = this.armor.verifySignature(signedPayload);
    if (!verification.valid) {
      return {
        success: false,
        message: `Signature invalid: ${verification.reason}`,
      };
    }
    const intent = signedPayload.intent;
    // Check positions for sell orders
    if (intent.action === 'SELL') {
      try {
        const positions = await this.client.getPositions();
        console.log("[AlpacaExecutor] Positions:", positions.map((p: any) => ({ symbol: p.symbol, qty: p.qty })));
        const position = positions.find((p: any) => p.symbol === intent.ticker);
        if (!position || parseInt(position.qty) < intent.quantity) {
          return {
            success: false,
            message: `Insufficient shares: You have ${position ? position.qty : 0} shares of ${intent.ticker}, trying to sell ${intent.quantity}`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Error checking positions: ${(error as Error).message}`,
        };
      }
    }
    try {
      const order = await this.client.createOrder({
        symbol: intent.ticker,
        qty: intent.quantity,
        side: intent.action.toLowerCase(),
        type: intent.limitPrice ? "limit" : "market",
        time_in_force: "day",
        ...(intent.limitPrice && { limit_price: intent.limitPrice.toFixed(2) }),
      });
      return {
        success: true,
        orderId: order.id,
        message: `Order placed successfully`,
        details: {
          id: order.id,
          symbol: order.symbol,
          qty: order.qty,
          side: order.side,
          type: order.type,
          status: order.status,
          submittedAt: order.submitted_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Alpaca error: ${(error as Error).message}`,
      };
    }
  }
  async getAccount(): Promise<any> {
    return this.client.getAccount();
  }
  async getPositions(): Promise<any[]> {
    return this.client.getPositions();
  }
  async getOrders(): Promise<any[]> {
    return this.client.getOrders({ status: "all", limit: 10 });
  }
  async getTradingStats(): Promise<{
    account: any;
    positions: any[];
    totalBuys: number;
    totalSells: number;
    pnlToday: number;
    totalPnl: number;
    pnlPercent: number;
    initialBalance: number;
  }> {
    const account = await this.client.getAccount();
    const positions = await this.client.getPositions();
    
    // Get all orders with different statuses
    let allOrders: any[] = [];
    try {
      allOrders = await this.client.getOrders({ status: "all", limit: 100 });
    } catch (e) {
      console.log("[AlpacaExecutor] Could not fetch orders:", (e as Error).message);
      allOrders = [];
    }
    
    console.log("[AlpacaExecutor] Total orders retrieved:", allOrders.length);
    console.log("[AlpacaExecutor] Order statuses:", [...new Set(allOrders.map(o => o.status))]);
    
    // Count filled buys and sells (match any filled status)
    const totalBuys = allOrders.filter((o: any) => o.side === "buy" && (o.status === "filled" || o.status === "complete" || o.status === "done")).length;
    const totalSells = allOrders.filter((o: any) => o.side === "sell" && (o.status === "filled" || o.status === "complete" || o.status === "done")).length;
    
    console.log("[AlpacaExecutor] Calculated - Buys:", totalBuys, "Sells:", totalSells);
    
    // Get accurate P&L from Alpaca
    const pnlToday = parseFloat(account.daily_pl || "0");
    const initialBalance = parseFloat(account.initial_balance || "100000");
    const currentEquity = parseFloat(account.equity || "0");
    const totalPnl = currentEquity - initialBalance;
    const pnlPercent = (totalPnl / initialBalance) * 100;
    
    console.log("[AlpacaExecutor] P&L - Today:", pnlToday, "Total:", totalPnl, "Equity:", currentEquity, "Initial:", initialBalance);
    
    return {
      account,
      positions,
      totalBuys,
      totalSells,
      pnlToday,
      totalPnl,
      pnlPercent,
      initialBalance,
    };
  }
}