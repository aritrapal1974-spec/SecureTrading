import fs from "fs";
import path from "path";
import { PolicyConfig } from "../types/intent";
// ============================================================
// POLICY LOADER
// Loads from config/policy.json — manually maintained
// AI cannot modify this file
// ============================================================
function loadPolicy(): PolicyConfig {
  const policyPath = path.join(process.cwd(), "config", "policy.json");
  const raw = fs.readFileSync(policyPath, "utf-8");
  return JSON.parse(raw) as PolicyConfig;
}
export const ACTIVE_POLICY: PolicyConfig = loadPolicy();
export const POLICY_SET = new Set(
  ACTIVE_POLICY.allowedTickers.map((t) => t.toUpperCase())
);