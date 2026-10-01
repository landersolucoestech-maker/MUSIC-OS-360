import { describe, it, expect } from "vitest";
import { ofxLineToTransactionPayload, parseOfxStatement } from "./ofx-import";

const OFX = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260510120000[-3:BRT]
<TRNAMT>1500,50
<FITID>1
<MEMO>Spotify royalties
</STMTTRN>
<STMTTRN>
<TRNTYPE>POS
<DTPOSTED>20260511
<TRNAMT>-89.90
<FITID>2
<NAME>Loja de cabos
</STMTTRN>
<STMTTRN>
<TRNTYPE>CHECK
<DTPOSTED>20260512
<TRNAMT>-200.00
<FITID>3
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<TRNAMT>-1.00
<FITID>4
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
`;

/** Keys the API rejected (every imported row failed) or never read. */
const LEGACY_KEYS = ["type", "data", "valor", "descricao", "origem", "venda_id", "client_id", "artist_id"];

describe("OFX import → canonical POST /transactions body", () => {
  it("parses only complete <STMTTRN> blocks (amount + posted date)", () => {
    const lines = parseOfxStatement(OFX);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ amount: 1500.5, postedDate: "2026-05-10", memo: "Spotify royalties", trnType: "CREDIT" });
  });

  it("builds the canonical CZ-041 body for a credit line", () => {
    const [credit] = parseOfxStatement(OFX);
    expect(ofxLineToTransactionPayload(credit)).toEqual({
      transactionType: "revenue",
      counterpartyType: "company",
      category: "other",
      description: "Spotify royalties",
      amount: 1500.5,
      transactionDate: "2026-05-10",
      status: "paid",
      paymentMethod: "ted",
    });
  });

  it("maps debits to expense with a positive amount and instrument-specific payment methods", () => {
    const [, pos, check] = parseOfxStatement(OFX).map(ofxLineToTransactionPayload);
    expect(pos).toMatchObject({ transactionType: "expense", amount: 89.9, description: "Loja de cabos", paymentMethod: "debit_card" });
    expect(check).toMatchObject({ transactionType: "expense", amount: 200, description: "Transação importada", paymentMethod: "check" });
  });

  it("never emits the legacy keys the API rejected", () => {
    for (const payload of parseOfxStatement(OFX).map(ofxLineToTransactionPayload)) {
      for (const legacy of LEGACY_KEYS) expect(payload).not.toHaveProperty(legacy);
      expect(Object.keys(payload).sort()).toEqual(
        ["amount", "category", "counterpartyType", "description", "paymentMethod", "status", "transactionDate", "transactionType"],
      );
    }
  });
});
