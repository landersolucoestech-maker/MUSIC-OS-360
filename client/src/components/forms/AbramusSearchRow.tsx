import { CheckCircle2, Loader2, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  useAbramusStatus,
  useAbramusSearch,
  useAbramusImport,
  useAbramusLocalLookup,
  type AbramusKind,
  type AbramusSearchResult,
} from "@/hooks/useAbramus";

interface AbramusSearchRowProps {
  kind: AbramusKind;
  query: string;
  /** Limit of results displayed in the section. Default: 20. */
  limit?: number;
  onImported?: (record: AbramusSearchResult & { localId: string }) => void;
}

const SECTION_WRAPPER =
  "mt-2 border-t border-border pt-2";

export function AbramusSearchRow({
  kind,
  query,
  limit = 20,
  onImported,
}: AbramusSearchRowProps) {
  const { data: status, isLoading: isStatusLoading } = useAbramusStatus();
  const trimmed = query.trim();
  const enabledSearch = !!status?.connected && trimmed.length >= 2;
  const { data, isFetching, error } = useAbramusSearch(
    kind,
    enabledSearch ? trimmed : ""
  );
  const importMutation = useAbramusImport(kind);

  const allResults = data?.results ?? [];
  const results = allResults.slice(0, limit);
  const externalIds = results.map((r) => r.external_id);
  // NOTE: hook must be called unconditionally — keep before any early returns.
  const { data: localLookup } = useAbramusLocalLookup(kind, externalIds);

  const heading = (
    <p
      className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1"
      role="presentation"
      data-testid="abramus-section-heading"
    >
      Banco ABRAMUS
    </p>
  );

  if (isStatusLoading) {
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <div className="flex items-center gap-3 p-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando integração ABRAMUS…
        </div>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <div
          className="px-2 py-2 text-xs text-muted-foreground"
          data-testid="abramus-not-configured"
        >
          Integração ABRAMUS não configurada.{" "}
          <Link
            to="/configuracoes"
            className="text-primary underline-offset-2 hover:underline"
            data-testid="link-abramus-configurar"
          >
            Configurar agora
          </Link>
        </div>
      </div>
    );
  }

  if (trimmed.length < 2) {
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <p
          className="text-xs text-muted-foreground px-2 py-2"
          data-testid="abramus-hint"
        >
          Digite ao menos 2 caracteres para buscar no Banco ABRAMUS.
        </p>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <div
          className="flex items-center gap-3 p-2 text-sm text-muted-foreground"
          data-testid="abramus-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando ABRAMUS…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <p
          className="text-xs text-destructive px-2 py-2"
          data-testid="abramus-error"
        >
          Falha ao consultar ABRAMUS.
        </p>
      </div>
    );
  }

  const apiError = data?.error;
  if (apiError) {
    const isNotConfigured = apiError === "not_configured";
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <div
          className="text-xs px-2 py-2"
          data-testid={isNotConfigured ? "abramus-not-configured" : "abramus-api-error"}
        >
          {isNotConfigured ? (
            <span className="text-muted-foreground">
              Integração ABRAMUS não configurada.{" "}
              <Link
                to="/configuracoes"
                className="text-primary underline-offset-2 hover:underline"
                data-testid="link-abramus-configurar"
              >
                Configurar agora
              </Link>
            </span>
          ) : (
            <span className="text-destructive">
              {apiError === "upstream_error"
                ? "Falha ao consultar ABRAMUS. Tente novamente em instantes."
                : "Falha ao consultar ABRAMUS."}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Total disponível no banco ABRAMUS (quando a edge function consegue
  // estimar). Para evitar falsos negativos quando o upstream expõe um
  // `total` ambíguo (ex.: contagem da página atual), o sinal `has_more`
  // explícito do servidor sempre prevalece.
  const reportedTotal = typeof data?.total === "number" ? data.total : undefined;
  const hasMore =
    data?.has_more === true ||
    (reportedTotal !== undefined && reportedTotal > results.length);
  const displayedTotal =
    reportedTotal !== undefined && reportedTotal > results.length
      ? reportedTotal
      : hasMore
        ? `${results.length}+`
        : results.length;

  if (results.length === 0) {
    return (
      <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
        {heading}
        <p
          className="text-xs text-muted-foreground px-2 py-2"
          data-testid="abramus-empty"
        >
          Nenhum resultado no banco ABRAMUS.
        </p>
      </div>
    );
  }

  const alreadyImportedToast =
    kind === "obras"
      ? "Obra já cadastrada — vinculada"
      : "Fonograma já cadastrado — vinculado";

  const selectItem = async (item: AbramusSearchResult) => {
    const existing = localLookup?.get(item.external_id);
    if (existing) {
      // Já existe localmente — não chama import_obra/import_fonograma; apenas
      // vincula a linha local existente para que o caller atualize seu estado.
      onImported?.({ ...item, localId: existing.id });
      toast.success(alreadyImportedToast);
      return;
    }
    if (importMutation.isPending) return;
    try {
      const result = await importMutation.mutateAsync({
        external_id: item.external_id,
        record: item,
      });
      const local = result.record as { id?: string };
      onImported?.({ ...item, localId: local?.id ?? "" });
    } catch {
      /* feedback já tratado na mutation */
    }
  };

  return (
    <div className={SECTION_WRAPPER} data-testid="abramus-search-section">
      {heading}
      <div className="space-y-1" data-testid="abramus-results-list">
        {results.map((item) => {
          const subtitle = [
            item.artista_nome,
            kind === "obras" ? item.iswc : item.isrc,
            item.genero,
          ]
            .filter(Boolean)
            .join(" • ");
          const existing = localLookup?.get(item.external_id);
          const isAlreadyImported = !!existing;
          return (
            <div
              key={item.external_id}
              role="option"
              tabIndex={0}
              aria-selected={false}
              aria-disabled={importMutation.isPending}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted focus:bg-muted focus:outline-none ${
                importMutation.isPending ? "opacity-60 pointer-events-none" : ""
              }`}
              onClick={() => selectItem(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectItem(item);
                }
              }}
              data-testid={`abramus-result-${item.external_id}`}
            >
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
                <Music className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{item.titulo}</p>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                    data-testid={`badge-abramus-${item.external_id}`}
                  >
                    ABRAMUS
                  </Badge>
                  {isAlreadyImported && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0 gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                      title="Esta obra do ABRAMUS já foi importada anteriormente"
                      data-testid={`badge-already-imported-${item.external_id}`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Já no sistema
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {subtitle || "—"}
                </p>
              </div>
              {importMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      {hasMore && (
        <p
          className="text-xs text-muted-foreground italic px-2 py-1"
          data-testid="abramus-overflow"
        >
          Mostrando {results.length} de {displayedTotal} resultados — refine sua busca.
        </p>
      )}
    </div>
  );
}
