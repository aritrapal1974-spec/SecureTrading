import { ValidationResult, ExecutionResult, TradeIntent, AuditEntry } from "../types/intent";
import { ACTIVE_POLICY } from "../security/policies";
// ============================================================
// MESSAGE FORMATTER
// Clean Telegram-friendly formatting using HTML parse mode
// ============================================================
export class MessageFormatter {
  // ── Welcome message ──────────────────────────────────────
  static welcome(): string {
    const tickers = [...new Set(ACTIVE_POLICY.allowedTickers)].join(", ");
    return `
🤖 <b>SecureTrader Bot</b>
<i>Powered by AI + ArmorIQ</i>
━━━━━━━━━━━━━━━━━━━━━
🛡️ <b>Security Layer:</b> ArmorClaw Active
📊 <b>Broker:</b> Alpaca Paper Trading
🧠 <b>AI Engine:</b> Kimi AI
━━━━━━━━━━━━━━━━━━━━━
📋 <b>Policy Configuration</b>
• Allowed Tickers: <code>${tickers}</code>
• Max Budget/Trade: <code>$${ACTIVE_POLICY.maxBudgetPerTrade}</code>
• Max Shares/Trade: <code>${ACTIVE_POLICY.maxQuantityPerTrade}</code>
• Rate Limit: <code>${ACTIVE_POLICY.rateLimiting.maxTradesPerWindow} trades/min</code>
━━━━━━━━━━━━━━━━━━━━━
💬 <b>Commands</b>
/trade — Place a trade
/ask — Get trading advice from AI
/chat — Enable free chat mode with AI
/policies — View active trading policies
/stop — Exit chat/trade modes
/portfolio — View positions
/orders — Recent orders
/audit — Audit log
/status — Account status
/help — Show this menu
━━━━━━━━━━━━━━━━━━━━━
<i>Example: "Buy 2 shares of AAPL below $170"</i>
    `.trim();
  }
  // ── Intent parsed ─────────────────────────────────────────
  static intentParsed(intent: TradeIntent): string {
    return `
🔍 <b>Intent Parsed</b>
📌 <b>Action:</b> ${intent.action === "BUY" ? "🟢 BUY" : "🔴 SELL"}
📈 <b>Ticker:</b> <code>${intent.ticker}</code>
🔢 <b>Quantity:</b> ${intent.quantity} shares
💵 <b>Max Budget:</b> $${intent.maxBudget.toFixed(2)}
${intent.limitPrice ? `🎯 <b>Limit Price:</b> $${intent.limitPrice.toFixed(2)}` : "📊 <b>Order Type:</b> Market"}
🕒 <b>Expires:</b> ${new Date(intent.expiry).toLocaleTimeString()}
⏳ <i>Running ArmorClaw validation...</i>
    `.trim();
  }
  // ── Validation result ──────────────────────────────────────
  static validationResult(result: ValidationResult): string {
    const isApproved = result.status === "APPROVED";
    const icon = isApproved ? "✅" : "🚫";
    const title = isApproved ? "Trade Approved" : "Trade Blocked";
    const color = isApproved ? "🟢" : "🔴";
    const checks = result.checks
      .map((c) => `${c.passed ? "✅" : "❌"} ${c.message}`)
      .join("\n");
    return `
${icon} <b>ArmorClaw: ${title}</b>
━━━━━━━━━━━━━━━━━━━━━
🔐 <b>Policy Checks</b>
${checks}
━━━━━━━━━━━━━━━━━━━━━
${color} <b>Status:</b> ${result.status}
${result.reason ? `📝 <b>Reason:</b> ${result.reason}` : ""}
🕒 <b>Validated:</b> ${new Date(result.timestamp).toLocaleTimeString()}
    `.trim();
  }
  // ── Execution result ───────────────────────────────────────
  static executionResult(result: ExecutionResult, intent: TradeIntent): string {
    if (result.success) {
      return `
🎉 <b>Trade Executed!</b>
━━━━━━━━━━━━━━━━━━━━━
✅ <b>Status:</b> Order Placed
📋 <b>Order ID:</b> <code>${result.orderId}</code>
📈 <b>Symbol:</b> <code>${intent.ticker}</code>
🔢 <b>Qty:</b> ${intent.quantity} shares
${intent.action === "BUY" ? "🟢" : "🔴"} <b>Side:</b> ${intent.action}
💵 <b>Budget:</b> $${intent.maxBudget.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━
📊 <i>Check Alpaca Paper Dashboard for live status</i>
      `.trim();
    } else {
      return `
⚠️ <b>Execution Failed</b>
━━━━━━━━━━━━━━━━━━━━━
❌ <b>Error:</b> ${result.message}
<i>Trade was not placed. Check logs for details.</i>
      `.trim();
    }
  }
  // ── Portfolio ─────────────────────────────────────────────
  static portfolio(positions: any[], account: any): string {
    if (positions.length === 0) {
      return `
📊 <b>Portfolio</b>
━━━━━━━━━━━━━━━━━━━━━
<i>No open positions</i>
💼 <b>Buying Power:</b> $${parseFloat(account.buying_power).toFixed(2)}
💰 <b>Portfolio Value:</b> $${parseFloat(account.portfolio_value).toFixed(2)}
      `.trim();
    }
    const posLines = positions.map((p) => {
      const pnl = parseFloat(p.unrealized_pl);
      const pnlIcon = pnl >= 0 ? "📈" : "📉";
      return `${pnlIcon} <code>${p.symbol}</code> — ${p.qty} shares @ $${parseFloat(p.avg_entry_price).toFixed(2)} | P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;
    });
    return `
📊 <b>Portfolio</b>
━━━━━━━━━━━━━━━━━━━━━
${posLines.join("\n")}
━━━━━━━━━━━━━━━━━━━━━
💼 <b>Buying Power:</b> $${parseFloat(account.buying_power).toFixed(2)}
💰 <b>Portfolio Value:</b> $${parseFloat(account.portfolio_value).toFixed(2)}
📈 <b>Equity:</b> $${parseFloat(account.equity).toFixed(2)}
    `.trim();
  }
  // ── Recent orders ─────────────────────────────────────────
  static orders(orders: any[]): string {
    if (orders.length === 0) {
      return `📋 <b>Recent Orders</b>\n━━━━━━━━━━━━━━━━━━━━━\n<i>No recent orders</i>`;
    }
    const lines = orders.slice(0, 5).map((o) => {
      const icon = o.side === "buy" ? "🟢" : "🔴";
      const status = o.status === "filled" ? "✅" : o.status === "canceled" ? "❌" : "⏳";
      return `${icon} ${status} <code>${o.symbol}</code> ${o.qty} @ ${o.type} | ${o.status}`;
    });
    return `
📋 <b>Recent Orders</b>
━━━━━━━━━━━━━━━━━━━━━
${lines.join("\n")}
    `.trim();
  }
  // ── Audit log ─────────────────────────────────────────────
  static auditLog(entries: AuditEntry[], stats: Record<string, number>): string {
    const lines = entries.slice(0, 5).map((e) => {
      const icon =
        e.status === "EXECUTED" ? "✅" :
        e.status === "BLOCKED" ? "🚫" :
        e.status === "FAILED" ? "❌" : "⚠️";
      const time = new Date(e.timestamp).toLocaleTimeString();
      return `${icon} [${time}] ${e.action} ${e.quantity} ${e.ticker} — ${e.status}`;
    });
    return `
📝 <b>Audit Log</b>
━━━━━━━━━━━━━━━━━━━━━
${lines.join("\n")}
━━━━━━━━━━━━━━━━━━━━━
📊 <b>Summary</b>
✅ Executed: ${stats.executed || 0}
🚫 Blocked: ${stats.blocked || 0}
❌ Failed: ${stats.failed || 0}
📦 Total: ${stats.total || 0}
    `.trim();
  }
  // ── Trading logs with P&L ─────────────────────────────────
  static tradingLogs(stats: any): string {
    const account = stats.account || {};
    const positions = stats.positions || [];
    const totalBuys = stats.totalBuys || 0;
    const totalSells = stats.totalSells || 0;
    const pnlToday = stats.pnlToday || 0;
    const totalPnl = stats.totalPnl || 0;
    const pnlPercent = stats.pnlPercent || 0;
    const initialBalance = stats.initialBalance || 100000;
    const currentEquity = parseFloat(account.equity || "0");
    const cashBalance = parseFloat(account.cash || "0");
    
    // Determine icons
    const todayIcon = pnlToday >= 0 ? "📈" : "📉";
    const totalIcon = totalPnl >= 0 ? "🟢" : "🔴";
    const pnlSign = totalPnl >= 0 ? "+" : "";
    const todaySign = pnlToday >= 0 ? "+" : "";
    const percentSign = pnlPercent >= 0 ? "+" : "";
    
    // Create position summary
    let positionSummary = "";
    if (positions.length === 0) {
      positionSummary = "<i>No open positions</i>";
    } else {
      positionSummary = positions.slice(0, 10).map((p: any) => {
        const pnl = parseFloat(p.unrealized_pl || "0");
        const pnlPercent = ((pnl / (parseFloat(p.cost_basis || "1"))) * 100).toFixed(1);
        const icon = pnl >= 0 ? "📈" : "📉";
        const sign = pnl >= 0 ? "+" : "";
        return `${icon} <code>${p.symbol}</code>: ${p.qty} shares | P&L: ${sign}$${pnl.toFixed(2)} (${sign}${pnlPercent}%)`;
      }).join("\n");
    }
    
    return `
📊 <b>Trading Dashboard</b>
━━━━━━━━━━━━━━━━━━━━━

💰 <b>Account Summary</b>
Initial Balance: $${initialBalance.toFixed(2)}
Current Equity: $${currentEquity.toFixed(2)}
Cash Balance: $${cashBalance.toFixed(2)}

📈 <b>Profit/Loss</b>
${totalIcon} Total P&L: ${pnlSign}$${totalPnl.toFixed(2)} (${percentSign}${pnlPercent.toFixed(2)}%)
${todayIcon} Today's P&L: ${todaySign}$${pnlToday.toFixed(2)}

🔄 <b>Trading Activity</b>
🟢 Total Buys: ${totalBuys}
🔴 Total Sells: ${totalSells}
📊 Completed Trades: ${totalBuys + totalSells}

📍 <b>Open Positions</b>
${positionSummary}

━━━━━━━━━━━━━━━━━━━━━
<i>Live from Alpaca Paper Trading</i>
    `.trim();
  }
  // ── Loading indicator ──────────────────────────────────────
  static loading(text: string): string {
    return `⏳ <i>${text}</i>`;
  }
  // ── Error ──────────────────────────────────────────────────
  static error(message: string): string {
    return `⚠️ <b>Error</b>\n\n<code>${message}</code>`;
  }
  // ── Help ───────────────────────────────────────────────────
  static help(): string {
    return `
📖 <b>How to Use SecureTrader</b>
━━━━━━━━━━━━━━━━━━━━━
💬 <b>Natural Language Trading</b>
Just type your instruction naturally:
• <code>Buy 2 shares of AAPL</code>
• <code>Sell 1 MSFT share</code>
• <code>Buy 3 GOOGL shares below $150</code>
━━━━━━━━━━━━━━━━━━━━━
📋 <b>Commands</b>
/trade — Start a trade
/ask — Get trading advice from AI
/chat — Enable free chat mode with AI
/stop — Exit chat/trade modes
/portfolio — View open positions
/orders — Recent order history
/logs — Trading logs & P&L
/audit — Audit log + stats
/policies — View active policies
/status — Account info
/help — This menu
━━━━━━━━━━━━━━━━━━━━━
🛡️ <b>Security</b>
Every trade passes through ArmorClaw:
• Ticker whitelist check
• Budget cap enforcement
• Quantity limit check
• Cryptographic signing
• Fail-closed on any error
━━━━━━━━━━━━━━━━━━━━━
⚠️ <i>This is a paper trading system.
No real money is used.</i>
    `.trim();
  }
}