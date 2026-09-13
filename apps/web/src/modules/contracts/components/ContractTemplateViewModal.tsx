import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Printer, Download, Copy } from "lucide-react";
import type { ContractTemplateRow } from "@/modules/contracts/hooks/useContractTemplates";
import { A4Preview } from "@/modules/contracts/components/ContractA4Preview";
import { toast } from "sonner";

interface ContractTemplateViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContractTemplateRow | null;
}

export function ContractTemplateViewModal({
  open,
  onOpenChange,
  template,
}: ContractTemplateViewModalProps) {
  if (!template) return null;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${template.nome}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; }
            h1 { text-align: center; margin-bottom: 30px; }
            .variable { background-color: #fff3cd; padding: 2px 6px; border-radius: 4px; font-family: Inter, system-ui, sans-serif; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Times New Roman', Times, serif; }
          </style>
        </head>
        <body>
          <h1>${template.nome}</h1>
          <pre>${template.conteudo ?? ""}</pre>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(template.conteudo ?? "");
    toast.success("Conteúdo copiado para a área de transferência!");
  };

  const handleDownload = () => {
    const blob = new Blob([template.conteudo ?? ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.nome.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Template baixado com sucesso!");
  };

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const fmtSlug = (slug: string) =>
    slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-xl leading-snug">{template.nome}</DialogTitle>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={template.ativo ? "default" : "secondary"}
                  className="no-underline"
                >
                  {template.ativo ? "Ativo" : "Inativo"}
                </Badge>
                {template.tipo_servico && (
                  <Badge variant="outline" className="no-underline">
                    {fmtSlug(template.tipo_servico)}
                  </Badge>
                )}
              </div>
            </div>
            {template.descricao && (
              <p className="text-sm text-muted-foreground mt-1">{template.descricao}</p>
            )}
          </DialogHeader>
        </div>

        <Separator className="shrink-0" />

        {/* ── A4 Document Preview ── */}
        <div className="overflow-y-auto flex-1 min-h-0">
          <A4Preview
            headerImage={template.header_image ?? null}
            content={template.conteudo ?? ""}
            footerImage={template.footer_image ?? null}
          />
        </div>

        <Separator className="shrink-0" />

        {/* ── Footer ── */}
        <div className="px-6 py-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Criado em: {fmtDate(template.created_at)}</span>
            <span>Atualizado: {fmtDate(template.updated_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
