import TelegramBot from "node-telegram-bot-api";
import { TradingOrchestrator } from "../orchestrator";
import { MessageFormatter } from "./messageFormatter";
import { ACTIVE_POLICY } from "../security/policies";
import OpenAI from "openai";
// ============================================================
// TELEGRAM BOT — Primary User Interface
// ============================================================
export class SecureTradingBot {
  private bot: TelegramBot;
  private orchestrator: TradingOrchestrator;
  private openai: OpenAI;
  // Track users in "trade input" mode
  private awaitingTrade = new Set<number>();
  // Track users in "ask" mode
  private askMode = new Set<number>();
  // Track users in "chat" mode
  private chatMode = new Set<number>();
  // Prevent multiple simultaneous processing
  private processing = new Set<number>();
  // Track pending recommendations
  private pendingRecommendations = new Map<number, {
    originalIntent: any;
    recommendedIntent: any;
    validation: any;
    delegation: any;
    statusMsgId: number;
  }>();
  constructor(token: string, orchestrator: TradingOrchestrator) {
    this.bot = new TelegramBot(token, { polling: true });
    this.orchestrator = orchestrator;
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.registerHandlers();
    console.log("[TelegramBot] Bot initialized and polling");
  }
  private registerHandlers(): void {
    // ── Callback query handler for inline buttons ────────
    this.bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;
      if (!chatId || !data) return;

      await this.bot.answerCallbackQuery(query.id);

      if (data.startsWith("approve_") || data.startsWith("disapprove_")) {
        await this.handleRecommendationResponse(chatId, data);
      }
    });
    // ── /start ────────────────────────────────────────────
    this.bot.onText(/\/start/, (msg) => {
      this.send(msg.chat.id, MessageFormatter.welcome());
    });
    // ── /help ─────────────────────────────────────────────
    this.bot.onText(/\/help/, (msg) => {
      this.send(msg.chat.id, MessageFormatter.help());
    });
    // ── /ask ──────────────────────────────────────────────
    this.bot.onText(/\/ask/, (msg) => {
      const chatId = msg.chat.id;
      this.askMode.add(chatId);
      this.send(
        chatId,
        `💬 <b>Ask AI</b>\n\n<i>Type your question about trading, markets, or advice.</i>`
      );
    });
    // ── /chat ──────────────────────────────────────────────
    this.bot.onText(/\/chat/, (msg) => {
      const chatId = msg.chat.id;
      this.chatMode.add(chatId);
      this.send(
        chatId,
        `💬 <b>Chat Mode Enabled</b>\n\n<i>Ask me anything about trading! Send /stop to exit chat mode.</i>`
      );
    });
    // ── /stop ──────────────────────────────────────────────
    this.bot.onText(/\/stop/, (msg) => {
      const chatId = msg.chat.id;
      this.chatMode.delete(chatId);
      this.askMode.delete(chatId);
      this.awaitingTrade.delete(chatId);
      this.send(chatId, "✅ <b>Chat mode disabled.</b> Use /chat to start again.");
    });
    // ── /trade ────────────────────────────────────────────
    this.bot.onText(/\/trade/, (msg) => {
      const chatId = msg.chat.id;
      this.awaitingTrade.add(chatId);
      this.send(
        chatId,
        `💬 <b>Enter your trade instruction:</b>\n\n<i>Example: "Buy 2 shares of AAPL below $170"</i>`
      );
    });
    // ── /policies ──────────────────────────────────────────
    this.bot.onText(/\/policies/, (msg) => {
      const chatId = msg.chat.id;
      const policyText = `
🛡️ <b>Active Trading Policies</b>
━━━━━━━━━━━━━━━━━━━━━

✅ <b>Allowed Tickers:</b> ${ACTIVE_POLICY.allowedTickers.join(", ")}
💰 <b>Max Budget per Trade:</b> $${ACTIVE_POLICY.maxBudgetPerTrade}
📊 <b>Max Quantity per Trade:</b> ${ACTIVE_POLICY.maxQuantityPerTrade} shares
⏱️ <b>Signature Validity:</b> ${ACTIVE_POLICY.signatureValidityMs / 1000}s
🌙 <b>After Hours Trading:</b> ${ACTIVE_POLICY.allowAfterHours ? "Enabled" : "Disabled"}

⚡ <b>Rate Limiting:</b>
  • Max Trades per Window: ${ACTIVE_POLICY.rateLimiting.maxTradesPerWindow}
  • Window: ${ACTIVE_POLICY.rateLimiting.windowMs / 1000}s
      `.trim();
      this.send(chatId, policyText);
    });
    // ── /portfolio ────────────────────────────────────────
    this.bot.onText(/\/portfolio/, async (msg) => {
      const chatId = msg.chat.id;
      const loadMsg = await this.send(chatId, MessageFormatter.loading("Fetching portfolio..."));
      try {
        const [positions, account] = await Promise.all([
          this.orchestrator.getPositions(),
          this.orchestrator.getAccount(),
        ]);
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.portfolio(positions, account));
      } catch (e) {
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.error((e as Error).message));
      }
    });
    // ── /orders ───────────────────────────────────────────
    this.bot.onText(/\/orders/, async (msg) => {
      const chatId = msg.chat.id;
      const loadMsg = await this.send(chatId, MessageFormatter.loading("Fetching orders..."));
      try {
        const orders = await this.orchestrator.getOrders();
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.orders(orders));
      } catch (e) {
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.error((e as Error).message));
      }
    });
    // ── /audit ────────────────────────────────────────────
    this.bot.onText(/\/audit/, async (msg) => {
      const chatId = msg.chat.id;
      const loadMsg = await this.send(chatId, MessageFormatter.loading("Fetching audit log..."));
      try {
        const entries = await this.orchestrator.getAuditLog();
        const stats = await this.orchestrator.getAuditStats();
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.auditLog(entries, stats));
      } catch (e) {
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.error((e as Error).message));
      }
    });
    // ── /logs ──────────────────────────────────────────────
    this.bot.onText(/\/logs/, async (msg) => {
      const chatId = msg.chat.id;
      const loadMsg = await this.send(chatId, MessageFormatter.loading("Fetching trading logs..."));
      try {
        const stats = await this.orchestrator.getTradingStats();
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.tradingLogs(stats));
      } catch (e) {
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.error((e as Error).message));
      }
    });
    // ── /status ───────────────────────────────────────────
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const loadMsg = await this.send(chatId, MessageFormatter.loading("Fetching account..."));
      try {
        const account = await this.orchestrator.getAccount();
        const text = `
💼 <b>Account Status</b>
━━━━━━━━━━━━━━━━━━━━━
📊 <b>Status:</b> ${account.status}
💰 <b>Equity:</b> $${parseFloat(account.equity).toFixed(2)}
💵 <b>Buying Power:</b> $${parseFloat(account.buying_power).toFixed(2)}
📈 <b>Portfolio Value:</b> $${parseFloat(account.portfolio_value).toFixed(2)}
🏦 <b>Account Type:</b> Paper Trading
        `.trim();
        await this.editMessage(chatId, loadMsg.message_id, text);
      } catch (e) {
        await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.error((e as Error).message));
      }
    });
    // ── Free text message handler ─────────────────────────
    this.bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();
      console.log(`[TelegramBot] Received message: "${text}" from chat ${chatId}`);
      // Skip commands
      if (!text || text.startsWith("/")) return;
      // If user is in chat mode, handle as chat
      if (this.chatMode.has(chatId)) {
        await this.handleAsk(chatId, text);
        return;
      }
      // If user is in ask mode, handle question
      if (this.askMode.has(chatId)) {
        this.askMode.delete(chatId);
        await this.handleAsk(chatId, text);
        return;
      }
      // If user is in trade mode, process instruction
      if (this.awaitingTrade.has(chatId)) {
        this.awaitingTrade.delete(chatId);
        await this.handleTradeInstruction(chatId, text);
        return;
      }
      // Otherwise prompt them
      this.send(
        chatId,
        `💬 Use /trade to place a trade, /ask for advice, /chat to chat freely, or type a command.\n\nTry: <code>Buy 1 share of AAPL</code>`
      );
    });
  }
  // ── Handle recommendation approval/disapproval ──────────
  private async handleRecommendationResponse(chatId: number, data: string): Promise<void> {
    const pending = this.pendingRecommendations.get(chatId);
    if (!pending) return;

    this.pendingRecommendations.delete(chatId);
    this.processing.add(chatId);

    const [action, intentId] = data.split("_");
    const isApprove = action === "approve";

    const executionIntent = isApprove ? pending.recommendedIntent : pending.originalIntent;
    let executionValidation = pending.validation;

    try {
      if (isApprove) {
        // Re-validate recommended intent
        const reValidation = await this.orchestrator.validateIntent(executionIntent);
        if (reValidation.status !== "APPROVED" || !reValidation.signedPayload) {
          await this.editMessage(
            chatId,
            pending.statusMsgId,
            MessageFormatter.validationResult(reValidation)
          );
          return;
        }
        executionValidation = reValidation;
      }

      // Execute the chosen intent
      console.log(`[TelegramBot] Executing ${isApprove ? 'recommended' : 'original'} trade...`);
      const execution = await this.orchestrator.executeIntent(executionIntent, executionValidation);
      console.log("[TelegramBot] Execution result:", execution.success);

      await this.editMessage(
        chatId,
        pending.statusMsgId,
        MessageFormatter.executionResult(execution, executionIntent)
      );
    } catch (error) {
      console.error("[TelegramBot] Error executing trade:", error);
      await this.editMessage(
        chatId,
        pending.statusMsgId,
        MessageFormatter.error((error as Error).message)
      );
    } finally {
      this.processing.delete(chatId);
    }
  }
  // ── TRADE FLOW ────────────────────────────────────────────
  private async handleTradeInstruction(
    chatId: number,
    instruction: string
  ): Promise<void> {
    if (this.processing.has(chatId)) {
      this.send(chatId, "⚠️ <b>Already processing a trade request. Please wait.</b>");
      return;
    }
    this.processing.add(chatId);
    console.log(`[TelegramBot] Handling trade instruction: "${instruction}"`);
    // Single status message for the entire process
    const statusMsg = await this.send(chatId, "🔄 <b>Processing trade request...</b>");
    try {
      // Step 1: Parse intent
      console.log("[TelegramBot] Parsing intent...");
      const intent = await this.orchestrator.parseInstruction(instruction);
      console.log("[TelegramBot] Intent parsed:", intent.intentId);
      await this.editMessage(chatId, statusMsg.message_id, MessageFormatter.intentParsed(intent));
      // Step 2: Validate with ArmorClaw
      console.log("[TelegramBot] Validating intent...");
      const validation = await this.orchestrator.validateIntent(intent);
      console.log("[TelegramBot] Validation result:", validation.status);
      await this.editMessage(chatId, statusMsg.message_id, MessageFormatter.validationResult(validation));
      // Step 3: Analyze with Analyst Agent
      if (validation.status === "APPROVED" && validation.signedPayload) {
        console.log("[TelegramBot] Analyzing intent...");
        const delegation = await this.orchestrator.analyzeIntent(validation.signedPayload);
        console.log("[TelegramBot] Delegation result:", delegation.status);
        if (delegation.status === "delegation_request") {
          // Build recommended intent
          const recommendedIntent = {
            ...intent,
            action: delegation.side!.toUpperCase() as "BUY" | "SELL",
            quantity: delegation.suggested_quantity!,
            limitPrice: delegation.order_type === "limit" ? delegation.suggested_price : undefined,
          };

          // Show recommendation with approve/disapprove buttons
          const keyboard = {
            inline_keyboard: [
              [
                { text: "✅ Approve Recommendation", callback_data: "approve_" + intent.intentId },
                { text: "❌ Use Original", callback_data: "disapprove_" + intent.intentId }
              ]
            ]
          };

          await this.editMessage(
            chatId,
            statusMsg.message_id,
            `🤖 <b>Analyst Recommendation</b>\n\n` +
            `📊 <b>Original:</b> ${intent.action} ${intent.quantity} shares of ${intent.ticker}\n` +
            `🎯 <b>Recommended:</b> ${recommendedIntent.action} ${recommendedIntent.quantity} shares of ${recommendedIntent.ticker}\n` +
            `📈 <b>Confidence:</b> ${(delegation.confidence_score! * 100).toFixed(1)}%\n` +
            `💡 <b>Rationale:</b> ${delegation.rationale}\n\n` +
            `Choose your action:`,
            { reply_markup: keyboard }
          );

          // Store pending recommendation
          this.pendingRecommendations.set(chatId, {
            originalIntent: intent,
            recommendedIntent,
            validation,
            delegation,
            statusMsgId: statusMsg.message_id
          });

          this.processing.delete(chatId);
          return;
        } else {
          await this.editMessage(
            chatId,
            statusMsg.message_id,
            `❌ Analyst rejected: ${delegation.reason}`
          );
          this.processing.delete(chatId);
          return;
        }
      }
      // If no recommendation needed, execute directly
      if (validation.status === "APPROVED" && validation.signedPayload) {
        console.log("[TelegramBot] Executing trade...");
        const execution = await this.orchestrator.executeIntent(intent, validation);
        console.log("[TelegramBot] Execution result:", execution.success);
        await this.editMessage(
          chatId,
          statusMsg.message_id,
          MessageFormatter.executionResult(execution, intent)
        );
      }
    } catch (error) {
      console.error("[TelegramBot] Error handling trade:", error);
      await this.editMessage(
        chatId,
        statusMsg.message_id,
        MessageFormatter.error((error as Error).message)
      );
    } finally {
      this.processing.delete(chatId);
    }
  }
  // ── ASK FLOW ──────────────────────────────────────────────
  private async handleAsk(chatId: number, question: string): Promise<void> {
    const loadMsg = await this.send(chatId, MessageFormatter.loading("Thinking with AI..."));
    try {
      const result = await this.openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: `You are a helpful trading advisor. Answer this question clearly and concisely: ${question}` }],
        temperature: 0.7,
      });
      const response = result.choices[0].message.content;
      await this.editMessage(chatId, loadMsg.message_id, `🤖 <b>AI Advisor:</b>\n\n${response}`);
    } catch (error) {
      await this.editMessage(chatId, loadMsg.message_id, MessageFormatter.error((error as Error).message));
    }
  }
  // ── HELPERS ───────────────────────────────────────────────
  private async send(chatId: number, text: string): Promise<TelegramBot.Message> {
    return this.bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  }
  private async editMessage(
    chatId: number,
    messageId: number,
    text: string,
    options?: { reply_markup?: any }
  ): Promise<void> {
    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        ...options,
      });
    } catch {
      // Message may not have changed — ignore
    }
  }
}