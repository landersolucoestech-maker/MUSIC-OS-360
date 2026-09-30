#!/usr/bin/env node
/**
 * Structural replacement for the old `grep -q "express.json({ limit:"` check
 * (CI: "Security Regression (FASE 9.x fixes)" > "Body limit + 413 handler
 * present"). The single-line grep broke as a false negative the moment
 * express.json({ ... }) was reformatted across multiple lines, even though
 * the actual body-limit hardening was untouched and correct.
 *
 * This walks the real TypeScript AST of apps/api/src/main.ts (via the
 * `typescript` compiler API, already a root devDependency — no new
 * dependency added) and checks the real invariants, independent of
 * formatting:
 *   1. every express.json({...}) call has an explicit `limit` property;
 *   2. that limit is a string literal and does not exceed APPROVED_MAX_BYTES;
 *   3. at least one express.json call captures rawBody via a `verify`
 *      callback that assigns to `req.rawBody` (required for Stripe webhook
 *      signature verification downstream);
 *   4. no express.json call is missing a limit — i.e. a later call can't
 *      silently reconfigure the parser without one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// BUG FIXED: was apps/api/src/main.ts — the express.json({...}) body-limit
// middleware moved to create-app.ts when main.ts's bootstrap() was
// extracted into a shared createApp(), so this
// path check had gone stale and started reporting a false "missing
// entirely" the moment CI actually ran to completion again.
const TARGET = path.resolve(__dirname, '..', 'apps/api/src/create-app.ts');
const APPROVED_MAX_BYTES = 1024 * 1024; // 1mb — current approved ceiling.

function parseByteLimit(literal) {
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(literal.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'b').toLowerCase();
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[unit];
  return n * mult;
}

function findExpressJsonCalls(sourceFile) {
  const calls = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'json' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'express'
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return calls;
}

function getObjectArg(call) {
  const [arg] = call.arguments;
  return arg && ts.isObjectLiteralExpression(arg) ? arg : null;
}

function getProperty(obj, name) {
  return obj.properties.find(
    (p) => ts.isPropertyAssignment(p) && p.name && p.name.getText() === name,
  );
}

function verifyCallbackAssignsRawBody(verifyProp) {
  if (!verifyProp) return false;
  const init = verifyProp.initializer;
  const isFn = ts.isArrowFunction(init) || ts.isFunctionExpression(init);
  if (!isFn) return false;
  let found = false;
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /rawBody/.test(node.left.getText())
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(init.body);
  return found;
}

function main() {
  const src = readFileSync(TARGET, 'utf8');
  const sourceFile = ts.createSourceFile(TARGET, src, ts.ScriptTarget.Latest, true);
  const calls = findExpressJsonCalls(sourceFile);
  const errors = [];

  if (calls.length === 0) {
    errors.push('No express.json(...) call found — body size limit missing entirely.');
  }

  let sawValidRawBodyCapture = false;

  for (const call of calls) {
    const line = sourceFile.getLineAndCharacterOfPosition(call.getStart()).line + 1;
    const obj = getObjectArg(call);
    if (!obj) {
      errors.push(`main.ts:${line}: express.json() called without an options object (no limit) — reconfigures the parser with no ceiling.`);
      continue;
    }
    const limitProp = getProperty(obj, 'limit');
    if (!limitProp || !ts.isStringLiteral(limitProp.initializer)) {
      errors.push(`main.ts:${line}: express.json({...}) is missing an explicit string 'limit'.`);
      continue;
    }
    const bytes = parseByteLimit(limitProp.initializer.text);
    if (bytes === null) {
      errors.push(`main.ts:${line}: could not parse limit value "${limitProp.initializer.text}".`);
      continue;
    }
    if (bytes > APPROVED_MAX_BYTES) {
      errors.push(`main.ts:${line}: limit "${limitProp.initializer.text}" (${bytes} bytes) exceeds the approved ceiling of ${APPROVED_MAX_BYTES} bytes.`);
    }
    const verifyProp = getProperty(obj, 'verify');
    if (verifyCallbackAssignsRawBody(verifyProp)) {
      sawValidRawBodyCapture = true;
    }
  }

  if (calls.length > 0 && !sawValidRawBodyCapture) {
    errors.push('No express.json(...) call captures rawBody via a verify callback — Stripe webhook signature verification would break.');
  }

  const filterContent = readFileSync(
    path.resolve(__dirname, '..', 'apps/api/src/core/filters/global-exception.filter.ts'),
    'utf8',
  );
  if (!filterContent.includes('entity.too.large')) {
    errors.push('global-exception.filter.ts: PayloadTooLarge (entity.too.large) handler missing.');
  }

  if (errors.length > 0) {
    console.error('[verify-body-limit-guard] FAIL');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`[verify-body-limit-guard] PASS — ${calls.length} express.json() call(s), limit <= ${APPROVED_MAX_BYTES} bytes, rawBody captured, 413 handler present.`);
}

main();
