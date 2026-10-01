/**
 * accounting/services/ofx-import.ts
 *
 * OFX bank-statement import → POST /transactions request bodies.
 *
 * The page used to post `{ type, data, category, ... }` rows — keys the API
 * rejects, so every imported row failed. Each statement line is now turned
 * into a body that uses ONLY the canonical CZ-041 camelCase keys/values
 * (the same contract `formToTransactionPayload` emits).
 */

import type { TransactionPaymentMethod, TransactionType } from "@/modules/accounting/types/accounting.types";
import { UNCATEGORIZED_CATEGORY } from "@/modules/accounting/constants/transaction-category-slugs";

/** One <STMTTRN> block of an OFX file, already normalized. */
export interface OfxStatementLine {
  /** Signed amount as written in <TRNAMT> (negative = money out). */
  amount: number;
  /** "YYYY-MM-DD" from <DTPOSTED>. */
  postedDate: string;
  /** <MEMO>, falling back to <NAME>. */
  memo: string | null;
  /** <TRNTYPE> uppercased (CREDIT, DEBIT, CHECK, CASH, ATM, POS, XFER, ...). */
  trnType: string | null;
}

export interface OfxTransactionPayload {
  transactionType: Extract<TransactionType, "revenue" | "expense">;
  counterpartyType: "company";
  category: string;
  description: string;
  amount: number;
  transactionDate: string;
  status: "paid";
  paymentMethod: TransactionPaymentMethod;
}

/**
 * Category slug for rows that were not classified yet. The imported row must
 * carry a category (the API requires one for revenue/expense); "other" is the
 * canonical id of the uncategorized placeholder (legacy "outros", TX1) and is the
 * only value the API auto-categorizes by keyword rule.
 */
export const OFX_UNCLASSIFIED_CATEGORY = UNCATEGORIZED_CATEGORY;

/**
 * An OFX line carries no counterparty classification, but the API requires
 * `counterpartyType` for revenue/expense. Bank-statement lines are recorded as
 * a company counterparty until reclassified by the user — an explicit import
 * decision (flagged in the CZ-041 report), not an inferred fact.
 */
export const OFX_COUNTERPARTY_TYPE = "company" as const;

/** Description used when the statement line has neither <MEMO> nor <NAME>. */
export const OFX_DEFAULT_DESCRIPTION = "Transação importada";

/**
 * <TRNTYPE> → canonical payment method. Only types that name the payment
 * instrument map to it; every other statement movement (CREDIT, DEBIT, XFER,
 * PAYMENT, DIRECTDEP, DIRECTDEBIT, INT, FEE, SRVCHG, OTHER, absent) is an
 * electronic movement of the bank account and is recorded as "ted".
 */
const PAYMENT_METHOD_BY_TRNTYPE: Record<string, TransactionPaymentMethod> = {
  CHECK: "check",
  CASH: "cash",
  ATM: "cash",
  POS: "debit_card",
};
const OFX_ELECTRONIC_TRANSFER: TransactionPaymentMethod = "ted";

function tag(block: string, name: string): string | null {
  const value = new RegExp(`<${name}>([^<\\n]+)`, "i").exec(block)?.[1]?.trim();
  return value ? value : null;
}

/** Parses every <STMTTRN> block that has both an amount and a posted date. */
export function parseOfxStatement(content: string): OfxStatementLine[] {
  const lines: OfxStatementLine[] = [];
  const blockRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(content)) !== null) {
    const block = match[1];
    const rawAmount = tag(block, "TRNAMT");
    const rawDate = tag(block, "DTPOSTED");
    if (!rawAmount || !rawDate) continue;

    const amount = Number.parseFloat(rawAmount.replace(",", "."));
    const postedDate = /^(\d{4})(\d{2})(\d{2})/.exec(rawDate);
    if (!Number.isFinite(amount) || !postedDate) continue;

    lines.push({
      amount,
      postedDate: `${postedDate[1]}-${postedDate[2]}-${postedDate[3]}`,
      memo: tag(block, "MEMO") ?? tag(block, "NAME"),
      trnType: tag(block, "TRNTYPE")?.toUpperCase() ?? null,
    });
  }
  return lines;
}

/** One statement line → canonical POST /transactions body. */
export function ofxLineToTransactionPayload(line: OfxStatementLine): OfxTransactionPayload {
  return {
    transactionType: line.amount >= 0 ? "revenue" : "expense",
    counterpartyType: OFX_COUNTERPARTY_TYPE,
    category: OFX_UNCLASSIFIED_CATEGORY,
    description: line.memo ?? OFX_DEFAULT_DESCRIPTION,
    amount: Math.abs(line.amount),
    transactionDate: line.postedDate,
    status: "paid",
    paymentMethod: (line.trnType && PAYMENT_METHOD_BY_TRNTYPE[line.trnType]) || OFX_ELECTRONIC_TRANSFER,
  };
}
