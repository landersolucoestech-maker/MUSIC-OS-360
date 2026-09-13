import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import VariableRegistry from "@/modules/contracts/pages/VariableRegistry";
import CategoryRegistry from "@/modules/contracts/pages/CategoryRegistry";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Loader2,
  Sparkles,
  Save,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Check,
  X,
  ImageUp,
} from "lucide-react";
import { HighlightedPreview, A4Preview } from "@/modules/contracts/components/ContractA4Preview";
import { toast } from "sonner";
import type {
  SemanticVariable,
  ContractTemplateRowInsert,
  ContractTemplateRowUpdate,
  ContractTemplateRow,
} from "@/modules/contracts/types/contracts.types";
import { parseContractText } from "@/modules/contracts/services/semantic-parser.service";
import { useVariableRegistry } from "@/modules/contracts/hooks/useVariableRegistry";
import { useCategoryRegistry } from "@/modules/contracts/hooks/useCategoryRegistry";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";

// ── Props ──────────────────────────────────────────────────────────────────

interface ContractImportWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ContractTemplateRowInsert) => void;
  template?: ContractTemplateRow | null;
  onEdit?: (id: string, data: ContractTemplateRowUpdate) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PLACEHOLDER_REGEX = /\{\{([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]+)\}\}/gi;

// ── Registry variable group accordion ─────────────────────────────────────

interface RegistryVarGroupProps {
  label: string;
  vars: import("@/modules/contracts/hooks/useVariableRegistry").RegistryVariable[];
  onInsert: (placeholder: string) => void;
  initialOpen?: boolean;
}

function RegistryVarGroup({ label, vars, onInsert, initialOpen = true }: RegistryVarGroupProps) {
  const [open, setOpen] = useState(initialOpen);
  if (vars.length === 0) return null;
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 w-full text-left px-1 py-1 text-[11px] font-semibold text-muted-foreground  tracking-wider hover:text-foreground transition-colors"
        data-testid={`button-vargroup-${label}`}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
      </button>
      {open && (
        <div className="space-y-0.5 pl-1">
          {vars.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between group rounded px-1.5 py-1 hover:bg-muted/60 transition-colors"
            >
              <div className="min-w-0">
                <span className="font-sans text-[11px] text-foreground/80 truncate block">
                  {v.placeholder}
                </span>
                {v.name && (
                  <span className="text-[10px] text-muted-foreground truncate block leading-tight">
                    {v.name}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onInsert(v.placeholder)}
                className="shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80"
                title={`Inserir ${v.placeholder}`}
                data-testid={`button-insert-registry-${v.id}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Image upload zone ──────────────────────────────────────────────────────

interface ImageUploadZoneProps {
  label: string;
  value: string | null;
  onChange: (val: string | null) => void;
  testIdPrefix: string;
}

function ImageUploadZone({
  label,
  value,
  onChange,
  testIdPrefix,
}: ImageUploadZoneProps) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex-1 min-w-0 space-y-2">
      <p className="text-xs font-medium text-foreground/70">{label}</p>
      {value ? (
        <div className="relative group rounded-lg border border-border overflow-hidden bg-muted/30">
          <img
            src={value}
            alt={label}
            className="w-full h-36 object-contain p-2"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/55 opacity-0 group-hover:opacity-100 transition-opacity">
            <label
              className="flex items-center gap-1.5 cursor-pointer rounded-md bg-background/90 border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              data-testid={`label-replace-${testIdPrefix}`}
            >
              <ImageUp className="h-3.5 w-3.5" />
              Substituir
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                data-testid={`input-replace-${testIdPrefix}`}
                onChange={handleFile}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1.5 rounded-md bg-destructive/90 px-2.5 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive transition-colors"
              data-testid={`button-remove-${testIdPrefix}`}
            >
              <X className="h-3.5 w-3.5" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-border/60 bg-muted/20 h-36 hover:border-primary/40 hover:bg-primary/5 transition-all group"
          data-testid={`label-upload-${testIdPrefix}`}
        >
          <div className="rounded-full bg-muted p-2.5 group-hover:bg-primary/10 transition-colors">
            <ImageUp className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Carregar imagem
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            PNG, JPG ou WebP
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            data-testid={`input-${testIdPrefix}`}
            onChange={handleFile}
          />
        </label>
      )}
    </div>
  );
}

// ── AI suggestion sheet ───────────────────────────────────────────────────

interface AiSuggestion {
  id: string;
  originalText: string;
  placeholder: string;
  accepted: boolean | null;
  occurrenceIndex: number;
}

function replaceNthOccurrence(
  str: string,
  search: string,
  replacement: string,
  n: number,
): string {
  let count = 0;
  let pos = 0;
  while (pos < str.length) {
    const found = str.indexOf(search, pos);
    if (found === -1) return str;
    if (count === n) {
      return str.slice(0, found) + replacement + str.slice(found + search.length);
    }
    count++;
    pos = found + search.length;
  }
  return str;
}

interface AiSuggestionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AiSuggestion[];
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
}

function AiSuggestionsSheet({
  open,
  onOpenChange,
  suggestions,
  onAccept,
  onIgnore,
}: AiSuggestionsSheetProps) {
  const pending = suggestions.filter((s) => s.accepted === null);
  const accepted = suggestions.filter((s) => s.accepted === true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-md flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugestões da IA
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Aceite individualmente as substituições que quiser aplicar ao texto.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-4">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma sugestão encontrada para o texto actual.
            </p>
          ) : (
            <div className="space-y-3 pr-2">
              {pending.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold  text-muted-foreground mb-2">
                    Pendentes ({pending.length})
                  </p>
                  {pending.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border p-3 space-y-2 text-sm"
                      data-testid={`suggestion-card-${s.id}`}
                    >
                      <p className="text-muted-foreground text-xs line-clamp-2 italic">
                        "{s.originalText}"
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">→</span>
                        <span className="font-sans text-xs text-primary bg-primary/5 border border-primary/15 rounded px-1.5 py-0.5">
                          {s.placeholder}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => onAccept(s.id)}
                          data-testid={`button-accept-suggestion-${s.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs"
                          onClick={() => onIgnore(s.id)}
                          data-testid={`button-ignore-suggestion-${s.id}`}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {accepted.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold  text-muted-foreground mb-2">
                    Aceites ({accepted.length})
                  </p>
                  {accepted.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border/40 bg-muted/20 p-2.5 flex items-center gap-2 opacity-60"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="font-sans text-xs text-primary">
                        {s.placeholder}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ContractImportWorkspace({
  open,
  onOpenChange,
  onSave,
  template = null,
  onEdit,
}: ContractImportWorkspaceProps) {
  const isEditMode = !!template;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("template");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [footerImage, setFooterImage] = useState<string | null>(null);

  const { variables: registryVars, addVariable } = useVariableRegistry();
  const { categories: registryCategories } = useCategoryRegistry();
  const dynamicCategories = registryCategories.map((c) => ({ value: c.value, label: c.label }));

  // Populate form when template changes (edit mode)
  useEffect(() => {
    if (!template) return;
    setNome(template.nome ?? "");
    setCategoria(template.tipo_servico || (template as Record<string, unknown>)["type"] as string || "");
    setText(template.conteudo ?? "");
    setSearch("");
    setAiSuggestions([]);
    setAiSheetOpen(false);
    setHeaderImage(template.header_image ?? null);
    setFooterImage(template.footer_image ?? null);
    setActiveTab("template");
  }, [template]);

  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapseKey, setCollapseKey] = useState(0);

  // ── Insert at cursor ────────────────────────────────────────────────────

  const insertAtCursor = useCallback(
    (snippet: string) => {
      const el = textareaRef.current;
      if (!el) {
        setText((prev) => prev + snippet);
        toast.success(`${snippet} inserido`);
        return;
      }
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = text.slice(0, start) + snippet + text.slice(end);
      setText(next);
      toast.success(`${snippet} inserido`);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [text],
  );

  // ── AI suggestions ──────────────────────────────────────────────────────

  async function handleAiSuggest() {
    if (!text.trim()) {
      toast.warning("Escreva ou cole texto no editor primeiro");
      return;
    }
    setAiLoading(true);
    try {
      const result = await parseContractText(text);
      const occurrenceCounters = new Map<string, number>();
      const suggestions: AiSuggestion[] = result.variables.map(
        (v: SemanticVariable) => {
          const seen = occurrenceCounters.get(v.originalText) ?? 0;
          occurrenceCounters.set(v.originalText, seen + 1);
          return {
            id: v.id,
            originalText: v.originalText,
            placeholder: v.placeholder,
            accepted: null,
            occurrenceIndex: seen,
          };
        },
      );
      setAiSuggestions(suggestions);
      setAiSheetOpen(true);
      if (suggestions.length === 0) {
        toast.info("A IA não encontrou mais sugestões de variáveis");
      }
    } catch {
      toast.error("Erro ao analisar o texto. Verifique a ligação à API.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleAcceptSuggestion(id: string) {
    const suggestion = aiSuggestions.find((s) => s.id === id);
    if (!suggestion) return;
    const next = replaceNthOccurrence(
      text,
      suggestion.originalText,
      suggestion.placeholder,
      suggestion.occurrenceIndex,
    );
    if (next === text) {
      toast.warning(
        "Texto original não encontrado — pode já ter sido substituído",
      );
    } else {
      setText(next);
    }
    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: true } : s)),
    );
  }

  function handleIgnoreSuggestion(id: string) {
    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: false } : s)),
    );
  }

  // ── Save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Dê um nome ao template antes de guardar");
      return;
    }
    if (!text.trim()) {
      toast.error("O editor está vazio. Adicione o conteúdo do template.");
      return;
    }
    setIsSaving(true);
    try {
      const placeholders = [
        ...new Set(
          Array.from(text.matchAll(PLACEHOLDER_REGEX)).map(
            (m) => `{{${m[1].toUpperCase()}}}`,
          ),
        ),
      ];
      const manifest = {
        variables: placeholders,
        generatedAt: new Date().toISOString(),
      };
      if (isEditMode && template && onEdit) {
        await Promise.resolve(
          onEdit(template.id, {
            nome: nome.trim(),
            tipo_servico: categoria,
            conteudo: text,
            ativo: template.ativo ?? true,
            descricao: template.descricao ?? `${placeholders.length} variáveis`,
            variables_manifest: JSON.stringify(manifest),
            header_image: headerImage ?? null,
            footer_image: footerImage ?? null,
            expectedUpdatedAt: getExpectedUpdatedAt(template),
          }),
        );
      } else {
        await Promise.resolve(
          onSave({
            nome: nome.trim(),
            tipo_servico: categoria,
            conteudo: text,
            ativo: true,
            descricao: `${placeholders.length} variáveis`,
            variables_manifest: JSON.stringify(manifest),
            header_image: headerImage ?? null,
            footer_image: footerImage ?? null,
          }),
        );
      }
      handleClose();
    } finally {
      setIsSaving(false);
    }
  }

  // ── Close / reset ───────────────────────────────────────────────────────

  function handleClose() {
    setNome("");
    setCategoria("semantico");
    setText("");
    setSearch("");
    setAiSuggestions([]);
    setAiSheetOpen(false);
    setHeaderImage(null);
    setFooterImage(null);
    setActiveTab("template");
    onOpenChange(false);
  }

  // ── Filtered + grouped registry vars ───────────────────────────────────

  const filteredRegistryVars = registryVars.filter(
    (v) =>
      !search || v.placeholder.toLowerCase().includes(search.toLowerCase()),
  );

  const groupedVars = Array.from(
    filteredRegistryVars.reduce((map, v) => {
      const key = v.group || "Outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
      return map;
    }, new Map<string, typeof filteredRegistryVars>()),
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent
          className="max-w-[1100px] w-[95vw] h-[88vh] p-0 gap-0 flex flex-col overflow-hidden"
          data-testid="dialog-contract-workspace"
        >
          <DialogTitle className="sr-only">
            {isEditMode ? "Editar Template de Contrato" : "Novo Template de Contrato"}
          </DialogTitle>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* ── Modal header (fixed) ── */}
            <div className="shrink-0 border-b bg-card">
              <div className="px-6 pt-5 pb-3 pr-14">
                <h2 className="text-lg font-semibold tracking-tight">
                  {isEditMode ? "Editar Template de Contrato" : "Novo Template de Contrato"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEditMode
                    ? "Edite o conteúdo e as configurações do template."
                    : "Crie templates reutilizáveis para geração automática de contratos."}
                </p>
              </div>
              <div className="px-6 pb-3">
                <TabsList className="h-auto bg-muted/60 p-1 gap-1 rounded-full inline-flex">
                  {(
                    [
                      { value: "template", label: "Template" },
                      { value: "variaveis", label: "Variáveis" },
                      { value: "categorias", label: "Categorias" },
                      { value: "preview", label: "Preview" },
                    ] as const
                  ).map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground"
                      data-testid={`tab-${tab.value}`}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {/* ── Tab: Template ── */}
            <TabsContent
              value="template"
              className="flex-1 flex overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              {/* ── Left column: form sections + editor ── */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Informações Básicas + Identidade Visual — lado a lado */}
                <div className="shrink-0 border-b flex">
                  {/* Informações Básicas */}
                  <div className="flex-1 px-6 py-4">
                    <p className="text-[11px] font-semibold text-muted-foreground  tracking-wider mb-3">
                      Informações Básicas
                    </p>
                    <div className="flex flex-col gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ws-nome" className="text-xs">
                          Nome do Template
                        </Label>
                        <Input
                          id="ws-nome"
                          placeholder="Ex: Contrato de Gravação — Exclusivo"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          className="h-9"
                          data-testid="input-template-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ws-categoria" className="text-xs">
                          Categoria do Template
                        </Label>
                        <Select value={categoria} onValueChange={setCategoria}>
                          <SelectTrigger
                            id="ws-categoria"
                            className="h-9"
                            data-testid="select-template-category"
                          >
                            <SelectValue placeholder="Selecionar categoria…" />
                          </SelectTrigger>
                          <SelectContent>
                            {dynamicCategories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Divider vertical */}
                  <div className="border-l self-stretch" />

                  {/* Identidade Visual */}
                  <div className="flex-1 px-6 py-4">
                    <p className="text-[11px] font-semibold text-muted-foreground  tracking-wider mb-3">
                      Identidade Visual do Documento
                    </p>
                    <div className="flex gap-4">
                      <ImageUploadZone
                        label="Imagem de Cabeçalho"
                        value={headerImage}
                        onChange={setHeaderImage}
                        testIdPrefix="header-image"
                      />
                      <ImageUploadZone
                        label="Imagem de Rodapé"
                        value={footerImage}
                        onChange={setFooterImage}
                        testIdPrefix="footer-image"
                      />
                    </div>
                  </div>
                </div>

                {/* Editor */}
                <div className="flex-1 flex flex-col overflow-hidden p-4 gap-2.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-[11px] font-semibold text-muted-foreground  tracking-wider flex-1">
                      Conteúdo do Contrato
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAiSuggest}
                      disabled={aiLoading}
                      className="h-7 text-xs"
                      data-testid="button-ai-suggest"
                    >
                      {aiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Analisar com IA
                    </Button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      "Escreva o conteúdo do contrato…\n\n" +
                      "Use {{GRUPO.CAMPO}} para inserir variáveis dinâmicas,\n" +
                      "ou clique no ícone [+] no painel de variáveis à direita."
                    }
                    className="flex-1 w-full resize-none rounded-md border bg-background/60 px-4 py-3.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground/40"
                    data-testid="textarea-contract-editor"
                  />
                </div>
              </div>

              {/* ── Right column: Variable panel (full modal height) ── */}
              <div className="w-72 shrink-0 flex flex-col overflow-hidden border-l bg-background/40">
                <div className="px-3 pt-3 pb-2 shrink-0 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-muted-foreground  tracking-wider">
                      Variáveis do Registo
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !allCollapsed;
                        setAllCollapsed(next);
                        setCollapseKey((k) => k + 1);
                      }}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-collapse-all-vars"
                    >
                      <ChevronsUpDown className="h-3 w-3" />
                      {allCollapsed ? "Expandir" : "Colapsar"}
                    </button>
                  </div>
                  <Input
                    placeholder="Pesquisar variáveis…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-7 text-xs"
                    data-testid="input-search-vars"
                  />
                </div>

                <ScrollArea className="flex-1 px-3 py-2">
                  {filteredRegistryVars.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 italic px-1 py-4 text-center">
                      {search
                        ? "Nenhuma variável encontrada"
                        : "Aceda à aba Variáveis para criar placeholders."}
                    </p>
                  ) : (
                    <div className="pt-1">
                      {groupedVars.map(([groupLabel, groupVarsList]) => (
                        <RegistryVarGroup
                          key={`${groupLabel}-${collapseKey}`}
                          label={groupLabel}
                          vars={groupVarsList}
                          initialOpen={!allCollapsed}
                          onInsert={(placeholder) => {
                            insertAtCursor(placeholder);
                            setActiveTab("template");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>

              </div>
            </TabsContent>

            {/* ── Tab: Variáveis ── */}
            <TabsContent
              value="variaveis"
              className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              <VariableRegistry asModal onClose={() => {}} />
            </TabsContent>

            {/* ── Tab: Categorias ── */}
            <TabsContent
              value="categorias"
              className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              <CategoryRegistry asModal onClose={() => {}} />
            </TabsContent>

            {/* ── Tab: Preview ── */}
            <TabsContent
              value="preview"
              className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden"
            >
              <A4Preview
                headerImage={headerImage}
                content={text}
                footerImage={footerImage}
              />
            </TabsContent>

            {/* ── Footer (fixed) ── */}
            <div className="shrink-0 border-t px-6 py-3 flex items-center justify-between bg-card">
              <span className="text-xs text-muted-foreground">
                Alterações salvas automaticamente
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  data-testid="button-workspace-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={aiLoading || isSaving}
                  data-testid="button-save-template"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {isSaving ? "A guardar…" : "Salvar Template"}
                </Button>
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* AI suggestions side sheet — outside Dialog to avoid stacking context */}
      <AiSuggestionsSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        suggestions={aiSuggestions}
        onAccept={handleAcceptSuggestion}
        onIgnore={handleIgnoreSuggestion}
      />
    </>
  );
}


