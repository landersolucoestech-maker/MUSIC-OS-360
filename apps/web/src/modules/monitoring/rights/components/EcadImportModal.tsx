import { useState, useRef } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { EcadIcon } from "@/shared/ui/brand-icons";
import { Upload, FileText, CheckCircle, AlertTriangle, X, RefreshCw, ChevronRight } from "lucide-react";

type ImportStep = "idle" | "uploading" | "parsing" | "normalizing" | "matching" | "done" | "error";

interface ParsePreview {
  total_linhas: number;
  obras_detectadas: number;
  periodo: string;
  valor_total: number;
  linhas_ok: number;
  linhas_erro: number;
  amostra: { isrc: string; obra: string; interprete: string; periodo: string; execucoes: number; valor: number }[];
}

const PIPELINE_STEPS = [
  { key: "uploading",   label: "Upload",         desc: "Enviando arquivo..." },
  { key: "parsing",     label: "Parser",          desc: "Lendo estrutura do arquivo..." },
  { key: "normalizing", label: "Normalização",    desc: "Padronizando ISRCs e metadados..." },
  { key: "matching",    label: "Correspondência ECAD",      desc: "Associando execuções ao catálogo..." },
  { key: "done",        label: "Conciliação",     desc: "Relatório conciliado com sucesso" },
];

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EcadImportModal({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>("idle");
  const [currentPipelineIdx, setCurrentPipelineIdx] = useState(-1);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = [".xlsx"];

  const handleFile = (f: File) => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return;
    setFile(f);
    setStep("idle");
    setPreview(null);
    setCurrentPipelineIdx(-1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const runPipeline = () => {
    if (!file) return;
    // Real ECAD report import requires a backend endpoint; never
    // simulate progress or a preview with fictitious data.
    toast.error(
      "A importação de relatório ECAD ainda não está disponível.",
    );
  };

  const reset = () => {
    setFile(null);
    setStep("idle");
    setCurrentPipelineIdx(-1);
    setPreview(null);
  };

  const done = step === "done";
  const processing = !done && step !== "idle";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!processing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <EcadIcon className="h-5 w-5" />
            Importação ECAD
            <Badge variant="outline" className="text-xs ml-1">Pipeline Automático</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Drop Zone */}
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Arraste o arquivo ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: <span className="font-sans">.xlsx</span> — máx. 50 MB</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/60">
              <div className="p-2 bg-primary/10 rounded-md">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              {!processing && !done && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={reset}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Pipeline Progress */}
          {(processing || done) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide">Pipeline de Processamento</p>
              <div className="space-y-1.5">
                {PIPELINE_STEPS.map((ps, i) => {
                  const isActive  = i === currentPipelineIdx && !done;
                  const isDone    = i < currentPipelineIdx || done;
                  const isPending = i > currentPipelineIdx && !done;
                  return (
                    <div key={ps.key} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${isActive ? "bg-primary/10 border border-primary/20" : isDone ? "bg-success/5 border border-success/20" : "bg-muted/20 border border-transparent"}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                        {isDone ? <CheckCircle className="h-4 w-4" /> : isActive ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-semibold ${isActive ? "text-primary" : isDone ? "text-success" : "text-muted-foreground"}`}>{ps.label}</p>
                        <p className={`text-xs ${isActive ? "text-muted-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"}`}>{ps.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && done && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 border border-border/60">
                  <p className="text-xs text-muted-foreground mb-1">Linhas Processadas</p>
                  <p className="text-lg font-bold tabular-nums">{preview.total_linhas.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-success mt-0.5">{preview.linhas_ok} OK · {preview.linhas_erro} erro</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 border border-border/60">
                  <p className="text-xs text-muted-foreground mb-1">Obras Detectadas</p>
                  <p className="text-lg font-bold tabular-nums">{preview.obras_detectadas}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">período {preview.periodo}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 border border-border/60">
                  <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                  <p className="text-lg font-bold tabular-nums">{fmtBRL(preview.valor_total)}</p>
                  <p className="text-xs text-success mt-0.5">Conciliado</p>
                </div>
              </div>

              <div>
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <ListSectionHeader
                    title="Amostra de Dados"
                    count={preview.amostra.length}
                    description="Confira uma prévia das obras, ISRCs, execuções e valores importados"
                    className="px-3 pt-3"
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-no-sort="true">ISRC</TableHead>
                        <TableHead data-no-sort="true">Obra</TableHead>
                        <TableHead data-no-sort="true" className="hidden sm:table-cell">Intérprete</TableHead>
                        <TableHead data-no-sort="true" className="text-right">Exec.</TableHead>
                        <TableHead data-no-sort="true" className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.amostra.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell><code className="font-sans text-muted-foreground">{row.isrc}</code></TableCell>
                          <TableCell className="font-medium">{row.obra}</TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">{row.interprete}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.execucoes}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{fmtBRL(row.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                <p className="text-xs text-success font-medium">Relatório ECAD importado e conciliado com sucesso. Execuções adicionadas ao módulo de Monitoramento de direitos.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); reset(); }} disabled={processing}>
              {done ? "Fechar" : "Cancelar"}
            </Button>
            {!done && (
              <Button
                size="sm"
                className="gap-2 bg-primary hover:bg-primary/90"
                disabled={!file || processing}
                onClick={runPipeline}
              >
                {processing ? <><RefreshCw className="h-4 w-4 animate-spin" />Processando...</> : <><Upload className="h-4 w-4" />Iniciar Importação</>}
              </Button>
            )}
            {done && (
              <Button size="sm" variant="outline" className="gap-1" onClick={reset}>
                Nova Importação <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
