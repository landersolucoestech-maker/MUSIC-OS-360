// Real Graphify adapter — context ENRICHMENT only (section 20: "do NOT treat
// Graphify as a vulnerability scanner"). Graphify's real CLI (confirmed via
// `graphify --help` on this machine) is primarily a per-agent SKILL/hook
// INSTALLER (`graphify claude install`, `graphify cursor install`, ...) that
// wires itself into another coding agent's config — this adapter never
// calls any `install`/`uninstall`/`clone`/`add <url>` subcommand, since
// those mutate this environment's own tool configuration or touch the
// network, both outside this integration's authority. The only commands
// used here are read-only LOCAL queries against an ALREADY-BUILT graph.json
// (`path`, `explain`) — never a fetch, never a write to shared config.
// A graph relationship returned here is enrichment context for a reviewer,
// never itself a confirmed finding (security-verification-engine.mjs must
// not promote it automatically).
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./exec.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPolicy(cwd) {
  const candidates = [join(cwd, ".claude", "policies", "security-testing.json"), join(__dirname, "..", "..", "policies", "security-testing.json")];
  for (const p of candidates) if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  return null;
}

/** Looks up the shortest path between two nodes in an EXISTING graph.json —
 * the only Graphify capability this adapter exposes. Requires the caller to
 * already have a graph.json (this adapter never builds/extracts one, since
 * doing so is Graphify's own install/hook-driven process, not something to
 * trigger from this pack). Enforces the PER-OPERATION policy itself
 * (security-testing.json's tools.graphify.operations.path) rather than
 * trusting the caller — "path" is PASSIVE/local; clone/add/install are not
 * and this adapter never calls them regardless of what policy says. */
export function queryGraphPath(graphJsonPath, nodeA, nodeB, { executablePath = "graphify", cwd = process.cwd() } = {}) {
  const policy = loadPolicy(cwd);
  const opPolicy = policy?.tools?.graphify?.operations?.path;
  if (!opPolicy || opPolicy.classification !== "PASSIVE") {
    return { available: false, unavailableReason: `graphify "path" operation is not classified PASSIVE in security-testing.json (found: ${opPolicy?.classification ?? "no policy entry"})` };
  }
  if (!existsSync(graphJsonPath)) {
    return { available: false, unavailableReason: `no graph.json at ${graphJsonPath} — this adapter only queries an existing graph, it never builds one` };
  }
  const check = run(process.platform === "win32" ? "where" : "which", [executablePath]);
  if (!check.ok && !existsSync(executablePath)) {
    return { available: false, unavailableReason: `${executablePath} not found` };
  }
  const result = run(executablePath, ["path", nodeA, nodeB, "--graph", graphJsonPath], { timeout: 30_000 });
  if (!result.ok) {
    return { available: false, unavailableReason: result.stderr || "graphify path query failed" };
  }
  return { available: true, enrichment: result.stdout, isSecurityFinding: false };
}
