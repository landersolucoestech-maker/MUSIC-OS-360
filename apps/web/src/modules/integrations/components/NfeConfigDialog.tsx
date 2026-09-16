import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/shared/ui/dialog";
import { IntegrationDialogHeader } from "@/shared/integrations";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Loader2, Trash2, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  useNfeStatus,
  useNfeSaveCredentials,
  useNfeDeleteCredentials,
  type NfeAmbiente,
  type NfeCertificadoTipo,
} from "@/modules/integrations/hooks/useNfe";

interface NfeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REGIME_OPTIONS: { value: string; label: string }[] = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
];

const PROVEDOR_OPTIONS: { value: string; label: string }[] = [
  { value: "focusnfe", label: "Focus NFe" },
  { value: "nfeio", label: "NFe.io" },
  { value: "emites", label: "Emites" },
  { value: "plugnotas", label: "PlugNotas" },
  { value: "proprio", label: "Integração própria" },
];

export function NfeConfigDialog({ open, onOpenChange }: NfeConfigDialogProps) {
  const { data: status, isLoading } = useNfeStatus();
  const saveMutation = useNfeSaveCredentials();
  const deleteMutation = useNfeDeleteCredentials();

  const [cnpj, setCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [regime, setRegime] = useState<string>("simples_nacional");
  const [ambiente, setAmbiente] = useState<NfeAmbiente>("homologacao");
  const [certificadoTipo, setCertificadoTipo] = useState<NfeCertificadoTipo>("A1");
  const [certificadoSerial, setCertificadoSerial] = useState("");
  const [tokenProvedor, setTokenProvedor] = useState("");
  const [provedor, setProvedor] = useState<string>("focusnfe");

  useEffect(() => {
    if (!open) return;
    const s = status;
    if (s?.connected) {
      setCnpj(s.cnpj ?? "");
      setRegime(s.regime_tributario ?? "simples_nacional");
      setAmbiente(s.ambiente ?? "homologacao");
      setCertificadoTipo(s.certificado_tipo ?? "A1");
      setProvedor(s.provedor ?? "focusnfe");
    } else {
      setCnpj("");
      setIe("");
      setRegime("simples_nacional");
      setAmbiente("homologacao");
      setCertificadoTipo("A1");
      setCertificadoSerial("");
      setTokenProvedor("");
      setProvedor("focusnfe");
    }
  }, [open, status]);

  const handleSave = async () => {
    if (!cnpj.trim()) {
      toast.error("Informe o CNPJ da empresa emissora.");
      return;
    }
    if (!tokenProvedor.trim() && !status?.connected) {
      toast.error("Informe o Token do provedor NF-e.");
      return;
    }
    await saveMutation.mutateAsync({
      cnpj: cnpj.trim().replace(/\D/g, ""),
      ie: ie.trim() || undefined,
      regime_tributario: regime as "simples_nacional" | "lucro_presumido" | "lucro_real",
      ambiente,
      certificado_tipo: certificadoTipo,
      certificado_serial: certificadoSerial.trim() || undefined,
      token_provedor: tokenProvedor.trim() || undefined,
      provedor: provedor as "focusnfe" | "nfeio" | "emites" | "plugnotas" | "proprio",
    });
    toast.success("NF-e configurada com sucesso!");
    setTokenProvedor("");
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
    toast.info("Configuração de NF-e removida.");
    setCnpj("");
    setIe("");
    setTokenProvedor("");
    setCertificadoSerial("");
  };

  const canSave =
    cnpj.trim().length > 0 &&
    (tokenProvedor.trim().length > 0 || Boolean(status?.connected));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-nfe-config">
        <IntegrationDialogHeader
          logoId="nfe"
          title="Emissão de NF-e"
          description="Configure as credenciais fiscais da sua empresa para emitir notas fiscais eletrônicas diretamente pelo sistema."
        />

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando status…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {status?.connected && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-success">NF-e configurada</p>
                  <p className="text-xs text-muted-foreground">
                    CNPJ: {status.cnpj} · Ambiente: {status.ambiente === "producao" ? "Produção" : "Homologação"}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={status.ambiente === "producao" ? "text-[10px] bg-success/10 text-success" : "text-[10px]"}
                >
                  {status.ambiente === "producao" ? "Produção" : "Homologação"}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nfe-cnpj">
                  CNPJ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nfe-cnpj"
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  data-testid="input-nfe-cnpj"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nfe-ie">Inscrição Estadual</Label>
                <Input
                  id="nfe-ie"
                  placeholder="Opcional"
                  value={ie}
                  onChange={(e) => setIe(e.target.value)}
                  data-testid="input-nfe-ie"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Regime Tributário</Label>
                <Select value={regime} onValueChange={setRegime}>
                  <SelectTrigger data-testid="select-nfe-regime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <Select value={ambiente} onValueChange={(v) => setAmbiente(v as NfeAmbiente)}>
                  <SelectTrigger data-testid="select-nfe-ambiente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação (teste)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Certificado</Label>
                <Select
                  value={certificadoTipo}
                  onValueChange={(v) => setCertificadoTipo(v as NfeCertificadoTipo)}
                >
                  <SelectTrigger data-testid="select-nfe-cert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1 (arquivo PFX)</SelectItem>
                    <SelectItem value="A3">A3 (token/cartão)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nfe-cert-serial">Serial do Certificado</Label>
                <Input
                  id="nfe-cert-serial"
                  placeholder="Opcional"
                  value={certificadoSerial}
                  onChange={(e) => setCertificadoSerial(e.target.value)}
                  data-testid="input-nfe-cert-serial"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Provedor NF-e</Label>
              <Select value={provedor} onValueChange={setProvedor}>
                <SelectTrigger data-testid="select-nfe-provedor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVEDOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nfe-token">
                Token do Provedor {!status?.connected && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="nfe-token"
                type="password"
                placeholder={status?.connected ? "Deixe em branco para manter o atual" : "Token de autenticação do provedor"}
                value={tokenProvedor}
                onChange={(e) => setTokenProvedor(e.target.value)}
                data-testid="input-nfe-token"
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
              <span>
                As credenciais fiscais são armazenadas localmente e nunca enviadas a terceiros.
                Cada empresa deve usar seu próprio CNPJ e certificado digital.
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {status?.connected && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 mr-auto"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-nfe-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-nfe-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || saveMutation.isPending}
            data-testid="button-nfe-save"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {status?.connected ? "Atualizar" : "Configurar NF-e"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
