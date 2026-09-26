/**
 * modules/reports/components/ImportDialog.tsx  ·  FASE 2.5
 * Upload → validate (preview) → commit, consumindo a API real. Sem persistência
 * no validate; commit só liberado após validação aprovada.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { useImportValidate, useImportCommit } from "../hooks/useReports";
import {
  fileToImportBody, reportsApi, triggerBlobDownload,
  type ImportValidationResult, type ReportEntityDefinition,
} from "../services/reports-api";

import { toUserMessage } from "@/shared/lib/errors";
interface Props {
  open: boolean;
  onClose: () => void;
  definition: ReportEntityDefinition | null;
}

export function ImportDialog({ open, onClose, definition }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportValidationResult | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const validate = useImportValidate();
  const commit = useImportCommit();

  if (!definition) return null;

  function reset() { setFile(null); setPreview(null); }
  function close() { reset(); onClose(); }

  async function onDownloadTemplate() {
    setIsDownloadingTemplate(true);
    try {
      const { blob, filename } = await reportsApi.importTemplateBlob(definition!.tableName);
      triggerBlobDownload(blob, filename);
    } catch (e) {
      toast.error(toUserMessage(e, "Falha ao baixar o template."));
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function onValidate() {
    if (!file) return;
    const body = await fileToImportBody(file);
    validate.mutate(
      { entity: definition!.tableName, body },
      { onSuccess: setPreview, onError: (e) => toast.error(toUserMessage(e, "Falha ao validar.")) },
    );
  }

  async function onCommit() {
    if (!file) return;
    const body = await fileToImportBody(file);
    commit.mutate(
      { entity: definition!.tableName, body },
      {
        onSuccess: (r) => {
          if (r.errors.length > 0) toast.error(`Importação rejeitada: ${r.errors[0]}`);
          else toast.success(`${r.importedRows} registro(s) importado(s).`);
          if (r.errors.length === 0) close();
        },
        onError: (e) => toast.error(toUserMessage(e, "Falha ao importar.")),
      },
    );
  }

  const canCommit = !!preview && preview.supportsImport && preview.invalidRows === 0 && preview.errors.length === 0 && preview.validRows > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Importar {definition.entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownloadTemplate}
              disabled={isDownloadingTemplate}
              data-testid="import-download-template"
            >
              {isDownloadingTemplate ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
              Baixar template
            </Button>
          </div>
          <div
            className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50"
            onClick={() => fileRef.current?.click()}
            data-testid="import-dropzone"
          >
            <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">{file ? file.name : "Clique para selecionar o arquivo"}</p>
            <p className="mt-1 text-xs text-muted-foreground">XLSX</p>
          </div>
          <input
            ref={fileRef} type="file" accept=".xlsx" className="hidden"
            data-testid="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && !/\.xlsx$/i.test(f.name)) {
                toast.error("Apenas arquivos .xlsx são aceitos.");
                e.target.value = "";
                return;
              }
              setFile(f);
              setPreview(null);
            }}
          />

          {preview && (
            <div className="space-y-3 rounded-lg border border-border p-3" data-testid="import-preview">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>Total: <b>{preview.totalRows}</b></span>
                <span className="text-success">Válidas: <b>{preview.validRows}</b></span>
                <span className="text-destructive">Inválidas: <b>{preview.invalidRows}</b></span>
              </div>
              {preview.errors.length > 0 && (
                <div className="space-y-1">
                  {preview.errors.slice(0, 8).map((e, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                    </p>
                  ))}
                </div>
              )}
              {preview.warnings.length > 0 && (
                <div className="space-y-1">
                  {preview.warnings.slice(0, 5).map((w, i) => (
                    <p key={i} className="text-[11px] text-warning">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button variant="outline" onClick={onValidate} disabled={!file || validate.isPending} data-testid="import-validate">
              {validate.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Validar
            </Button>
            <Button onClick={onCommit} disabled={!canCommit || commit.isPending} data-testid="import-commit">
              {commit.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              Importar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
