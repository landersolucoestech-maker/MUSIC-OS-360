/** HTML-escapes user-authored text before it is written into the print window (S2-4: stored XSS via document.write). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Print document for a contract template; `name` and `content` are escaped (the content is shown as plain text in a <pre>). */
export function buildTemplatePrintHtml(name: unknown, content: unknown): string {
  return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${escapeHtml(name)}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; }
            h1 { text-align: center; margin-bottom: 30px; }
            .variable { background-color: #fff3cd; padding: 2px 6px; border-radius: 4px; font-family: Inter, system-ui, sans-serif; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Times New Roman', Times, serif; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(name)}</h1>
          <pre>${escapeHtml(content)}</pre>
        </body>
        </html>
      `;
}
