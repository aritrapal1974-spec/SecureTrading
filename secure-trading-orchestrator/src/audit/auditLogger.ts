import Database from "better-sqlite3";

export class AuditLogger {
  private db: Database.Database;

  constructor(path = "./audit.db") {
    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action TEXT,
        ticker TEXT,
        status TEXT,
        reason TEXT
      )
    `);
  }

  log(entry: { action: string; ticker: string; status: string; reason: string }) {
    const stmt = this.db.prepare(
      "INSERT INTO audit (timestamp, action, ticker, status, reason) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(new Date().toISOString(), entry.action, entry.ticker, entry.status, entry.reason);
  }
}
