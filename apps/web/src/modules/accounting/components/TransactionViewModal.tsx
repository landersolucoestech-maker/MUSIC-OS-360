import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/shared/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { formatCalendarDateLabel, formatCurrency, formatDateTime, getCurrencyToneClass } from "@/shared/lib/format-utils";
import { accountingService } from "@/modules/accounting/services/accounting.service";
import {
  AlertCircle,
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  History,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Timer,
  TrendingDown,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { StoredFileLink } from "@/shared/components/StoredFileLink";
import { storedFileDisplayName } from "@/shared/lib/stored-file";
import { paymentMethods, paymentTypes, transactionCategoryLabel } from "@/modules/accounting/constants/transaction-constants";
import { TRANSACTION_COUNTERPARTY_TYPE_LABELS_PT_BR, TRANSACTION_INSTALLMENT_INTERVAL_LABELS_PT_BR } from "@music-os-360/types";
import type { TransactionType } from "@/modules/accounting/types/accounting.types";

type Detail = Record<string, unknown>;

interface TransactionViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId?: string;
}

type TypeMeta = {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  amountClass: string;
  sign: string;
};

/** Keyed by the canonical `type` values (CZ-041); labels are PT-BR display text. */
const transactionTypeMeta: Record<TransactionType, TypeMeta> = {
  revenue: {
    label: "Receita",
    icon: TrendingUp,
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amountClass: "text-emerald-600",
    sign: "+",
  },
  expense: {
    label: "Despesa",
    icon: TrendingDown,
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    amountClass: "text-rose-600",
    sign: "-",
  },
  tax: {
    label: "Imposto",
    icon: ReceiptText,
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    amountClass: "text-amber-600",
    sign: "-",
  },
  investment: {
    label: "Investimento",
    icon: Briefcase,
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    amountClass: "text-sky-600",
    sign: "-",
  },
  transfer: {
    label: "Transferência",
    icon: RefreshCcw,
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    amountClass: "text-slate-800",
    sign: "",
  },
};

/** Shown while no details are loaded / for a type outside the contract (never silently relabeled). */
const unknownTypeMeta: TypeMeta = {
  label: "Não classificada",
  icon: Banknote,
  badgeClass: "border-zinc-200 bg-zinc-50 text-zinc-700",
  amountClass: "text-zinc-800",
  sign: "",
};

function typeMetaOf(type: string): TypeMeta {
  return Object.prototype.hasOwnProperty.call(transactionTypeMeta, type)
    ? transactionTypeMeta[type as TransactionType]
    : unknownTypeMeta;
}

// PT-BR keys (pendente/aprovado/pago/atrasado/parcial/cancelado/cancelada/
// estornado/processando) are kept as display-only fallbacks for any
// transaction row still holding a legacy status string — TransactionStatus
// (packages/types/src/enums.ts) itself is English-only going forward
// (pending/paid/confirmed/completed/scheduled/cancelled).
const statusMeta: Record<string, { label: string; icon: LucideIcon; badgeClass: string; dotClass: string }> = {
  pending: { label: "Pendente", icon: Clock, badgeClass: "border-amber-200 bg-amber-50 text-amber-700", dotClass: "bg-amber-500" },
  scheduled: { label: "Agendado", icon: Clock, badgeClass: "border-amber-200 bg-amber-50 text-amber-700", dotClass: "bg-amber-500" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, badgeClass: "border-blue-200 bg-blue-50 text-blue-700", dotClass: "bg-blue-500" },
  completed: { label: "Concluído", icon: CheckCircle2, badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClass: "bg-emerald-500" },
  paid: { label: "Pago", icon: CheckCircle2, badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelado", icon: XCircle, badgeClass: "border-zinc-200 bg-zinc-50 text-muted-foreground", dotClass: "bg-zinc-500" },
  pendente: { label: "Pendente", icon: Clock, badgeClass: "border-amber-200 bg-amber-50 text-amber-700", dotClass: "bg-amber-500" },
  aprovado: { label: "Aprovado", icon: CheckCircle2, badgeClass: "border-blue-200 bg-blue-50 text-blue-700", dotClass: "bg-blue-500" },
  pago: { label: "Pago", icon: CheckCircle2, badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClass: "bg-emerald-500" },
  atrasado: { label: "Atrasado", icon: AlertCircle, badgeClass: "border-rose-200 bg-rose-50 text-rose-700", dotClass: "bg-rose-500" },
  parcial: { label: "Parcial", icon: Timer, badgeClass: "border-orange-200 bg-orange-50 text-orange-700", dotClass: "bg-orange-500" },
  cancelado: { label: "Cancelado", icon: XCircle, badgeClass: "border-zinc-200 bg-zinc-50 text-muted-foreground", dotClass: "bg-zinc-500" },
  cancelada: { label: "Cancelado", icon: XCircle, badgeClass: "border-zinc-200 bg-zinc-50 text-muted-foreground", dotClass: "bg-zinc-500" },
  estornado: { label: "Estornado", icon: RotateCcw, badgeClass: "border-primary/30 bg-primary-soft text-primary", dotClass: "bg-primary" },
  processando: { label: "Processando", icon: Loader2, badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700", dotClass: "bg-cyan-500" },
};

/** PT-BR labels of the canonical payment_method / payment_type values — single source: transaction-constants. */
const paymentMethodLabels: Record<string, string> = Object.fromEntries(paymentMethods.map((o) => [o.value, o.label]));
const paymentTypeLabels: Record<string, string> = Object.fromEntries(paymentTypes.map((o) => [o.value, o.label]));

function valueOf(t: Detail | null | undefined, keys: string[]): unknown {
  for (const key of keys) {
    const value = t?.[key];
    if (hasValue(value)) return value;
  }
  return undefined;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Detail).length > 0;
  return true;
}

function textValue(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "object") return undefined;
  const record = value as Detail;
  return textValue(record.stage_name ?? record.name ?? record.title ?? record.description);
}

function displayName(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  if (typeof value === "object") {
    const record = value as Detail;
    return textValue(record.stage_name ?? record.name ?? record.title ?? record.description);
  }
  const raw = textValue(value);
  if (!raw || /^[a-z]+-\d+$/i.test(raw) || /^[a-f0-9-]{8,}$/i.test(raw)) return undefined;
  return raw;
}

function numValue(value: unknown): number | undefined {
  if (!hasValue(value)) return undefined;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}


function moneyValue(value: unknown): string | undefined {
  const parsed = numValue(value);
  return parsed === undefined ? undefined : formatCurrency(parsed);
}

/**
 * Transaction date, first installment, due date and paid date are calendar
 * days (not instants): formatted from the stored day, never shifted by the
 * browser/regional timezone. A present but invalid value reads "Data inválida".
 */
function calendarDateValue(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  return formatCalendarDateLabel(value);
}

/** Form wording for the counterparty field (TransactionTypeSection): "Receber de" / "Pagar para". */
function counterpartyLabel(type: string): string {
  if (type === "revenue") return "Receber de";
  if (Object.prototype.hasOwnProperty.call(transactionTypeMeta, type)) return "Pagar para";
  return "Tipo de contraparte";
}

function dateTimeValue(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  return formatDateTime(value as string | Date);
}

function paymentMethod(value: unknown): string | undefined {
  const raw = textValue(value);
  if (!raw) return undefined;
  return paymentMethodLabels[raw] ?? "Outro meio de pagamento";
}

function paymentTypeLabel(value: unknown): string | undefined {
  const raw = textValue(value);
  if (!raw) return undefined;
  return paymentTypeLabels[raw] ?? "Outro tipo de pagamento";
}

/** Wire reference month "YYYY-MM" → PT-BR "MM/AAAA". */
function referenceMonthValue(value: unknown): string | undefined {
  const raw = textValue(value);
  if (!raw) return undefined;
  const iso = /^(\d{4})-(\d{2})$/.exec(raw);
  return iso ? `${iso[2]}/${iso[1]}` : raw;
}

function TypeBadge({ type }: { type: string }) {
  const meta = typeMetaOf(type);
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-7 gap-1.5 rounded-full px-3 font-medium", meta.badgeClass)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

/** Status outside the known values: never relabeled as "Pendente". */
const unknownStatusMeta = { label: "Status não reconhecido", icon: AlertCircle, badgeClass: "border-zinc-200 bg-zinc-50 text-zinc-700", dotClass: "bg-zinc-500" };

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? unknownStatusMeta;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-7 gap-1.5 rounded-full px-3 font-medium", meta.badgeClass)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      <Icon className={cn("h-3.5 w-3.5", status === "processando" && "animate-spin")} />
      {meta.label}
    </Badge>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  if (!hasValue(children)) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/75" />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (!hasValue(value)) return null;
  return (
    <div className="flex min-w-0 items-center justify-between gap-6 border-b border-border/40 py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[64%] truncate text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ModalSkeleton() {
  return (
    <div className="space-y-8 p-6">
      <div className="space-y-5 rounded-xl border bg-muted/20 p-6">
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
      </div>
    </div>
  );
}

function AdvancedLine({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  if (!hasValue(value)) return null;
  return (
    <div className="flex min-w-0 items-start justify-between gap-6 border-b border-border/40 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("max-w-[65%] break-words text-right text-sm font-medium text-foreground", mono && "font-sans text-xs")}>
        {value}
      </span>
    </div>
  );
}

export function TransactionViewModal({ open, onOpenChange, transactionId }: TransactionViewModalProps) {
  const [details, setDetails] = useState<Detail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!open || !transactionId) {
      setDetails(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    accountingService.getTransaction(transactionId)
      .then((data) => {
        if (!mounted) return;
        setDetails(data ? { ...data } : null);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Não foi possível carregar os detalhes desta transação.");
        setDetails(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [open, transactionId]);

  const t = details;
  const type = String(valueOf(t, ["type"]) ?? "");
  const status = String(valueOf(t, ["status"]) ?? "pending").toLowerCase();
  const typeMeta = typeMetaOf(type);
  const amount = numValue(valueOf(t, ["amount", "grossAmount"])) ?? 0;
  const signedAmount = typeMeta.sign === "-" ? -Math.abs(amount) : typeMeta.sign === "+" ? Math.abs(amount) : amount;
  const description = textValue(valueOf(t, ["description"])) ?? "Transação financeira";
  const transactionDate = valueOf(t, ["transactionDate"]);
  const method = paymentMethod(valueOf(t, ["paymentMethod"]));
  const paymentType = paymentTypeLabel(valueOf(t, ["paymentType"]));
  const categorySlug = textValue(valueOf(t, ["category"]));
  const category = categorySlug ? transactionCategoryLabel(categorySlug) : undefined;
  const subcategorySlug = textValue(valueOf(t, ["subcategory"]));
  const subcategory = subcategorySlug ? transactionCategoryLabel(subcategorySlug) : undefined;
  const costCenter = textValue(valueOf(t, ["costCenter"]));
  const counterpartyTypeRaw = textValue(valueOf(t, ["counterpartyType"]));
  const counterpartyType = counterpartyTypeRaw ? (TRANSACTION_COUNTERPARTY_TYPE_LABELS_PT_BR[counterpartyTypeRaw] ?? "Tipo não reconhecido") : undefined;
  const sourceAccount = textValue(valueOf(t, ["sourceBankAccount"]));
  const destinationAccount = textValue(valueOf(t, ["destinationBankAccount"]));
  const account = sourceAccount ?? destinationAccount;
  const taxAuthority = textValue(valueOf(t, ["taxAuthority"]));
  const investmentItem = textValue(valueOf(t, ["investmentItem"]));
  const travelReason = textValue(valueOf(t, ["travelReason"]));
  const advertisingName = textValue(valueOf(t, ["advertisingName"]));
  const intervalRaw = textValue(valueOf(t, ["installmentInterval"]));
  const installmentInterval = intervalRaw ? (TRANSACTION_INSTALLMENT_INTERVAL_LABELS_PT_BR[intervalRaw] ?? "Não informado") : undefined;
  const firstInstallmentDate = calendarDateValue(valueOf(t, ["firstInstallmentDate"]));
  const observations = textValue(valueOf(t, ["note"]));
  const installments = numValue(valueOf(t, ["installments"]));
  const installmentCurrent = numValue(valueOf(t, ["installmentCurrent"]));
  const installmentSummary = installments && installments > 1
    ? `${installments}x${installmentCurrent ? `, parcela ${installmentCurrent}/${installments}` : ""}`
    : undefined;
  const currency = textValue(valueOf(t, ["currency"])) ?? "BRL";
  const competence = referenceMonthValue(valueOf(t, ["competence"]));
  const dueDate = calendarDateValue(valueOf(t, ["dueDate"]));
  const paidDate = calendarDateValue(valueOf(t, ["paidAt"]));

  const relationships = useMemo(() => ([
    ["Artista", displayName(valueOf(t, ["artist"]))],
    ["Projeto", displayName(valueOf(t, ["project"]))],
    ["Campanha", displayName(valueOf(t, ["campaign"]))],
    ["Contrato", displayName(valueOf(t, ["contract"]))],
    ["Evento", displayName(valueOf(t, ["event"]))],
    ["Fornecedor / Cliente", displayName(valueOf(t, ["supplierOrClient", "supplier"]))],
  ] as const).filter(([, value]) => hasValue(value)), [t]);

  const subtitle = relationships.find(([label]) => label === "Projeto")?.[1]
    ?? relationships.find(([label]) => label === "Evento")?.[1]
    ?? relationships.find(([label]) => label === "Artista")?.[1]
    ?? category;

  const mainDate = calendarDateValue(transactionDate);
  const paymentSummary = [method, paymentType].filter(Boolean).join(" ");
  // Details DTO: attachments[] (built from the attachment_url/attachment_name columns).
  const firstAttachment = (valueOf(t, ["attachments"]) as Detail[] | undefined)?.[0];
  const attachmentsUrl = textValue(firstAttachment?.url);
  const attachmentsName = textValue(firstAttachment?.name);
  const attachmentIsImage = typeof attachmentsUrl === "string" && /\.(png|jpe?g|webp|gif)$/i.test(attachmentsUrl);
  const attachmentIsPdf = typeof attachmentsUrl === "string" && /\.pdf$/i.test(attachmentsUrl);
  // User ids are never shown; only a resolved name (object with name) is.
  const createdBy = displayName(valueOf(t, ["createdBy"]));
  const updatedBy = displayName(valueOf(t, ["updatedBy"]));
  const createdAt = dateTimeValue(valueOf(t, ["created_at"]));
  const updatedAt = dateTimeValue(valueOf(t, ["updated_at"]));

  const advancedItems = [
    ["Valor bruto", moneyValue(valueOf(t, ["grossAmount"]))],
    ["Valor líquido", moneyValue(valueOf(t, ["netAmount"]))],
    ["Descontos", moneyValue(valueOf(t, ["discount"]))],
    ["Taxas", moneyValue(valueOf(t, ["fees"]))],
    ["Juros", moneyValue(valueOf(t, ["interest"]))],
    ["Multa", moneyValue(valueOf(t, ["fine"]))],
    [counterpartyLabel(type), counterpartyType],
    ["Órgão arrecadador", taxAuthority],
    ["Item de investimento", investmentItem],
    ["Motivo da viagem", travelReason],
    ["Nome da publicidade", advertisingName],
    ["Conta de origem", sourceAccount],
    ["Conta de destino", destinationAccount],
    ["Competência", competence],
    ["Vencimento", dueDate],
    ["Data de pagamento", paidDate],
    ["Parcelamento", installmentSummary],
    ["Intervalo das parcelas", installmentInterval],
    ["Primeira parcela", firstInstallmentDate],
  ] as const;
  const hasAdvancedItems = advancedItems.some(([, value]) => hasValue(value));

  if (!transactionId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[920px] overflow-y-auto border-border/70 bg-card p-0" data-testid="modal-transacao-view">
        <DialogHeader className="px-6 py-5">
          <DialogTitle className="text-lg font-semibold text-foreground">Detalhes da Transação</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <ModalSkeleton />
        ) : error ? (
          <div className="p-6">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {error}
            </div>
          </div>
        ) : t ? (
          <div className="grid gap-6 lg:grid-cols-[1.35fr_360px]">
            <div className="space-y-6 p-6">
              <div className="rounded-[28px] border border-border/70 bg-muted/50 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <TypeBadge type={type} />
                  <StatusBadge status={status} />
                </div>
                <div className="mt-5 space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-transacao-descricao">
                    {description}
                  </h2>
                  {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Data" value={mainDate} />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Informações financeiras" icon={Banknote}>
                  <div className="grid gap-4 rounded-3xl border border-border/70 bg-card p-5">
                    <DetailRow label="Categoria" value={category} />
                    <DetailRow label="Subcategoria" value={subcategory} />
                    <DetailRow label="Centro de custo" value={costCenter} />
                    <DetailRow label="Conta" value={account} />
                    <DetailRow label="Moeda" value={currency} />
                    <DetailRow label="Parcelamento" value={installmentSummary} />
                  </div>
                </Section>

                <Section title="Pagamento" icon={CreditCard}>
                  <div className="grid gap-4 rounded-3xl border border-border/70 bg-card p-5">
                    <DetailRow label="Método" value={method} />
                    <DetailRow label="Tipo" value={paymentType} />
                    <DetailRow label="Intervalo das parcelas" value={installmentInterval} />
                    <DetailRow label="Primeira parcela" value={firstInstallmentDate} />
                    <DetailRow label="Competência" value={competence} />
                    <DetailRow label="Vencimento" value={dueDate} />
                    <DetailRow label="Pago em" value={paidDate} />
                  </div>
                </Section>
              </div>

              {relationships.length > 0 && (
                <Section title="Relacionamentos" icon={Landmark}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relationships.map(([label, value]) => (
                      <div key={label} className="rounded-3xl border border-border/70 bg-background/40 p-4">
                        <p className="text-[11px]  tracking-[0.15em] text-muted-foreground">{label}</p>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {observations && (
                <Section title="Observações" icon={FileText}>
                  <div className="rounded-3xl border border-border/70 bg-muted/15 p-5 text-sm leading-7 text-foreground">
                    {observations}
                  </div>
                </Section>
              )}

              {attachmentsUrl && (
                <Section title="Anexos" icon={FileText}>
                  <div className="rounded-3xl border border-border/70 bg-card p-5">
                    <p className="text-sm text-muted-foreground">Arquivo</p>
                    <StoredFileLink url={attachmentsUrl} className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm font-medium text-primary transition hover:bg-muted/40">
                      <FileText className="h-4 w-4" />
                      {attachmentsName ?? storedFileDisplayName(attachmentsUrl)}
                    </StoredFileLink>
                    {attachmentIsImage && (
                      <img src={attachmentsUrl} alt={attachmentsName ?? "Anexo"} className="mt-4 max-h-44 w-full rounded-2xl object-contain" />
                    )}
                    {attachmentIsPdf && (
                      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">PDF disponível para download.</div>
                    )}
                  </div>
                </Section>
              )}

              {hasAdvancedItems && (
                <Section title="Informações adicionais" icon={FileText}>
                  <div className="rounded-3xl border border-border/70 bg-card p-5">
                    {advancedItems.filter(([, value]) => hasValue(value)).map(([label, value]) => (
                      <AdvancedLine key={label} label={label} value={value} />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Auditoria" icon={History}>
                <div className="rounded-3xl border border-border/70 bg-card p-5">
                  <AdvancedLine label="Criado por" value={createdBy} />
                  <AdvancedLine label="Atualizado por" value={updatedBy} />
                  <AdvancedLine label="Criado em" value={createdAt} mono />
                  <AdvancedLine label="Atualizado em" value={updatedAt} mono />
                </div>
              </Section>
            </div>

            <aside className="sticky top-0 space-y-6 border-l border-border/70 bg-muted/10 p-6">
              <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-5">
                <p className="text-xs  tracking-[0.15em] text-muted-foreground">Resumo</p>
                <p className={cn("font-sans text-4xl font-semibold tracking-tight", getCurrencyToneClass(signedAmount))} data-testid="text-transacao-valor">
                  {signedAmount > 0 ? "+" : ""}{formatCurrency(signedAmount)}
                </p>
                <div className="space-y-3">
                  <DetailRow label="Status" value={statusMeta[status]?.label ?? "Status não reconhecido"} />
                  <DetailRow label="Data" value={mainDate} />
                  <DetailRow label="Método" value={method} />
                  <DetailRow label="Tipo" value={paymentType} />
                  <DetailRow label="Conta" value={account} />
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-border/70 bg-card p-5">
                <p className="text-xs  tracking-[0.15em] text-muted-foreground">Classificação</p>
                <DetailRow label="Categoria" value={category} />
                <DetailRow label="Centro de custo" value={costCenter} />
                <DetailRow label="Parcelamento" value={installmentSummary} />
                <DetailRow label="Competência" value={competence} />
              </div>
            </aside>
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Nenhum detalhe de transação disponível.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}


