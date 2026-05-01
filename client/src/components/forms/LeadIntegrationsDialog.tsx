import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Globe, ExternalLink } from "lucide-react";
import { SiFacebook, SiInstagram, SiGoogleads } from "react-icons/si";
import { toast } from "sonner";

interface LeadIntegrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EDGE_FUNCTION_BASE =
  "https://configure-seu-backend.example.com/functions/v1/lead-capture";

const WEBHOOK_URLS = {
  facebook: `${EDGE_FUNCTION_BASE}?source=facebook_ads`,
  instagram: `${EDGE_FUNCTION_BASE}?source=instagram_ads`,
  google_ads: `${EDGE_FUNCTION_BASE}?source=google_ads`,
  website: `${EDGE_FUNCTION_BASE}?source=website`,
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="font-mono text-xs"
          data-testid={`input-webhook-${label.toLowerCase().replace(/\s/g, "-")}`}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2">
          <Badge variant="secondary" className="h-5 w-5 flex-shrink-0 flex items-center justify-center text-[10px] rounded-full p-0">
            {i + 1}
          </Badge>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function LeadIntegrationsDialog({ open, onOpenChange }: LeadIntegrationsDialogProps) {
  const publicFormUrl = `${window.location.origin}/captar`;

  const embeddableSnippet = `<iframe src="${publicFormUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-lead-integrations">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Integrações de Captação de Leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Integração desativada — backend não configurado.</strong>{" "}
                As URLs abaixo são apenas exemplos. Para receber leads via webhook,
                configure um backend que receba e persista os leads.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">API Key</span>
                <Badge variant="secondary" className="text-[10px]">Obrigatório</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Todas as requisições devem incluir o header <code className="bg-muted px-1 rounded text-[11px]">x-api-key</code> com o valor configurado no seu backend.
              </p>
              <CopyField label="Header" value="x-api-key: SUA_CHAVE_API" />
            </CardContent>
          </Card>

          <Tabs defaultValue="facebook" className="w-full">
            <TabsList className="grid w-full grid-cols-4" data-testid="tabs-integrations">
              <TabsTrigger value="facebook" className="gap-1 text-xs" data-testid="tab-facebook">
                <SiFacebook className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Facebook</span>
              </TabsTrigger>
              <TabsTrigger value="instagram" className="gap-1 text-xs" data-testid="tab-instagram">
                <SiInstagram className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Instagram</span>
              </TabsTrigger>
              <TabsTrigger value="google" className="gap-1 text-xs" data-testid="tab-google">
                <SiGoogleads className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Google Ads</span>
              </TabsTrigger>
              <TabsTrigger value="website" className="gap-1 text-xs" data-testid="tab-website">
                <Globe className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Website</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="facebook" className="space-y-4 mt-4" data-testid="content-facebook">
              <CopyField label="Webhook URL (Facebook)" value={WEBHOOK_URLS.facebook} />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Como configurar no Meta Business Suite</h4>
                <StepList steps={[
                  "Acesse o Meta Business Suite e vá em Configurações > Integrações de Leads.",
                  "Clique em \"Conectar CRM\" ou \"Adicionar Webhook\".",
                  "Cole a Webhook URL acima no campo de URL de destino.",
                  "No campo \"Verify Token\", insira o valor da sua LEAD_CAPTURE_API_KEY.",
                  "Selecione os eventos \"leadgen\" para receber notificações de novos leads.",
                  "Salve e teste a integração enviando um lead de teste pela ferramenta do Meta.",
                  "Os leads aparecerão automaticamente nesta página com origem \"Facebook Ads\".",
                ]} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground">Formato esperado do payload</h4>
                <pre className="bg-muted p-3 rounded-md text-[11px] overflow-x-auto">
{`{
  "entry": [{
    "changes": [{
      "value": {
        "leadgen_id": "...",
        "field_data": [
          { "name": "full_name", "values": ["João Silva"] },
          { "name": "email", "values": ["joao@email.com"] },
          { "name": "phone_number", "values": ["+5511999999999"] }
        ]
      }
    }]
  }]
}`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="instagram" className="space-y-4 mt-4" data-testid="content-instagram">
              <CopyField label="Webhook URL (Instagram)" value={WEBHOOK_URLS.instagram} />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Como configurar para Instagram Lead Ads</h4>
                <StepList steps={[
                  "O Instagram Lead Ads utiliza a mesma plataforma Meta Business Suite.",
                  "Acesse Configurações > Integrações de Leads no Meta Business Suite.",
                  "O processo é idêntico ao Facebook — cole a Webhook URL acima.",
                  "Use a URL específica do Instagram para que os leads sejam identificados com origem \"Instagram Ads\".",
                  "Certifique-se de que sua página do Instagram esteja vinculada à sua conta Business.",
                  "Crie um formulário de leads no Gerenciador de Anúncios vinculado ao Instagram.",
                  "Teste enviando um lead pelo formulário de teste do Meta.",
                ]} />
              </div>
            </TabsContent>

            <TabsContent value="google" className="space-y-4 mt-4" data-testid="content-google">
              <CopyField label="Webhook URL (Google Ads)" value={WEBHOOK_URLS.google_ads} />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Como configurar no Google Ads</h4>
                <StepList steps={[
                  "Acesse o Google Ads e vá em Ferramentas e Configurações > Extensões de Formulário de Lead.",
                  "Crie ou edite uma extensão de formulário de lead.",
                  "Na seção \"Entrega de dados do lead\", selecione \"Webhook\".",
                  "Cole a Webhook URL acima e configure a chave de API no header x-api-key.",
                  "No Google Ads, configure a chave/token com o valor da sua LEAD_CAPTURE_API_KEY.",
                  "Salve e publique a extensão de formulário.",
                  "Teste com um lead de teste — ele aparecerá com origem \"Google Ads\".",
                ]} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground">Formato esperado do payload</h4>
                <pre className="bg-muted p-3 rounded-md text-[11px] overflow-x-auto">
{`{
  "lead_form_submission": {
    "lead_form_id": "...",
    "lead_form_name": "...",
    "user_column_data": [
      { "column_name": "Full Name", "string_value": "João Silva" },
      { "column_name": "Email", "string_value": "joao@email.com" },
      { "column_name": "Phone Number", "string_value": "+5511999999999" }
    ]
  }
}`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="website" className="space-y-4 mt-4" data-testid="content-website">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Formulário Público</h4>
                  <p className="text-xs text-muted-foreground">
                    Um formulário pronto para captar leads diretamente pelo seu site ou landing page.
                  </p>
                  <CopyField label="URL do Formulário" value={publicFormUrl} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(publicFormUrl, "_blank")}
                    data-testid="button-open-form"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Formulário
                  </Button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Código Embed (iframe)</h4>
                  <p className="text-xs text-muted-foreground">
                    Cole este código HTML no seu site para incorporar o formulário de captação.
                  </p>
                  <CopyField label="Snippet HTML" value={embeddableSnippet} />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">API Direta</h4>
                  <p className="text-xs text-muted-foreground">
                    Envie leads diretamente via API usando o endpoint abaixo.
                  </p>
                  <CopyField label="Webhook URL (Website)" value={WEBHOOK_URLS.website} />
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">Exemplo de requisição</h4>
                    <pre className="bg-muted p-3 rounded-md text-[11px] overflow-x-auto">
{`curl -X POST "${WEBHOOK_URLS.website}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: SUA_CHAVE_API" \\
  -d '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "+5511999999999",
    "servico": "show_booking",
    "mensagem": "Tenho interesse em contratar um show"
  }'`}
                    </pre>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}