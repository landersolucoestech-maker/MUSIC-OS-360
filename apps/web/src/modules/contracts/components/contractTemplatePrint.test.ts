import { describe, expect, it } from "vitest";
import { buildTemplatePrintHtml, escapeHtml } from "./contractTemplatePrint";

describe("contract template print document (S2-4)", () => {
  it("escapes markup in the name and the content", () => {
    const html = buildTemplatePrintHtml(`<img src=x onerror=alert(1)>`, `</pre><script>alert(document.domain)</script>`);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;/pre&gt;&lt;script&gt;alert(document.domain)&lt;/script&gt;");
    expect(html).toContain("<title>&lt;img src=x onerror=alert(1)&gt;</title>");
  });
  it("keeps normal text and tolerates null content", () => {
    expect(buildTemplatePrintHtml("Contrato", "Cláusula 1 & 2")).toContain("<pre>Cláusula 1 &amp; 2</pre>");
    expect(buildTemplatePrintHtml("Contrato", null)).toContain("<pre></pre>");
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
});
