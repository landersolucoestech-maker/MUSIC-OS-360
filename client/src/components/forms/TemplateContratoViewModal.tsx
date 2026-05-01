import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, Copy } from "lucide-react";
import { TemplateContrato } from "@/lib/template-contrato-types";
import { toast } from "sonner";
interface TemplateContratoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateContrato | null;
}
export function TemplateContratoViewModal({
  open,
  onOpenChange,
  template
}: TemplateContratoViewModalProps) {
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
            body {
              font-family: 'Times New Roman', Times, serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.8;
            }
            h1 {
              text-align: center;
              margin-bottom: 30px;
            }
            .variable {
              background-color: #fff3cd;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: monospace;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              font-family: 'Times New Roman', Times, serif;
            }
          </style>
        </head>
        <body>
          <h1>${template.nome}</h1>
          <pre>${highlightVariables(template.conteudo)}</pre>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(template.conteudo);
    toast.success("Conteúdo copiado para a área de transferência!");
  };
  const handleDownload = () => {
    const blob = new Blob([template.conteudo], {
      type: "text/plain"
    });
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
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{template.nome}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={template.ativo ? "default" : "secondary"}>
                {template.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <Badge variant="outline">{template.tipoServico}</Badge>
            </div>
          </div>
          {template.descricao && <p className="text-sm text-muted-foreground mt-1">
              {template.descricao}
            </p>}
        </DialogHeader>

        {/* Variables */}
        

        <Separator />

        {/* Content Preview */}
        <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-6">
          <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
            {renderContentWithHighlightedVariables(template.conteudo)}
          </div>
        </ScrollArea>

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Criado em: {new Date(template.dataCriacao).toLocaleDateString("pt-BR")}
          </span>
          <span>
            Última atualização:{" "}
            {new Date(template.dataAtualizacao).toLocaleDateString("pt-BR")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Baixar
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>;
}
function highlightVariables(content: string): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, '<span class="variable">{{$1}}</span>');
}
function renderContentWithHighlightedVariables(content: string) {
  const parts = content.split(/(\{\{[A-Z_]+\}\})/g);
  return parts.map((part, index) => {
    if (part.match(/^\{\{[A-Z_]+\}\}$/)) {
      return <span key={index} className="bg-yellow-200/50 dark:bg-yellow-900/30 px-1 rounded font-mono text-xs">
          {part}
        </span>;
    }
    return part;
  });
}