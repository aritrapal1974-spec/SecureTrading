import sqlite3 from "sqlite3";
import { AuditEntry } from "../types/intent";
// ============================================================
// AUDIT LOGGER — Immutable SQLite trail
// Every trade attempt is logged regardless of outcome
// ============================================================
export class AuditLogger {
  private db: sqlite3.Database;
  private armoriqMcpUrl?: string;
  private armoriqApiKey?: string;
  constructor(dbPath: string = "./audit.db", armoriqMcpUrl?: string, armoriqApiKey?: string) {
    this.db = new sqlite3.Database(dbPath);
    this.armoriqMcpUrl = armoriqMcpUrl;
    this.armoriqApiKey = armoriqApiKey;
    this.init();
  }
  private init(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        intent_id TEXT NOT NULL,
        action TEXT NOT NULL,
        ticker TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        payload TEXT NOT NULL,
        signature TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_status ON audit_log(status);
    `);
  }
  log(entry: AuditEntry): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO audit_log
          (timestamp, intent_id, action, ticker, quantity, status, reason, payload, signature)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        entry.timestamp,
        entry.intentId,
        entry.action,
        entry.ticker,
        entry.quantity,
        entry.status,
        entry.reason,
        entry.payload,
        entry.signature || null,
        (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve((stmt as any).lastID);
          if (this.armoriqMcpUrl && this.armoriqApiKey) {
            AuditLogger.pushToArmorIQ(entry, this.armoriqMcpUrl, this.armoriqApiKey).catch(() => {
              // ignore
            });
          }
        }
      );
      stmt.finalize();
    });
  }
  getRecent(limit = 10): Promise<AuditEntry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?",
        [limit],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows as AuditEntry[]);
        }
      );
    });
  }
  getStats(): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='EXECUTED' THEN 1 ELSE 0 END) as executed,
          SUM(CASE WHEN status='BLOCKED' THEN 1 ELSE 0 END) as blocked,
          SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed
        FROM audit_log
      `, (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row as Record<string, number>);
      });
    });
  }
  private static async pushToArmorIQ(entry: AuditEntry, mcpUrl: string, apiKey: string) {
    try {
      await fetch(mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error("[AuditLogger] Failed to push to ArmorIQ MCP", error);
    }
  }

  close(): void {
    this.db.close();
  }
}