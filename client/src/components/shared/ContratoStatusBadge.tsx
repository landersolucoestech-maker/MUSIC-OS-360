import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";

export type ContratoSituacao = "ativo" | "vencendo" | "sem_contrato";

type ContratoLike = {
  status?: string | null;
  data_fim?: string | null;
};

const ATIVO_STATUSES = new Set(["ativo", "assinado"]);

export function getContratoSituacao(contratos: ContratoLike[] | undefined | null): ContratoSituacao {
  if (!contratos || contratos.length === 0) return "sem_contrato";

  const hoje = new Date();
  let temAtivo = false;
  let temVencendo = false;

  for (const c of contratos) {
    const status = (c.status || "").toLowerCase();

    if (status === "vencendo") {
      temVencendo = true;
      temAtivo = true;
      continue;
    }

    if (!ATIVO_STATUSES.has(status)) continue;

    temAtivo = true;

    if (c.data_fim) {
      try {
        const dias = differenceInDays(parseISO(c.data_fim), hoje);
        if (dias >= 0 && dias <= 30) temVencendo = true;
      } catch {
        /* ignore parse errors */
      }
    }
  }

  if (temVencendo) return "vencendo";
  if (temAtivo) return "ativo";
  return "sem_contrato";
}

const SITUACAO_CONFIG: Record<ContratoSituacao, { label: string; className: string }> = {
  ativo: {
    label: "Contrato ativo",
    className: "bg-green-600 hover:bg-green-600 text-white",
  },
  vencendo: {
    label: "Contrato vencendo",
    className: "bg-amber-500 hover:bg-amber-500 text-white",
  },
  sem_contrato: {
    label: "Sem contrato ativo",
    className: "bg-muted text-muted-foreground hover:bg-muted",
  },
};

interface ContratoStatusBadgeProps {
  contratos?: ContratoLike[] | null;
  situacao?: ContratoSituacao;
  className?: string;
  "data-testid"?: string;
}

export function ContratoStatusBadge({
  contratos,
  situacao,
  className,
  ...rest
}: ContratoStatusBadgeProps) {
  const resolved = situacao ?? getContratoSituacao(contratos);
  const cfg = SITUACAO_CONFIG[resolved];

  return (
    <Badge
      className={cn(cfg.className, "text-[10px] py-0 px-2", className)}
      data-testid={rest["data-testid"]}
    >
      {cfg.label}
    </Badge>
  );
}
