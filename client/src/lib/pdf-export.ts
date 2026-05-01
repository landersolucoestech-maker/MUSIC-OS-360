import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: { header: string; accessor: string }[];
  data: Record<string, unknown>[];
  filename?: string;
}

export function exportToPDF({
  title,
  subtitle,
  columns,
  data,
  filename = "relatorio",
}: ExportOptions): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 20, { align: "center" });

  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth / 2, 28, { align: "center" });
  }

  // Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
    pageWidth / 2,
    subtitle ? 36 : 28,
    { align: "center" }
  );

  // Table
  const tableHeaders = columns.map((col) => col.header);
  const tableData = data.map((row) =>
    columns.map((col) => {
      const value = row[col.accessor];
      if (value === null || value === undefined) return "-";
      if (typeof value === "number") {
        return value.toLocaleString("pt-BR");
      }
      if (value instanceof Date) {
        return value.toLocaleDateString("pt-BR");
      }
      return String(value);
    })
  );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: subtitle ? 42 : 34,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`${filename}.pdf`);
}

export function exportContractToPDF(
  content: string,
  title: string,
  filename?: string
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Remove HTML tags and split into lines
  const cleanContent = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  const lines = doc.splitTextToSize(cleanContent, maxWidth);
  let y = 35;
  const lineHeight = 6;
  const pageHeight = doc.internal.pageSize.getHeight();

  lines.forEach((line: string) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  });

  doc.save(`${filename || "contrato"}.pdf`);
}
