import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Building2, MapPin, Mail, ExternalLink, Pencil, Receipt, CreditCard, Calculator, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-format";
import { formatCpfCnpj } from "@/lib/br-validators";
import { parseTipoOperacao } from "@/lib/nota-fiscal-tipo";

interface NotaFiscalViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaFiscal?: any;
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
    case "paga": case "pago": return <Badge className="bg-green-600 text-white">Paga</Badge>;
    case "emitida": return <Badge className="bg-blue-600 text-white">Emitida</Badge>;
    case "pendente": return <Badge className="bg-amber-500 text-white">Pendente</Badge>;
    case "cancelada": return <Badge className="bg-red-600 text-white">Cancelada</Badge>;
    default: return <Badge variant="secondary">{status || "—"}</Badge>;
  }
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

export function NotaFiscalViewModal({ open, onOpenChange, notaFiscal, onEdit }: NotaFiscalViewModalProps) {
  if (!notaFiscal) return null;
  const { tipo: tipoOperacao, observacoesLimpas } = parseTipoOperacao(notaFiscal.observacoes);
  const isEntrada = tipoOperacao === "entrada";
  const itens: any[] = Array.isArray(notaFiscal.itens) ? notaFiscal.itens : [];
  const totalRetencoes =
    (notaFiscal.iss_retido ? Number(notaFiscal.valor_iss || 0) : 0) +
    Number(notaFiscal.valor_pis || 0) +
    Number(notaFiscal.valor_cofins || 0) +
    Number(notaFiscal.valor_ir || 0) +
    Number(notaFiscal.valor_csll || 0) +
    Number(notaFiscal.valor_inss || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="modal-nota-fiscal-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nota Fiscal Nº {notaFiscal.numero}/{notaFiscal.serie || "001"}
          </DialogTitle>
          <DialogDescription className="flex gap-2 items-center mt-1">
            <Badge variant={isEntrada ? "secondary" : "default"} className="gap-1" data-testid={`badge-tipo-${tipoOperacao}`}>
              {isEntrada ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {isEntrada ? "Entrada" : "Saída"}
            </Badge>
            <Badge variant="outline">{tipoNotaLabels[notaFiscal.tipo_nota] || notaFiscal.tipo_nota || "NFS-e"}</Badge>
            {getStatusBadge(notaFiscal.status)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Identificação */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />Identificação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Data Emissão" value={formatDate(notaFiscal.data_emissao)} />
              <Field label="Vencimento" value={notaFiscal.vencimento && formatDate(notaFiscal.vencimento)} />
              <Field label="Natureza Operação" value={notaFiscal.natureza_operacao} />
              <Field label="CFOP" value={notaFiscal.cfop} />
              <Field label="Cód. Serviço Municipal" value={notaFiscal.codigo_servico_municipal} />
              <Field label="Cód. Município" value={notaFiscal.codigo_municipio} />
            </CardContent>
          </Card>

          {/* Tomador / Fornecedor */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />{isEntrada ? "Fornecedor / Emitente" : "Tomador do Serviço"}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Razão Social / Nome" value={notaFiscal.tomador_razao_social} />
              <Field label="CNPJ / CPF" value={notaFiscal.tomador_cnpj && formatCpfCnpj(notaFiscal.tomador_cnpj)} />
              <Field label="Inscrição Estadual" value={notaFiscal.tomador_inscricao_estadual} />
              <Field label="Inscrição Municipal" value={notaFiscal.tomador_inscricao_municipal} />
              <Field label="E-mail" value={notaFiscal.tomador_email && (
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{notaFiscal.tomador_email}</span>
              )} />
              <Field label="Endereço" value={
                <span className="flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{[notaFiscal.tomador_endereco, notaFiscal.tomador_cidade, notaFiscal.tomador_uf, notaFiscal.tomador_cep].filter(Boolean).join(", ")}</span>
                </span>
              } />
            </CardContent>
          </Card>

          {/* Serviços */}
          {(notaFiscal.descricao_servicos || itens.length > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Serviços</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {notaFiscal.descricao_servicos && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap">{notaFiscal.descricao_servicos}</p>
                  </div>
                )}
                {itens.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Itens ({itens.length})</p>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs">
                          <tr>
                            <th className="text-left px-3 py-2">Descrição</th>
                            <th className="text-left px-3 py-2 w-20">Cód.</th>
                            <th className="text-right px-3 py-2 w-16">Qtd</th>
                            <th className="text-right px-3 py-2 w-28">Vlr Unit.</th>
                            <th className="text-right px-3 py-2 w-28">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((it, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-3 py-2">{it.descricao}</td>
                              <td className="px-3 py-2">{it.codigo_servico}</td>
                              <td className="px-3 py-2 text-right">{it.quantidade}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(it.valor_unitario || 0)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(it.valor_total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                <Field label="Vlr Serviços" value={formatCurrency(notaFiscal.valor_servicos || 0)} />
                <Field label="Deduções" value={formatCurrency(notaFiscal.valor_deducoes || 0)} />
                <Field label="Base Cálculo" value={formatCurrency(notaFiscal.base_calculo || 0)} />
                <Field label="Alíq. ISS" value={`${notaFiscal.aliquota_iss || 0}%`} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Field label={notaFiscal.iss_retido ? "ISS (retido)" : "ISS"} value={formatCurrency(notaFiscal.valor_iss || 0)} />
                <Field label="PIS" value={formatCurrency(notaFiscal.valor_pis || 0)} />
                <Field label="COFINS" value={formatCurrency(notaFiscal.valor_cofins || 0)} />
                <Field label="IRRF" value={formatCurrency(notaFiscal.valor_ir || 0)} />
                <Field label="CSLL" value={formatCurrency(notaFiscal.valor_csll || 0)} />
                <Field label="INSS" value={formatCurrency(notaFiscal.valor_inss || 0)} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Total Retenções</p>
                  <p className="text-sm font-semibold text-red-600">{formatCurrency(totalRetencoes)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{isEntrada ? "Valor Líquido a Pagar" : "Valor Líquido a Receber"}</p>
                  <p className="text-2xl font-bold text-primary" data-testid="text-nf-valor-liquido">{formatCurrency(notaFiscal.valor_liquido || (notaFiscal.valor_servicos - totalRetencoes))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Pagamento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Forma Pagamento" value={formaPagamentoLabels[notaFiscal.forma_pagamento] || notaFiscal.forma_pagamento} />
              <Field label="Condição" value={notaFiscal.condicao_pagamento} />
              <Field label="Vencimento" value={notaFiscal.vencimento && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{formatDate(notaFiscal.vencimento)}</span>
              )} />
            </CardContent>
          </Card>

          {/* Anexo + Obs */}
          {notaFiscal.url_pdf && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm flex-1">PDF da Nota Fiscal</span>
                <Button variant="outline" size="sm" onClick={() => window.open(notaFiscal.url_pdf, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-1" />Abrir
                </Button>
              </CardContent>
            </Card>
          )}

          {observacoesLimpas && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground" data-testid="text-nf-observacoes">{observacoesLimpas}</p>
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
