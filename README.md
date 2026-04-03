# FinancialShield (SecureTrading)

## 1) Problem Statement

- Pain Point: AI agents in financial trading systems lack deterministic safety guarantees.
- Traditional systems rely on "safety prompts" or "guidelines" which can be bypassed through prompt injection, social engineering, or agent misbehavior.
- Agents can exceed their authority, execute unauthorized trades, and operate without cryptographic proof of their intended scope.

- Why It Matters Now:
  - As financial institutions adopt autonomous AI agents, the risk of catastrophic loss from misbehavior grows exponentially.
  - Current solutions provide no deterministic enforcement—violations may only be caught after execution.

## 2) Solution Overview

FinancialShield is a secure, multi-agent autonomous trading system implementing ArmorClaw intent enforcement:

- Deterministic enforcement of user-defined intent boundaries before tool execution.
- Three-agent workflow: Analyst → Risk → Trader.
- Each agent has strictly bounded authority.
- Cryptographically bound intent scope for every action.

### Core Differentiator

- Unlike prompt-based safety, FinancialShield uses structured intent models + cryptographic token binding + declarative policy enforcement to block violations before execution.
- No human-in-the-loop is required.

## 3) Architecture

- Frontend: React dashboard with Policy Config UI, Intent Viewer, Enforcement Logs viewer
- Backend:
  - Database/Storage: File-based audit logging (enforcement logs, policy YAML configuration)
  - AI/ML/Security:
    - ArmorClaw Enforcement Gateway
      - Intent Validation Layer (Intent Parser, Policy Validator, Canonical Reasoning Graph)
      - Execution Enforcement Layer (Tool Validator, Scope Enforcer, Rate Limiter, Audit Logger)
      - Cryptographic Token Manager for tamper-evident intent binding

## 4) Key Features

- Bounded Delegation with Explicit Authority:
  - Analyst cannot execute trades.
  - Trader cannot research.
  - Risk agents validate but do not execute.
- Deterministic Policy Enforcement:
  - Violations are blocked programmatically.
  - Example policies: trade size limits ($10K max), asset restrictions (no crypto), market hours enforcement, tool allowlists.
- Prompt Injection Defense:
  - Malicious instructions are blocked via cryptographically bound expected tools.

## 5) Setup Instructions

### Prerequisites

- Node.js + npm (for this repo)
- API accounts:
  - Alpaca Markets (Paper Trading)
  - OpenAI
  - NewsAPI (optional)

### Install

```bash
cd C:\Users\kshitij\OneDrive\Desktop\SecureTrading
npm install
cd secure-trading-orchestrator
npm install
```

### Environment Variables

- `TELEGRAM_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `ARMORIQ_API_KEY`
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `SIGNER_SECRET_KEY`

### Run

```bash
npm run build
npm start
# or dev
npm run dev
# for MCP server
npm run mcp
```

## 6) Backend Tech Stack

- Node.js + TypeScript
- SQLite (`sqlite3`)
- Alpaca API (`@alpacahq/alpaca-trade-api`)
- OpenAI (`openai`)
- Model Context Protocol SDK (`@modelcontextprotocol/sdk`)
- Telegram bot (`node-telegram-bot-api`)
- Schema validation (`zod`)
- Configuration (`dotenv`)

## 7) Future Scope

### Week 1: Production Hardening & Monitoring

- Prometheus/Grafana for workflow metrics
- OpenTelemetry tracing for intent tokens
- Alerting webhooks (Slack/Email/PagerDuty)
- Persistent state:
  - PostgreSQL instead of file-based logs
  - Redis for distributed intent token storage
- Auth & multi-tenancy:
  - JWT-based RBAC (Admin, Analyst, Risk Officer, Trader)
  - Tenant isolation with policy namespaces

### Week 2: Advanced Features

- Dynamic Policy Engine v2:
  - Time-decaying exposure limits
  - Correlation-based risk rules
  - Policy simulation mode against historical trades

## 8) Links

- Repo: https://github.com/aritrapal1974-spec/SecureTrading
- Presentation: https://drive.google.com/file/d/1HFK_-SZpVfUikwtdLLKsLsZ6RPykI4wV/view?usp=sharing
