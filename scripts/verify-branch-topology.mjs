#!/usr/bin/env node
/**
 * Keeps CI/CD aligned with the repository owner's branch policy:
 * `dev` is the ONLY branch. There is no `staging` branch and no `main` branch;
 * staging is an environment reached by manual dispatch from `dev`, and a
 * production release is an owner-authorized manual action.
 *
 * The check is structural (workflow text), like the other verify-*.mjs guards,
 * and exports `verifyTopology` so the rule can be tested against fixtures.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function extractJobBlock(source, jobName) {
  const lines = source.split("\n");
  const start = lines.findIndex(
    (line) => /^ {2}[\w-]+:\s*$/.test(line) && line.trim() === `${jobName}:`,
  );
  if (start === -1) return null;

  const block = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^ {2}[\w-]+:\s*$/.test(lines[index])) break;
    block.push(lines[index]);
  }
  return block.join("\n");
}

/** Every `branches: [...]` / `branches:` list item in a workflow, as branch names. */
function declaredBranches(source) {
  const names = [];
  for (const match of source.matchAll(/^\s*branches:\s*\[([^\]]*)\]/gm)) {
    names.push(...match[1].split(",").map((name) => name.trim().replace(/^["']|["']$/g, "")).filter(Boolean));
  }
  for (const match of source.matchAll(/^\s*branches:\s*\n((?:\s+-\s*\S+\s*\n?)+)/gm)) {
    names.push(...[...match[1].matchAll(/-\s*["']?([^\s"']+)["']?/g)].map((item) => item[1]));
  }
  return names;
}

export function verifyTopology({ ci, security, staging, runbook }) {
  const errors = [];

  for (const [name, source] of [["ci.yml", ci], ["security.yml", security]]) {
    const branches = declaredBranches(source);
    if (branches.length < 2) {
      errors.push(`${name} must declare push and pull_request branches: [dev].`);
    }
    for (const branch of branches) {
      if (branch !== "dev") errors.push(`${name} targets branch "${branch}"; dev is the only permitted branch.`);
    }
  }

  if (/^\s*push:/m.test(staging)) {
    errors.push("staging.yml must not run on push: staging is an environment reached by manual dispatch from dev.");
  }
  if (!/workflow_dispatch:/.test(staging)) {
    errors.push("staging.yml must be runnable by workflow_dispatch.");
  }
  if (declaredBranches(staging).length > 0) {
    errors.push("staging.yml must not declare branch filters.");
  }
  if (/\bref:\s*(?!\$\{\{)\S+/.test(staging)) {
    errors.push("staging.yml must check out the dispatching ref, never a hard-coded ref.");
  }
  if (/refs\/heads\/(?!dev\b)[\w.\/-]+/.test(staging)) {
    errors.push("staging.yml may only reference refs/heads/dev.");
  }
  if ((staging.match(/github\.ref == 'refs\/heads\/dev'/g) ?? []).length < 2) {
    errors.push("staging deploy and smoke jobs must be guarded by refs/heads/dev.");
  }

  for (const [name, source] of [["ci.yml", ci], ["security.yml", security], ["staging.yml", staging]]) {
    if (/refs\/heads\/(?:main|staging)\b/.test(source)) {
      errors.push(`${name} references refs/heads/main or refs/heads/staging; those branches do not exist.`);
    }
  }

  for (const jobName of ["db-verify-application-dev", "db-verify-realtime-external-dev"]) {
    const block = extractJobBlock(ci, jobName);
    if (!block) {
      errors.push(`ci.yml is missing jobs.${jobName}.`);
      continue;
    }
    if (!block.includes("if: github.ref == 'refs/heads/dev'")) {
      errors.push(`${jobName} must run only on refs/heads/dev.`);
    }
    if (block.includes("refs/heads/main") || block.includes("refs/heads/staging")) {
      errors.push(`${jobName} must never query staging or production environments.`);
    }
  }

  if (/dev\s*(?:->|→)\s*staging\s*(?:->|→)\s*main/.test(runbook)) {
    errors.push("The release runbook must not describe a dev -> staging -> main promotion.");
  }
  if (!/dev is the only branch/i.test(runbook)) {
    errors.push('The release runbook must state "dev is the only branch".');
  }

  return errors;
}

function main() {
  const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");
  const errors = verifyTopology({
    ci: read(".github/workflows/ci.yml"),
    security: read(".github/workflows/security.yml"),
    staging: read(".github/workflows/staging.yml"),
    runbook: read("docs/runbooks/staging-to-production.md"),
  });

  if (errors.length > 0) {
    console.error("❌ Branch topology guard failed:");
    for (const error of errors) console.error(`  • ${error}`);
    process.exit(1);
  }

  console.log("✓ Branch topology verified: dev is the only branch");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
