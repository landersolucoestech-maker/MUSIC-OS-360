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

interface InvoiceViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: any;
  onEdit?: () => void;
}

const tipoNotaLabels: Record<string, string> = {
  nfse: "NFS-e (Serviço)",
  nfe: "NF-e (Produto)",
  nfce: "NFC-e (Consumidor)",
};

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  cheque: "Cheque",
};

const getStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case "paid": case "pago": return <Badge variant="success">Paga</Badge>;
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

function getInvoicePartyName(invoice: any): string | null {
  return invoice.tomador_razao_social || invoice.tomador_nome || invoice.clientes?.nome || null;
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
  if (!invoice) return null;
  const { type: operationType, observacoesLimpas: cleanedNotes } = parseOperationType(invoice.observacoes);
  const isEntrada = operationType === "entrada";
  const itens: any[] = Array.isArray(invoice.itens) ? invoice.itens : [];
  const valorServicos = numberValue(invoice.valor_servicos, invoice.valor, invoice.valor_total) ?? 0;
  const totalRetencoes =
    (invoice.iss_retido ? Number(invoice.valor_iss || 0) : 0) +
    Number(invoice.valor_pis || 0) +
    Number(invoice.valor_cofins || 0) +
    Number(invoice.valor_ir || 0) +
    Number(invoice.valor_csll || 0) +
    Number(invoice.valor_inss || 0);
  const valorLiquido =
    numberValue(invoice.valor_liquido, invoice.valor_servicos, invoice.valor, invoice.valor_total) ??
    Math.max(valorServicos - totalRetencoes, 0);
  const signedNotaValue = isEntrada ? -valorLiquido : valorLiquido;
  const signedServicesValue = isEntrada ? -valorServicos : valorServicos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="modal-nota-fiscal-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nota Fiscal Nº {invoice.numero}/{invoice.serie || "001"}
          </DialogTitle>
          <DialogDescription className="flex gap-2 items-center mt-1">
            <Badge variant={isEntrada ? "secondary" : "default"} className="gap-1" data-testid={`badge-type-${operationType}`}>
              {isEntrada ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {isEntrada ? "Entrada" : "Saída"}
            </Badge>
            <Badge variant="outline">{tipoNotaLabels[invoice.tipo_nota] || invoice.tipo_nota || "NFS-e"}</Badge>
            {getStatusBadge(invoice.status)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Identificação */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />Identificação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Data Emissão" value={formatDate(invoice.data_emissao)} />
              <Field label="Vencimento" value={invoice.vencimento && formatDate(invoice.vencimento)} />
              <Field label="Natureza Operação" value={invoice.natureza_operacao} />
              <Field label="CFOP" value={invoice.cfop} />
              <Field label="Cód. Serviço Municipal" value={invoice.codigo_servico_municipal} />
              <Field label="Cód. Município" value={invoice.codigo_municipio} />
            </CardContent>
          </Card>

          {/* Tomador / Fornecedor */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />{isEntrada ? "Fornecedor / Emitente" : "Tomador do Serviço"}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Razão Social / Nome" value={getInvoicePartyName(invoice)} />
              <Field label="CNPJ / CPF" value={invoice.tomador_cnpj && formatCpfCnpj(invoice.tomador_cnpj)} />
              <Field label="Inscrição Estadual" value={invoice.tomador_inscricao_estadual} />
              <Field label="Inscrição Municipal" value={invoice.tomador_inscricao_municipal} />
              <Field label="E-mail" value={invoice.tomador_email && (
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{invoice.tomador_email}</span>
              )} />
              <Field label="Endereço" value={
                <span className="flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{[invoice.tomador_endereco, invoice.tomador_cidade, invoice.tomador_uf, invoice.tomador_cep].filter(Boolean).join(", ")}</span>
                </span>
              } />
            </CardContent>
          </Card>

          {/* Serviços */}
          {(invoice.descricao_servicos || itens.length > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Serviços</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {invoice.descricao_servicos && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap">{invoice.descricao_servicos}</p>
                  </div>
                )}
                {itens.length > 0 && (
                  <div className="space-y-2">
                    <div className="border border-border rounded-lg overflow-hidden">
                      <ListSectionHeader
                        title="Itens da Nota"
                        count={itens.length}
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
                          {itens.map((it, i) => (
                            <TableRow key={i}>
                              <TableCell>{it.descricao}</TableCell>
                              <TableCell>{it.codigo_servico}</TableCell>
                              <TableCell className="text-right">{it.quantidade}</TableCell>
                              <TableCell className={`text-right ${getCurrencyToneClass(isEntrada ? -Number(it.valor_unitario || 0) : Number(it.valor_unitario || 0))}`}>{formatCurrency(isEntrada ? -Number(it.valor_unitario || 0) : Number(it.valor_unitario || 0))}</TableCell>
                              <TableCell className={`text-right font-medium ${getCurrencyToneClass(isEntrada ? -Number(it.valor_total || 0) : Number(it.valor_total || 0))}`}>{formatCurrency(isEntrada ? -Number(it.valor_total || 0) : Number(it.valor_total || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tributos */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />Tributos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Vlr Serviços" value={<span className={getCurrencyToneClass(signedServicesValue)}>{formatCurrency(signedServicesValue)}</span>} />
                <Field label="Deduções" value={<span className={getCurrencyToneClass(-Number(invoice.valor_deducoes || 0))}>{formatCurrency(-Number(invoice.valor_deducoes || 0))}</span>} />
                <Field label="Base Cálculo" value={<span className={getCurrencyToneClass(signedServicesValue)}>{formatCurrency(signedServicesValue)}</span>} />
                <Field label="Alíq. ISS" value={`${invoice.aliquota_iss || 0}%`} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Field label={invoice.iss_retido ? "ISS (retido)" : "ISS"} value={<span className={getCurrencyToneClass(-Number(invoice.valor_iss || 0))}>{formatCurrency(-Number(invoice.valor_iss || 0))}</span>} />
                <Field label="PIS" value={<span className={getCurrencyToneClass(-Number(invoice.valor_pis || 0))}>{formatCurrency(-Number(invoice.valor_pis || 0))}</span>} />
                <Field label="COFINS" value={<span className={getCurrencyToneClass(-Number(invoice.valor_cofins || 0))}>{formatCurrency(-Number(invoice.valor_cofins || 0))}</span>} />
                <Field label="IRRF" value={<span className={getCurrencyToneClass(-Number(invoice.valor_ir || 0))}>{formatCurrency(-Number(invoice.valor_ir || 0))}</span>} />
                <Field label="CSLL" value={<span className={getCurrencyToneClass(-Number(invoice.valor_csll || 0))}>{formatCurrency(-Number(invoice.valor_csll || 0))}</span>} />
                <Field label="INSS" value={<span className={getCurrencyToneClass(-Number(invoice.valor_inss || 0))}>{formatCurrency(-Number(invoice.valor_inss || 0))}</span>} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Total Retenções</p>
                  <p className="text-sm font-semibold text-destructive">{formatCurrency(-totalRetencoes)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{isEntrada ? "Valor Líquido a Pagar" : "Valor Líquido a Receber"}</p>
                  <p className={`text-2xl font-bold ${getCurrencyToneClass(signedNotaValue)}`} data-testid="text-nf-valor-liquido">{formatCurrency(signedNotaValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Pagamento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Forma Pagamento" value={formaPagamentoLabels[invoice.forma_pagamento] || invoice.forma_pagamento} />
              <Field label="Condição" value={invoice.condicao_pagamento} />
              <Field label="Vencimento" value={invoice.vencimento && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{formatDate(invoice.vencimento)}</span>
              )} />
            </CardContent>
          </Card>

          {/* Anexo + Obs */}
          {invoice.url_pdf && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm flex-1">PDF da Nota Fiscal</span>
                <Button variant="outline" size="sm" onClick={() => window.open(invoice.url_pdf, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-1" />Abrir
                </Button>
              </CardContent>
            </Card>
          )}

          {cleanedNotes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground" data-testid="text-nf-observacoes">{cleanedNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-fechar-nf-view">Fechar</Button>
          {onEdit && (
            <Button onClick={onEdit} data-testid="button-editar-nf-view"><Pencil className="h-4 w-4 mr-2" />Editar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
