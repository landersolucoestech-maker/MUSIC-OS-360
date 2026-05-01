import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, TrendingUp, TrendingDown, CreditCard, Repeat, Building2, FileText, Paperclip, ExternalLink, Briefcase, User, Tag, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-format";
import { Button } from "@/components/ui/button";

interface TransacaoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacao?: any;
}

const formaPagamentoLabels: Record<string, string> = {
  pix: "PIX",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
};

const getStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pago":
    case "confirmada":
      return <Badge className="bg-green-600 text-white">{status}</Badge>;
    case "pendente":
      return <Badge className="bg-amber-500 text-white">{status}</Badge>;
    case "cancelado":
    case "cancelada":
      return <Badge className="bg-red-600 text-white">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status || "—"}</Badge>;
  }
};

function Field({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

export function TransacaoViewModal({ open, onOpenChange, transacao }: TransacaoViewModalProps) {
  if (!transacao) return null;

  const isReceita = transacao.tipo === "receita";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="modal-transacao-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Detalhes da Transação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cabeçalho com valor */}
          <Card className={isReceita ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}>
            <CardContent className="p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground" data-testid="text-transacao-descricao">{transacao.descricao}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={isReceita ? "bg-green-600" : "bg-red-600"}>
                    {isReceita ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {isReceita ? "Receita" : "Despesa"}
                  </Badge>
                  {getStatusBadge(transacao.status)}
                  {transacao.recorrente && <Badge variant="outline"><Repeat className="h-3 w-3 mr-1" />Recorrente</Badge>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className={`text-3xl font-bold ${isReceita ? "text-green-600" : "text-red-600"}`} data-testid="text-transacao-valor">
                  {isReceita ? "+" : "-"}{formatCurrency(transacao.valor || 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Classificação */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Categoria" value={transacao.categoria} icon={Tag} />
            <Field label="Subcategoria" value={transacao.subcategoria} icon={Tag} />
            <Field label="Data" value={formatDate(transacao.data)} icon={Calendar} />
            <Field label="Centro de Custo" value={transacao.centro_custo} icon={Briefcase} />
          </div>

          {/* Pagamento */}
          <Card>
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field
                label="Forma de Pagamento"
                value={transacao.forma_pagamento && formaPagamentoLabels[transacao.forma_pagamento] || transacao.forma_pagamento}
                icon={CreditCard}
              />
              <Field
                label="Parcelas"
                value={transacao.parcelas > 1 ? `${transacao.parcela_atual || 1}/${transacao.parcelas}x` : "À vista"}
                icon={Receipt}
              />
              <Field label="Conta Bancária" value={transacao.conta_bancaria} icon={Building2} />
            </CardContent>
          </Card>

          {/* Vínculos */}
          {(transacao.artistas || transacao.clientes || transacao.vendas || transacao.projetos || transacao.contratos || transacao.projeto_id || transacao.contrato_id) && (
            <Card>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {transacao.artistas && (
                  <Field label="Artista" value={transacao.artistas.nome_artistico || transacao.artistas.nome} icon={User} />
                )}
                {transacao.clientes && (
                  <Field label="Cliente" value={transacao.clientes.nome} icon={Building2} />
                )}
                {transacao.vendas && (
                  <Field label="Venda" value={transacao.vendas.descricao || `Venda #${transacao.vendas.id?.slice(0, 8)}`} icon={Receipt} />
                )}
                {(transacao.projetos || transacao.projeto_id) && (
                  <Field label="Projeto" value={transacao.projetos?.titulo || transacao.projeto_id?.slice(0, 8)} icon={Briefcase} />
                )}
                {(transacao.contratos || transacao.contrato_id) && (
                  <Field label="Contrato" value={transacao.contratos?.titulo || transacao.contrato_id?.slice(0, 8)} icon={FileText} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Anexo */}
          {transacao.anexo_url && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Paperclip className="h-5 w-5 text-primary" />
                <span className="text-sm flex-1">Comprovante anexado</span>
                <Button variant="ghost" size="sm" onClick={() => window.open(transacao.anexo_url, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-1" />Abrir
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {transacao.observacoes && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />Observações
              </p>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm whitespace-pre-wrap">{transacao.observacoes}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
