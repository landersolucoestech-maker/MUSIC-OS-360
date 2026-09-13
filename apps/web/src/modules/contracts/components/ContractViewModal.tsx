import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent } from "@/shared/ui/card";
import {
  FileText, ExternalLink, History, Music, Clock, AlertCircle, Info, User, PenLine, CheckCircle2, MailCheck, PencilLine, Send,
} from "lucide-react";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import type { LancamentoWithRelations } from "@/modules/releases/hooks/useLancamentos";
import type { ContractWithRelations, ContractVersion } from "@/modules/contracts/hooks/useContracts";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDateDashes, formatDateTimeDashes, formatCurrency, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { formatCategoryLabel } from "@/shared/lib/category-labels";
import { useDocuments } from "@/modules/contracts/hooks/useDocuments";
import { DocumentStatusBadge, SignerStatusBadge } from "@/modules/contracts/components/DocumentStatusBadge";
import { DocumentTimeline } from "@/modules/contracts/components/DocumentTimeline";
import { SIGNER_ROLE_LABEL } from "@/modules/contracts/lib/contract-schema";
import { SigningPlatformBadge } from "@/modules/contracts/components/SigningPlatformBadge";
import { SendForSigningDialog } from "@/modules/contracts/components/SendForSigningDialog";
import { WorkflowTransitionPanel } from "@/shared/components/WorkflowTransitionPanel";
import { useWorkflowTransition } from "@/shared/hooks/useWorkflowTransition";
import { useEntityDetail } from "@/shared/hooks/useEntityDetail";
import { resolveAllowedTransitions, WorkflowTransition } from "@/shared/lib/workflow-transitions";

interface ContractWithWorkflow extends ContractWithRelations {
  allowed_transitions?: { to: string; label?: string }[];
}

interface ContractViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato?: ContractWithWorkflow;
  onEdit?: () => void;
}

export function ContractViewModal({ open, onOpenChange, contrato, onEdit }: ContractViewModalProps) {
  const { lancamentos } = useLancamentos();
  const navigate = useNavigate();
  const { data: allDocuments = [] } = useDocuments();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const { transition: workflowTransition, isPending: isTransitionPending } = useWorkflowTransition({
    table:    'contracts',
    id:       contrato?.id ?? '',
    queryKey: ['contracts'],
  });

  const { data: detail } = useEntityDetail<ContractWithWorkflow>('contracts', contrato?.id, open);

  if (!contrato) return null;

  const allowedTransitions = resolveAllowedTransitions(
    'contract',
    detail?.status ?? contrato.status,
    detail?.allowed_transitions,
  );
  const vinculadoDoc = allDocuments.find((d) => d.contract_id === contrato.id);
  const contratoSigners = Array.isArray(contrato.signers) ? contrato.signers : [];

  const lancamentoVinculado: LancamentoWithRelations | undefined = contrato.release_id
    ? lancamentos.find((l) => l.id === contrato.release_id)
    : undefined;

  const versoes: ContractVersion[] = Array.isArray(contrato.versoes)
    ? (contrato.versoes as ContractVersion[])
    : [];
  const documents = Array.isArray(contrato.documents) ? contrato.documents : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const endDate = contrato.end_date ? new Date(contrato.end_date) : null;
  const expirando = endDate && endDate >= today && endDate <= in30Days;
  const diasRestantes = endDate
    ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const alreadySent = vinculadoDoc !== undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col">
          {/* ── Header ── */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight truncate">
                  {contrato.title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={contrato.status ?? ""} />
                  <SigningPlatformBadge platform={contrato.signing_platform} />
                  {expirando && (
                    <Badge variant="warning" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Expira em {diasRestantes}d
                    </Badge>
                  )}
                  {contrato.exclusivo && (
                    <Badge variant="outline" className="text-[11px]">Exclusivo</Badge>
                  )}
                  {vinculadoDoc && (
                    <DocumentStatusBadge status={vinculadoDoc.status} />
                  )}
                </div>
                {allowedTransitions.length > 0 && (
                  <WorkflowTransitionPanel
                    currentStatus={contrato.status ?? ""}
                    allowedTransitions={allowedTransitions}
                    onTransition={workflowTransition}
                    isLoading={isTransitionPending}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </DialogHeader>

          {/* ── Tabs ── */}
          <Tabs defaultValue="informacoes" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0 shrink-0">
              {[
                { value: "informacoes", label: "Informações" },
                { value: "assinatura",  label: `Assinatura${contratoSigners.length > 0 ? ` (${contratoSigners.length})` : ""}` },
                { value: "arquivo",     label: "Arquivo" },
                { value: "versoes",     label: `Versões${versoes.length > 0 ? ` (${versoes.length})` : ""}` },
                { value: "documents",  label: `Documentos${documents.length > 0 ? ` (${documents.length})` : ""}` },
                { value: "lancamento",  label: "Lançamento" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  data-testid={`tab-contrato-${tab.value}`}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-3 text-sm font-medium"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1">
              {/* ── Informações ── */}
              <TabsContent value="informacoes" className="p-6 space-y-5 mt-0">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { label: "Artista / Cliente", value: contrato.artistas?.nome_artistico || contrato.clientes?.nome || "—" },
                    { label: "Tipo", value: contrato.type ? formatCategoryLabel(contrato.type) : "—" },
                    { label: "Início", value: formatDateDashes(contrato.start_date) },
                    { label: "Término", value: contrato.end_date ? formatDateDashes(contrato.end_date) : "Indeterminado" },
                    { label: "Valor", value: contrato.valor != null ? <span className={getMonetarySemanticClass("neutral")}>{formatCurrency(contrato.valor)}</span> : "—" },
                    { label: "Assinado em", value: formatDateDashes(contrato.assinado_em) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {contrato.observacoes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3">{contrato.observacoes}</p>
                  </div>
                )}

                {contrato.signing_platform && (
                  <div className="flex items-center gap-2 p-3 bg-success/5 border border-success/20 rounded-lg">
                    <Info className="h-4 w-4 text-success shrink-0" />
                    <div className="flex-1 text-xs text-success">
                      <span>Assinado digitalmente via </span>
                      <SigningPlatformBadge platform={contrato.signing_platform} className="inline-flex align-middle" />
                      {contrato.autentique_doc_id && (
                        <span className="ml-1">— ID: <span className="font-sans">{contrato.autentique_doc_id}</span></span>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Assinatura Digital ── */}
              <TabsContent value="assinatura" className="p-6 mt-0 space-y-5" data-testid="tab-content-assinatura">
                {/* Signatários do contrato (inline, do formulário) */}
                {contratoSigners.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground  tracking-wide mb-3">
                      Signatários ({contratoSigners.length})
                    </p>
                    <div className="space-y-2">
                      {contratoSigners.map((signer, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
                          data-testid={`signer-view-row-${idx}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{signer.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MailCheck className="h-3 w-3" />
                              {signer.email}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                            {(SIGNER_ROLE_LABEL as Record<string, string | undefined>)[signer.role] ?? signer.role}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* Send for signing CTA */}
                    {!alreadySent && (
                      <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">Pronto para assinar?</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Envie o contrato para os {contratoSigners.length} signatário(s) via plataforma de assinatura digital.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="gap-2 shrink-0"
                          onClick={() => setSendDialogOpen(true)}
                          data-testid="button-send-for-signing"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Enviar para Assinatura
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <PenLine className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-semibold mb-1">Nenhum signatário definido</p>
                    <p className="text-xs text-muted-foreground mb-5 max-w-xs">
                      Adicione signatários no formulário do contrato.
                    </p>
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => { onOpenChange(false); onEdit(); }}
                        data-testid="button-edit-to-add-signers"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                        Editar Contrato
                      </Button>
                    )}
                  </div>
                )}

                {/* Se existir documento vinculado, mostra status + plataforma + timeline */}
                {vinculadoDoc && (
                  <>
                    <div className="border-t border-border pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-muted-foreground  tracking-wide">
                          Processo de Assinatura Digital
                        </p>
                        <SigningPlatformBadge platform={vinculadoDoc.signing_provider} />
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-muted/20 border border-border rounded-lg mb-4">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <PenLine className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{vinculadoDoc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <DocumentStatusBadge status={vinculadoDoc.status} />
                            {vinculadoDoc.signed_at && (
                              <span className="text-xs text-muted-foreground">
                                Assinado em {formatDateDashes(vinculadoDoc.signed_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        {alreadySent && contratoSigners.length > 0 && vinculadoDoc.status !== "signed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs shrink-0"
                            onClick={() => setSendDialogOpen(true)}
                            data-testid="button-resend-for-signing"
                          >
                            <Send className="h-3 w-3" />
                            Reenviar
                          </Button>
                        )}
                      </div>

                      {vinculadoDoc.signers.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {vinculadoDoc.signers.map((signer) => (
                            <div
                              key={signer.id}
                              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
                              data-testid={`signer-row-${signer.id}`}
                            >
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                {signer.status === "signed"
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                  : <User className="h-3.5 w-3.5 text-muted-foreground" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{signer.name}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MailCheck className="h-3 w-3" />
                                  {signer.email}
                                </p>
                                {signer.status === "signed" && signer.signed_at && (
                                  <p className="text-xs text-green-600 mt-0.5">
                                    Assinado em {formatDateTimeDashes(signer.signed_at)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {signer.role}
                                </Badge>
                                <SignerStatusBadge status={signer.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {vinculadoDoc.logs.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground  tracking-wide mb-3">
                            Histórico de eventos
                          </p>
                          <DocumentTimeline logs={vinculadoDoc.logs} />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── Arquivo ── */}
              <TabsContent value="arquivo" className="p-6 mt-0" data-testid="tab-content-arquivo">
                {contrato.arquivo_url ? (
                  <Card className="bg-muted/20">
                    <CardContent className="p-8 flex flex-col items-center gap-5 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm mb-1">{contrato.title}</p>
                        <p className="text-xs text-muted-foreground font-sans break-all max-w-sm mx-auto">
                          {contrato.arquivo_url}
                        </p>
                      </div>
                      <Button asChild className="gap-2" data-testid="button-open-arquivo">
                        <a href={contrato.arquivo_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Abrir PDF
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Nenhum arquivo vinculado</p>
                    <p className="text-xs mt-1">Edite o contrato para adicionar a URL do PDF</p>
                  </div>
                )}
              </TabsContent>

              {/* ── Versões (histórico documental) ── */}
              <TabsContent value="versoes" className="p-6 mt-0" data-testid="tab-content-versoes">
                {versoes.length > 0 ? (
                  <div className="space-y-3">
                    {versoes.map((v, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-4 bg-muted/20 border border-border rounded-lg"
                        data-testid={`versao-row-${index}`}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <History className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{v.versao}</span>
                            {index === versoes.length - 1 && (
                              <Badge variant="success" className="text-[9px] h-4 px-1">
                                Atual
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateDashes(v.criado_em)}
                          </p>
                          {v.autor && (
                            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {v.autor}
                            </p>
                          )}
                          {v.notas && (
                            <p className="text-xs text-muted-foreground">{v.notas}</p>
                          )}
                        </div>
                        {v.url && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" asChild>
                            <a href={v.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              Abrir
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <History className="h-12 w-12 mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Sem histórico de versões</p>
                    <p className="text-xs mt-1">As versões do documento aparecerão aqui ao editar o arquivo</p>
                  </div>
                )}
              </TabsContent>

              {/* ── Documentos Anexos (REM-02) ── */}
              <TabsContent value="documents" className="p-6 mt-0" data-testid="tab-content-documents">
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((d, index) => (
                      <div
                        key={`${d.path}-${index}`}
                        className="flex items-start gap-3 p-4 bg-muted/20 border border-border rounded-lg"
                        data-testid={`documento-row-${index}`}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{d.name}</p>
                          {typeof d.size === "number" && d.size > 0 && (
                            <p className="text-xs text-muted-foreground">{(d.size / 1024).toFixed(0)} KB</p>
                          )}
                        </div>
                        {(d.url ?? d.path) && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" asChild>
                            <a href={d.url ?? d.path} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              Abrir
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Nenhum documento anexado</p>
                    <p className="text-xs mt-1">Edite o contrato para anexar documentos</p>
                  </div>
                )}
              </TabsContent>

              {/* ── Lançamento ── */}
              <TabsContent value="lancamento" className="p-6 mt-0" data-testid="tab-content-lancamento">
                {lancamentoVinculado ? (
                  <Card className="bg-muted/20">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Music className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{lancamentoVinculado.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {lancamentoVinculado.type || "—"}
                          </Badge>
                          <StatusBadge status={lancamentoVinculado.status ?? ""} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Distribuidora</p>
                            <p className="text-xs font-medium">{lancamentoVinculado.distribuidora || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Data de lançamento</p>
                            <p className="text-xs font-medium">
                              {lancamentoVinculado.data_lancamento
                                ? formatDateDashes(lancamentoVinculado.data_lancamento)
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 gap-1.5 text-xs"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/lancamentos?view=${lancamentoVinculado.id}`);
                          }}
                          data-testid="button-ver-lancamento"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver em Lançamentos
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Music className="h-12 w-12 mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Sem lançamento vinculado</p>
                    <p className="text-xs mt-1">Edite o contrato para vincular um lançamento</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* ── Footer ── */}
          <DialogFooter className="px-6 py-3 border-t border-border gap-2 flex-wrap shrink-0">
            {contratoSigners.length > 0 && !alreadySent && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 mr-auto"
                onClick={() => setSendDialogOpen(true)}
                data-testid="button-footer-send-for-signing"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar para Assinatura
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendForSigningDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        contrato={contrato}
      />
    </>
  );
}

