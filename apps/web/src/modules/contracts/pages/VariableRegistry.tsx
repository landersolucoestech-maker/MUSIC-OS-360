import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { Checkbox } from "@/shared/ui/checkbox";
import { Braces, Copy, Pencil, Trash2, Plus, Variable, X, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useVariableRegistry } from "@/modules/contracts/hooks/useVariableRegistry";
import type { RegistryVariable } from "@/modules/contracts/hooks/useVariableRegistry";
import { PageHeader } from "@/shared/components/PageHeader";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";

// ── Validation helpers ─────────────────────────────────────────────────────

const SLUG_REGEX = /^[A-Z][A-Z0-9_]+$/;

function normalizeSlug(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function isValidSlug(v: string): boolean {
  return SLUG_REGEX.test(v) && v.length >= 2;
}

// ── Import file validation + normalisation ────────────────────────────────

interface ImportRow {
  name: string;
  group: string;
  field: string;
  placeholder: string;
  internalGroup?: string;
}

/** Returns a normalised ImportRow or null if the record is not usable. */
function normaliseImportRow(v: unknown): ImportRow | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const group =
    typeof r.group === "string" ? r.group.trim() : "";
  const field =
    typeof r.field === "string" ? r.field.trim() : "";
  const placeholder =
    typeof r.placeholder === "string" ? r.placeholder.trim() : "";
  if (!group || !field || !placeholder) return null;
  // `name` is required by the UI — fall back to "GROUP.FIELD" if missing/blank
  const rawName =
    typeof r.name === "string" ? r.name.trim() : "";
  const name = rawName || `${group}.${field}`;
  const internalGroup =
    typeof r.internalGroup === "string" && r.internalGroup.trim()
      ? r.internalGroup.trim()
      : undefined;
  return { name, group, field, placeholder, internalGroup };
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="rounded-full bg-primary/10 p-5">
        <Variable className="h-10 w-10 text-primary/60" />
      </div>
      <div>
        <p className="text-lg font-semibold">Nenhuma variável criada</p>
        <p className="text-sm text-muted-foreground mt-1">
          Clique em "Nova Variável" para começar a criar placeholders reutilizáveis.
        </p>
      </div>
      <Button onClick={onNew} data-testid="button-new-variable-empty">
        <Plus className="h-4 w-4 mr-2" />
        Nova Variável
      </Button>
    </div>
  );
}

// ── Variable form modal ────────────────────────────────────────────────────

interface VariableFormState {
  name: string;
  group: string;
  field: string;
  internalGroup: string;
}

interface VariableFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: VariableFormState;
  onSubmit: (values: VariableFormState) => void;
  mode: "create" | "edit";
}

function VariableFormModal({
  open,
  onOpenChange,
  initial,
  onSubmit,
  mode,
}: VariableFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const [field, setField] = useState(initial?.field ?? "");
  const [internalGroup, setInternalGroup] = useState(initial?.internalGroup ?? "");

  const groupNorm = normalizeSlug(group);
  const fieldNorm = normalizeSlug(field);
  const preview =
    isValidSlug(groupNorm) && isValidSlug(fieldNorm)
      ? `{{${groupNorm}.${fieldNorm}}}`
      : "{{ALIAS.CAMPO}}";

  const nameError = name.trim().length === 0 ? "Nome é obrigatório" : null;
  const groupError =
    group.trim().length === 0
      ? "Alias é obrigatório"
      : !isValidSlug(groupNorm)
        ? "Mínimo 2 caracteres (letras/números/_)"
        : null;
  const fieldError =
    field.trim().length === 0
      ? "Campo é obrigatório"
      : !isValidSlug(fieldNorm)
        ? "Mínimo 2 caracteres (letras/números/_)"
        : null;

  const canSubmit = !nameError && !groupError && !fieldError;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      group: groupNorm,
      field: fieldNorm,
      internalGroup: internalGroup.trim(),
    });
    onOpenChange(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setName(initial?.name ?? "");
      setGroup(initial?.group ?? "");
      setField(initial?.field ?? "");
      setInternalGroup(initial?.internalGroup ?? "");
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-variable-form">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova Variável" : "Editar Variável"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="vr-name">Nome amigável</Label>
            <Input
              id="vr-name"
              placeholder="Ex: Nome do Artista"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-variable-name"
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Alias + Internal side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vr-group">
                Alias Visual / Jurídico
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">(aparece no placeholder)</span>
              </Label>
              <Input
                id="vr-group"
                placeholder="Ex: ARTISTA"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                data-testid="input-variable-group"
              />
              {groupError && (
                <p className="text-xs text-destructive">{groupError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vr-internal">
                Nomenclatura Interna
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="vr-internal"
                placeholder="Ex: artist"
                value={internalGroup}
                onChange={(e) => setInternalGroup(e.target.value)}
                data-testid="input-variable-internal"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Organização interna — não aparece no placeholder
              </p>
            </div>
          </div>

          {/* Field */}
          <div className="space-y-1.5">
            <Label htmlFor="vr-field">Campo</Label>
            <Input
              id="vr-field"
              placeholder="Ex: NAME"
              value={field}
              onChange={(e) => setField(e.target.value)}
              data-testid="input-variable-field"
            />
            {fieldError && (
              <p className="text-xs text-destructive">{fieldError}</p>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-md border bg-muted/40 px-4 py-3 flex items-center gap-3">
            <Braces className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-sans text-primary font-medium">
                {preview}
              </span>
              {internalGroup.trim() && (
                <span className="ml-3 text-xs text-muted-foreground">
                  → grupo interno: <span className="font-sans">{internalGroup.trim()}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            data-testid="button-variable-form-cancel"
          >
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="button-variable-form-submit"
          >
            {mode === "create" ? "Criar Variável" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import confirmation dialog ─────────────────────────────────────────────

interface ImportPreview {
  incoming: ImportRow[];
  willAdd: number;
  willSkip: number;
}

function ImportConfirmDialog({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={!!preview} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm" data-testid="dialog-import-confirm">
        <DialogHeader>
          <DialogTitle>Confirmar Importação</DialogTitle>
          <DialogDescription>
            O ficheiro contém <strong>{preview?.incoming.length ?? 0}</strong> variável(eis).
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="space-y-2 py-1">
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">A adicionar</span>
              <span className="font-semibold text-primary">{preview.willAdd}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Já existem (ignoradas)</span>
              <span className="font-semibold text-muted-foreground">{preview.willSkip}</span>
            </div>
            {preview.willAdd === 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                Todas as variáveis do ficheiro já existem no registo.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="button-import-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!preview || preview.willAdd === 0}
            data-testid="button-import-confirm"
          >
            {preview && preview.willAdd > 0
              ? `Importar ${preview.willAdd} variável(eis)`
              : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface VariableRegistryProps {
  asModal?: boolean;
  onClose?: () => void;
}

export default function VariableRegistry({ asModal = false, onClose }: VariableRegistryProps = {}) {
  const { variables, addVariable, updateVariable, removeVariable, removeVariables, importVariables } =
    useVariableRegistry();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RegistryVariable | null>(null);
  const [search, setSearch] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = variables.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.placeholder.toLowerCase().includes(q) ||
      v.group.toLowerCase().includes(q) ||
      v.field.toLowerCase().includes(q) ||
      (v.internalGroup?.toLowerCase().includes(q) ?? false)
    );
  });

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  // ── Export ───────────────────────────────────────────────────────────────

  function handleExport() {
    const rows = variables.map((v) => ({
      Nome: v.name,
      Alias: v.group,
      "Nomenclatura Interna": v.internalGroup ?? "",
      Campo: v.field,
      Placeholder: v.placeholder,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Variáveis");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `variaveis-template-${date}.xlsx`);
    toast.success(`${variables.length} variáveis exportadas`);
  }

  // ── Import ───────────────────────────────────────────────────────────────

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected after cancel
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error("no sheet");

        // sheet_to_json returns rows as plain objects keyed by header names
        const rawRows: unknown[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        // Map spreadsheet column names → our internal field names
        const remapped = rawRows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            name:          row["Nome"]                  ?? row["name"]          ?? "",
            group:         row["Alias"]                 ?? row["group"]         ?? "",
            field:         row["Campo"]                 ?? row["field"]         ?? "",
            placeholder:   row["Placeholder"]           ?? row["placeholder"]   ?? "",
            internalGroup: row["Nomenclatura Interna"]  ?? row["internalGroup"] ?? "",
          };
        });

        const valid: ImportRow[] = remapped
          .map(normaliseImportRow)
          .filter((r): r is ImportRow => r !== null);
        if (valid.length === 0) throw new Error("no valid rows");

        // Build seen set starting from existing registry placeholders.
        // Update it as we iterate so intra-file duplicates are counted correctly.
        const seen = new Set(variables.map((v) => v.placeholder.toLowerCase()));
        let willAdd = 0;
        let willSkip = 0;
        for (const row of valid) {
          const key = row.placeholder.toLowerCase();
          if (seen.has(key)) {
            willSkip++;
          } else {
            seen.add(key);
            willAdd++;
          }
        }
        setImportPreview({ incoming: valid, willAdd, willSkip });
      } catch {
        toast.error("Ficheiro inválido — verifique o formato");
      }
    };
    reader.onerror = () => toast.error("Ficheiro inválido — verifique o formato");
    reader.readAsArrayBuffer(file);
  }

  function handleConfirmImport() {
    if (!importPreview) return;
    // Convert ImportRow → RegistryVariable with dummy id/createdAt;
    // importVariables() will regenerate both fields.
    const asVars: RegistryVariable[] = importPreview.incoming.map((row) => ({
      ...row,
      id: "",
      createdAt: "",
    }));
    const { added, skipped } = importVariables(asVars);
    setImportPreview(null);
    if (skipped > 0) {
      toast.success(`${added} variáveis importadas (${skipped} já existiam)`);
    } else {
      toast.success(`${added} variáveis importadas`);
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  function handleCreate(values: VariableFormState) {
    addVariable(values.name, values.group, values.field, values.internalGroup || undefined);
    toast.success("Variável criada com sucesso");
  }

  function handleEdit(values: VariableFormState) {
    if (!editTarget) return;
    updateVariable(editTarget.id, {
      name: values.name,
      group: values.group,
      field: values.field,
      internalGroup: values.internalGroup || undefined,
    });
    toast.success("Variável atualizada");
    setEditTarget(null);
  }

  function handleCopy(placeholder: string) {
    navigator.clipboard
      .writeText(placeholder)
      .then(() => toast.success(`${placeholder} copiado`))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  function handleDelete(v: RegistryVariable) {
    removeVariable(v.id);
    // Remove from selection if it was selected
    setSelected((prev) => { const next = new Set(prev); next.delete(v.id); return next; });
    toast.success(`"${v.name}" removida`);
  }

  // ── Bulk selection ────────────────────────────────────────────────────────

  const allFilteredIds = filtered.map((v) => v.id);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected = allFilteredIds.some((id) => selected.has(id));
  const selectedCount = allFilteredIds.filter((id) => selected.has(id)).length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...allFilteredIds]));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = allFilteredIds.filter((id) => selected.has(id));
    removeVariables(ids);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setBulkDeleteOpen(false);
    toast.success(`${ids.length} variável(eis) eliminada(s)`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-import"
      />

      {asModal ? (
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <p className="text-base font-semibold">Variáveis de Template</p>
            <p className="text-xs text-muted-foreground">Crie, organize e reutilize placeholders em qualquer contrato</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleImportClick} data-testid="button-modal-import">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Importar
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} data-testid="button-modal-export">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-variable-modal">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Variável
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} data-testid="button-close-var-registry-modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Variáveis de Template"
          description="Crie, organize e reutilize placeholders em qualquer contrato"
          actions={{
            import: true,
            export: true,
            onImport: handleImportClick,
            onExport: handleExport,
            custom: (
              <Button
                onClick={() => setCreateOpen(true)}
                data-testid="button-new-variable"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Variável
              </Button>
            ),
          }}
        />
      )}

      <div className="flex-1 overflow-auto p-6">
        {variables.length === 0 ? (
          <EmptyState onNew={() => setCreateOpen(true)} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
              <Input
                placeholder="Pesquisar variáveis..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }}
                className="h-8 text-sm max-w-sm"
                data-testid="input-search-variables"
              />
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} selecionada(s)
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Eliminar selecionadas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    data-testid="button-clear-selection"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-md border">
              <ListSectionHeader
                title="Lista de Variáveis"
                count={filtered.length}
                description="Acompanhe placeholders, aliases, nomenclatura interna e campos reutilizáveis"
                className="px-4 pt-4"
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todas"
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedCount > 0 ? `${selectedCount} selecionada(s)` : "Selecionar todos"}
                    </span>
                  </div>
                }
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Alias</TableHead>
                    <TableHead>Nomenclatura Interna</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Placeholder</TableHead>
                    <TableHead className="w-28 text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-10"
                      >
                        Nenhuma variável encontrada para "{search}"
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((v) => (
                      <TableRow
                        key={v.id}
                        data-testid={`row-variable-${v.id}`}
                        data-selected={selected.has(v.id)}
                        className={selected.has(v.id) ? "bg-muted/40" : undefined}
                      >
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selected.has(v.id)}
                            onCheckedChange={() => toggleSelect(v.id)}
                            aria-label={`Seleccionar ${v.name}`}
                            data-testid={`checkbox-variable-${v.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{v.group}</Badge>
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {v.internalGroup ?? <span className="opacity-30">—</span>}
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {v.field}
                        </TableCell>
                        <TableCell>
                          <span className="font-sans text-xs text-primary bg-primary/5 border border-primary/15 rounded px-2 py-0.5">
                            {v.placeholder}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleCopy(v.placeholder)}
                              title="Copiar placeholder"
                              data-testid={`button-copy-variable-${v.id}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditTarget(v)}
                              title="Editar"
                              data-testid={`button-edit-variable-${v.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(v)}
                              title="Remover"
                              data-testid={`button-delete-variable-${v.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="variáveis"
            />
          </div>
        )}
      </div>

      <VariableFormModal
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
      />

      {editTarget && (
        <VariableFormModal
          key={editTarget.id}
          open={!!editTarget}
          onOpenChange={(v) => { if (!v) setEditTarget(null); }}
          mode="edit"
          initial={{
            name: editTarget.name,
            group: editTarget.group,
            field: editTarget.field,
            internalGroup: editTarget.internalGroup ?? "",
          }}
          onSubmit={handleEdit}
        />
      )}

      <ImportConfirmDialog
        preview={importPreview}
        onConfirm={handleConfirmImport}
        onCancel={() => setImportPreview(null)}
      />

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle>Eliminar variáveis</DialogTitle>
            <DialogDescription>
              Esta acção é irreversível. Serão eliminadas{" "}
              <strong>{selectedCount}</strong> variável(eis) seleccionada(s).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              data-testid="button-bulk-delete-cancel"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              data-testid="button-bulk-delete-confirm"
            >
              Eliminar {selectedCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

