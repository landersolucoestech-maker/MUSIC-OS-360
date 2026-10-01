import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { FileText, Calendar, Building2, MapPin, Mail, ExternalLink, Pencil, Receipt, CreditCard, Calculator, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatCurrency, formatDate, getCurrencyToneClass } from "@/shared/lib/format-utils";
import { formatCpfCnpj } from "@/shared/lib/br-validators";
import { parseOperationType } from "@/modules/accounting/types/invoice-type";
import { invoicePaymentMethodLabel } from "@/modules/accounting/constants/invoice-payment-methods";
import { openStoredFile } from "@/shared/lib/stored-file";
import { toast } from "sonner";
import { useInvoicePartyName } from "@/modules/accounting/hooks/useInvoicePartyName";

interface InvoiceViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: any;
  onEdit?: () => void;
}

const invoiceTypeLabels: Record<string, string> = {
  nfse: "NFS-e (Serviço)",
  nfe: "NF-e (Produto)",
  nfce: "NFC-e (Consumidor)",
};

const getStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case "paid": return <Badge variant="success">Paga</Badge>;
    case "issued": return <Badge variant="info">Emitida</Badge>;
    case "pending": return <Badge variant="warning">Pendente</Badge>;
    case "cancelled": return <Badge variant="neutral">Cancelada</Badge>;
    default: return <Badge variant="neutral">{status || "—"}</Badge>;
  }
};

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

export function InvoiceViewModal({ open, onOpenChange, invoice, onEdit }: InvoiceViewModalProps) {
  // Hook before the early return (rules of hooks).
  const partyName = useInvoicePartyName(invoice);
  if (!invoice) return null;
  const { type: operationType, cleanedNotes: cleanedNotes } = parseOperationType(invoice.notes);
  const isInflow = operationType === "inflow";
  const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];
  const servicesAmount = numberValue(invoice.service_amount, invoice.legacy_amount, invoice.total_amount) ?? 0;
  const totalWithholdings =
    (invoice.iss_retido ? Number(invoice.iss_amount || 0) : 0) +
    Number(invoice.pis_amount || 0) +
    Number(invoice.cofins_amount || 0) +
    Number(invoice.ir_amount || 0) +
    Number(invoice.csll_amount || 0) +
    Number(invoice.inss_amount || 0);
  const netAmount =
    numberValue(invoice.net_amount, invoice.service_amount, invoice.legacy_amount, invoice.total_amount) ??
    Math.max(servicesAmount - totalWithholdings, 0);
  const signedInvoiceValue = isInflow ? -netAmount : netAmount;
  const signedServicesValue = isInflow ? -servicesAmount : servicesAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="modal-invoice-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nota Fiscal Nº {invoice.invoice_number}/{invoice.serie || "001"}
          </DialogTitle>
          <DialogDescription className="flex gap-2 items-center mt-1">
            <Badge variant={isInflow ? "secondary" : "default"} className="gap-1" data-testid={`badge-type-${operationType}`}>
              {isInflow ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {isInflow ? "Entrada" : "Saída"}
            </Badge>
            <Badge variant="outline">{invoiceTypeLabels[invoice.tipo_nota] || invoice.tipo_nota || "NFS-e"}</Badge>
            {getStatusBadge(invoice.status)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Identification */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />Identificação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Data Emissão" value={formatDate(invoice.issued_at)} />
              <Field label="Vencimento" value={invoice.due_at && formatDate(invoice.due_at)} />
              <Field label="Natureza Operação" value={invoice.natureza_operacao} />
              <Field label="CFOP" value={invoice.cfop} />
              <Field label="Cód. Serviço Municipal" value={invoice.codigo_servico_municipal} />
              <Field label="Cód. Município" value={invoice.codigo_municipio} />
            </CardContent>
          </Card>

          {/* Service taker / supplier */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />{isInflow ? "Fornecedor / Emitente" : "Tomador do Serviço"}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Razão Social / Nome" value={partyName} />
              <Field label="CNPJ / CPF" value={invoice.tomador_cnpj && formatCpfCnpj(invoice.tomador_cnpj)} />
              <Field label="Inscrição Estadual" value={invoice.tomador_inscricao_estadual} />
              <Field label="Inscrição Municipal" value={invoice.tomador_inscricao_municipal} />
              <Field label="E-mail" value={invoice.tomador_email && (
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{invoice.tomador_email}</span>
              )} />
              <Field label="Endereço" value={
                <span className="flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{[invoice.tomador_address, invoice.tomador_city, invoice.tomador_uf, invoice.tomador_cep].filter(Boolean).join(", ")}</span>
                </span>
              } />
            </CardContent>
          </Card>

          {/* Services */}
          {(invoice.service_description || items.length > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Serviços</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {invoice.service_description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap">{invoice.service_description}</p>
                  </div>
                )}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <div className="border border-border rounded-lg overflow-hidden">
                      <ListSectionHeader
                        title="Itens da Nota"
                        count={items.length}
                        description="Acompanhe descrições, códigos, quantidades e valores dos itens fiscais"
                        className="px-3 pt-3"
                      />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-no-sort="true">Descrição</TableHead>
                            <TableHead data-no-sort="true" className="w-20">Cód.</TableHead>
                            <TableHead data-no-sort="true" className="text-right w-16">Qtd</TableHead>
                            <TableHead data-no-sort="true" className="text-right w-28">Vlr Unit.</TableHead>
                            <TableHead data-no-sort="true" className="text-right w-28">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it, i) => {
                            const itemUnitPrice = Number(it.unit_price ?? 0);
                            const itemTotal = Number(it.total_amount ?? 0);
                            return (
                              <TableRow key={i}>
                                <TableCell>{it.description}</TableCell>
                                <TableCell>{it.service_code}</TableCell>
                                <TableCell className="text-right">{it.quantity}</TableCell>
                                <TableCell className={`text-right ${getCurrencyToneClass(isInflow ? -itemUnitPrice : itemUnitPrice)}`}>{formatCurrency(isInflow ? -itemUnitPrice : itemUnitPrice)}</TableCell>
                                <TableCell className={`text-right font-medium ${getCurrencyToneClass(isInflow ? -itemTotal : itemTotal)}`}>{formatCurrency(isInflow ? -itemTotal : itemTotal)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Taxes */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />Tributos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Vlr Serviços" value={<span className={getCurrencyToneClass(signedServicesValue)}>{formatCurrency(signedServicesValue)}</span>} />
                <Field label="Deduções" value={<span className={getCurrencyToneClass(-Number(invoice.deductions_amount || 0))}>{formatCurrency(-Number(invoice.deductions_amount || 0))}</span>} />
                <Field label="Base Cálculo" value={<span className={getCurrencyToneClass(signedServicesValue)}>{formatCurrency(signedServicesValue)}</span>} />
                <Field label="Alíq. ISS" value={`${invoice.aliquota_iss || 0}%`} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Field label={invoice.iss_retido ? "ISS (retido)" : "ISS"} value={<span className={getCurrencyToneClass(-Number(invoice.iss_amount || 0))}>{formatCurrency(-Number(invoice.iss_amount || 0))}</span>} />
                <Field label="PIS" value={<span className={getCurrencyToneClass(-Number(invoice.pis_amount || 0))}>{formatCurrency(-Number(invoice.pis_amount || 0))}</span>} />
                <Field label="COFINS" value={<span className={getCurrencyToneClass(-Number(invoice.cofins_amount || 0))}>{formatCurrency(-Number(invoice.cofins_amount || 0))}</span>} />
                <Field label="IRRF" value={<span className={getCurrencyToneClass(-Number(invoice.ir_amount || 0))}>{formatCurrency(-Number(invoice.ir_amount || 0))}</span>} />
                <Field label="CSLL" value={<span className={getCurrencyToneClass(-Number(invoice.csll_amount || 0))}>{formatCurrency(-Number(invoice.csll_amount || 0))}</span>} />
                <Field label="INSS" value={<span className={getCurrencyToneClass(-Number(invoice.inss_amount || 0))}>{formatCurrency(-Number(invoice.inss_amount || 0))}</span>} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Total Retenções</p>
                  <p className="text-sm font-semibold text-destructive">{formatCurrency(-totalWithholdings)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{isInflow ? "Valor Líquido a Pagar" : "Valor Líquido a Receber"}</p>
                  <p className={`text-2xl font-bold ${getCurrencyToneClass(signedInvoiceValue)}`} data-testid="text-invoice-net-amount">{formatCurrency(signedInvoiceValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Pagamento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Forma Pagamento" value={invoicePaymentMethodLabel(invoice.payment_method)} />
              <Field label="Condição" value={invoice.payment_terms} />
              <Field label="Vencimento" value={invoice.due_at && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{formatDate(invoice.due_at)}</span>
              )} />
            </CardContent>
          </Card>

          {/* Anexo + Obs */}
          {invoice.url_pdf && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm flex-1">PDF da Nota Fiscal</span>
                <Button variant="outline" size="sm" onClick={() => { openStoredFile(invoice.url_pdf).catch(() => toast.error("Não foi possível abrir o arquivo.")); }}>
                  <ExternalLink className="h-4 w-4 mr-1" />Abrir
                </Button>
              </CardContent>
            </Card>
          )}

          {cleanedNotes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground" data-testid="text-invoice-notes">{cleanedNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-invoice-view">Fechar</Button>
          {onEdit && (
            <Button onClick={onEdit} data-testid="button-edit-invoice-view"><Pencil className="h-4 w-4 mr-2" />Editar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
