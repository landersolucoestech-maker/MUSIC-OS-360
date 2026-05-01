import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/useClientes";
import { FileUpload, UploadedFile } from "@/components/shared/FileUpload";

interface ContractTemplate {
  id: string;
  name: string;
  template_type: string;
  is_active: boolean;
}

const contractSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  client_type: z.enum(["artista", "pessoa_fisica", "pessoa_juridica"], { required_error: "Tipo de cliente é obrigatório" }),
  service_type: z.enum(
    [
      "empresariamento",
      "empresariamento_suporte",
      "gestao",
      "agenciamento",
      "edicao",
      "distribuicao",
      "marketing",
      "producao_musical",
      "producao_audiovisual",
      "licenciamento",
      "publicidade",
      "parceria",
      "shows",
      "outros",
    ],
    { required_error: "Tipo de serviço é obrigatório" },
  ),
  artist_id: z.string().optional(),
  company_id: z.string().optional(),
  project_id: z.string().optional(),
  contractor_contact: z.string().optional(),
  responsible_person: z.string().optional(),
  status: z.enum(["pendente", "assinado", "expirado", "rescindido", "rascunho"]).default("rascunho"),
  start_date: z.date({ required_error: "Data de início é obrigatória" }),
  end_date: z.date().optional(),
  registry_office: z.boolean().optional(),
  registry_date: z.date().optional(),
  payment_type: z.enum(["valor_fixo", "royalties"]).optional(),
  fixed_value: z.number().optional(),
  royalties_percentage: z.number().min(0).max(100).optional(),
  advance_payment: z.number().optional(),
  financial_support: z.number().optional(),
  observations: z.string().optional(),
  terms: z.string().optional(),
});

type ContractFormData = z.infer<typeof contractSchema>;

interface ContractFormProps {
  onSubmit: (data: ContractFormData) => void;
  onCancel?: () => void;
  initialData?: Partial<ContractFormData>;
  isLoading?: boolean;
  artists?: Array<{
    id: string;
    name: string;
    full_name?: string;
    cpf_cnpj?: string;
    rg?: string;
    full_address?: string;
    artist_types?: string[];
  }>;
  companies?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string }>;
  contacts?: Array<{
    id: string;
    name: string;
    company?: string | null;
    document?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    position?: string;
  }>;
  templates?: ContractTemplate[];
}

export const ContractForm: React.FC<ContractFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
  artists = [],
  companies = [],
  projects = [],
  contacts = [],
  templates = [],
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [documentos, setDocumentos] = useState<UploadedFile[]>([]);
  const { clientes } = useClientes();

  // Filtrar contatos do CRM por tipo
  const contatosPF = clientes.filter((c: any) => c.tipo_pessoa === "pessoa_fisica");
  const contatosPJ = clientes.filter((c: any) => c.tipo_pessoa === "pessoa_juridica");

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      status: "rascunho",
      registry_office: false,
      ...initialData,
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        status: "rascunho",
        registry_office: false,
        ...initialData,
      });
    }
  }, [initialData, form]);

  // Load template when service_type changes
  const watchedServiceType = form.watch("service_type");

  useEffect(() => {
    if (watchedServiceType && templates.length > 0) {
      const template = templates.find((t) => t.template_type === watchedServiceType && t.is_active);
      if (template) {
        setSelectedTemplate(template);
      } else {
        setSelectedTemplate(null);
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [watchedServiceType, templates]);

  const handleSubmit = (data: ContractFormData) => {
    const submitData = {
      ...data,
      template_id: selectedTemplate?.id,
    };
    onSubmit(submitData);
  };

  const handleManualSubmit = () => {
    form.handleSubmit(handleSubmit)();
  };

  const artistaServiceTypeLabels = {
    empresariamento: "Empresariamento",
    empresariamento_suporte: "Empresariamento com suporte",
    gestao: "Gestão",
    agenciamento: "Agenciamento",
    edicao: "Edição",
    distribuicao: "Distribuição",
    marketing: "Marketing",
    producao_musical: "Produção Musical",
    producao_audiovisual: "Produção Audiovisual",
    licenciamento: "Licenciamento",
  };

  const empresaServiceTypeLabels = {
    producao_musical: "Produção Musical",
    marketing: "Marketing",
    producao_audiovisual: "Produção Audiovisual",
    publicidade: "Publicidade",
    parceria: "Parceria",
    shows: "Shows",
    licenciamento: "Licenciamento",
    outros: "Outros",
  };

  const empresaServiceTypes = Object.keys(empresaServiceTypeLabels);

  const getFilteredServiceTypes = () => {
    const clientType = form.watch("client_type");
    if (clientType === "pessoa_juridica") {
      return Object.entries(empresaServiceTypeLabels);
    }
    return Object.entries(artistaServiceTypeLabels);
  };

  const statusLabels = {
    pendente: "Pendente",
    assinado: "Assinado",
    expirado: "Expirado",
    rescindido: "Rescindido",
    rascunho: "Rascunho",
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Título do Contrato</Label>
              <Select
                value={form.watch("title")}
                onValueChange={(value) => {
                  form.setValue("title", value);
                  // Find the template and set service_type accordingly
                  const template = templates.find((t) => t.name === value);
                  if (template) {
                    form.setValue("service_type", template.template_type as any);
                    setSelectedTemplate(template);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o template de contrato" />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .filter((t) => t.is_active)
                    .map((template) => (
                      <SelectItem key={template.id} value={template.name || `template-${template.id}`}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Cliente</Label>
              <Select
                value={form.watch("client_type")}
                onValueChange={(value) => {
                  form.setValue("client_type", value as any);
                  const currentServiceType = form.watch("service_type");
                  if (value === "pessoa_juridica" && currentServiceType && !empresaServiceTypes.includes(currentServiceType)) {
                    form.setValue("service_type", undefined as any);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="artista">Artista</SelectItem>
                  <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                  <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.client_type && (
                <p className="text-sm text-destructive">{form.formState.errors.client_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select
                value={form.watch("service_type")}
                onValueChange={(value) => form.setValue("service_type", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredServiceTypes().map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.service_type && (
                <p className="text-sm text-destructive">{form.formState.errors.service_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.watch("client_type") === "pessoa_fisica" && (
              <div className="space-y-2">
                <Label>Contratante (Pessoa Física)</Label>
                <Select
                  value={form.watch("contractor_contact")}
                  onValueChange={(value) => {
                    form.setValue("contractor_contact", value);
                    const contato = contatosPF.find(c => c.id === value);
                    if (contato) {
                      form.setValue("responsible_person", contato.responsavel || contato.nome);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={contatosPF.length > 0 ? "Selecione um contato do CRM" : "Nenhum contato PF cadastrado"}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {contatosPF.length > 0 ? (
                      contatosPF.map((contato) => (
                        <SelectItem key={contato.id} value={contato.id}>
                          {contato.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-sm text-muted-foreground">Nenhum contato PF cadastrado no CRM</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.watch("client_type") === "pessoa_juridica" && (
              <div className="space-y-2">
                <Label>Contratante (Pessoa Jurídica)</Label>
                <Select
                  value={form.watch("company_id")}
                  onValueChange={(value) => {
                    form.setValue("company_id", value);
                    const empresa = contatosPJ.find(c => c.id === value);
                    if (empresa) {
                      form.setValue("responsible_person", empresa.responsavel || "");
                      form.setValue("contractor_contact", empresa.id);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={contatosPJ.length > 0 ? "Selecione uma empresa do CRM" : "Nenhuma empresa cadastrada"}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {contatosPJ.length > 0 ? (
                      contatosPJ.map((empresa) => (
                        <SelectItem key={empresa.id} value={empresa.id}>
                          {empresa.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-sm text-muted-foreground">Nenhuma empresa cadastrada no CRM</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.watch("client_type") === "artista" && (
              <div className="space-y-2">
                <Label>Cliente/Artista</Label>
                <Select value={form.watch("artist_id")} onValueChange={(value) => form.setValue("artist_id", value)}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={artists.length > 0 ? "Selecione um artista" : "Nenhum artista cadastrado"}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {artists.length > 0 ? (
                      artists.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-sm text-muted-foreground">Nenhum artista cadastrado</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="responsible_person">Responsável</Label>
              <Input
                id="responsible_person"
                {...form.register("responsible_person")}
                placeholder="Nome do responsável"
              />
              {form.formState.errors.responsible_person && (
                <p className="text-sm text-destructive">{form.formState.errors.responsible_person.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("start_date") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("start_date") ? format(form.watch("start_date"), "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("start_date")}
                    onSelect={(date) => form.setValue("start_date", date as Date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data de Término</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("end_date") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("end_date") ? format(form.watch("end_date"), "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("end_date")}
                    onSelect={(date) => form.setValue("end_date", date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="registry_office"
                checked={form.watch("registry_office")}
                onCheckedChange={(checked) => form.setValue("registry_office", checked as boolean)}
              />
              <Label htmlFor="registry_office">Registrado em cartório</Label>
            </div>
          </div>

          {form.watch("registry_office") && (
            <div className="space-y-2">
              <Label>Data de Registro em Cartório</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("registry_date") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("registry_date") ? format(form.watch("registry_date"), "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("registry_date")}
                    onSelect={(date) => form.setValue("registry_date", date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Pessoa Física ou Jurídica: Valor do Contrato */}
            {(form.watch("client_type") === "pessoa_juridica" || form.watch("client_type") === "pessoa_fisica") && (
              <div className="space-y-2">
                <Label htmlFor="fixed_value">Valor do Contrato (R$)</Label>
                <Input
                  id="fixed_value"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  {...form.register("fixed_value", { valueAsNumber: true })}
                />
              </div>
            )}

            {/* Artista + Agenciamento/Gestão/Empresariamento: Royalties e Adiantamento */}
            {form.watch("client_type") === "artista" &&
              ["agenciamento", "gestao", "empresariamento", "empresariamento_suporte"].includes(
                form.watch("service_type") || "",
              ) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="royalties_percentage">Royalties (%)</Label>
                    <Input
                      id="royalties_percentage"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0,00"
                      {...form.register("royalties_percentage", { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="advance_payment">Adiantamento (R$)</Label>
                    <Input
                      id="advance_payment"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...form.register("advance_payment", { valueAsNumber: true })}
                    />
                  </div>

                  {form.watch("service_type") === "empresariamento_suporte" && (
                    <div className="space-y-2">
                      <Label htmlFor="financial_support">Suporte Financeiro Mensal (R$)</Label>
                      <Input
                        id="financial_support"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        {...form.register("financial_support", { valueAsNumber: true })}
                      />
                    </div>
                  )}
                </>
              )}

            {/* Artista + Produção Musical/Edição/Distribuição: Tipo de Pagamento */}
            {form.watch("client_type") === "artista" &&
              ["producao_musical", "edicao", "distribuicao"].includes(form.watch("service_type") || "") && (
                <>
                  <div className="space-y-2">
                    <Label>Tipo de Pagamento</Label>
                    <Select
                      value={form.watch("payment_type")}
                      onValueChange={(value) => form.setValue("payment_type", value as "valor_fixo" | "royalties")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valor_fixo">Valor Fixo</SelectItem>
                        <SelectItem value="royalties">Royalties</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.watch("payment_type") === "valor_fixo" && (
                    <div className="space-y-2">
                      <Label htmlFor="fixed_value">Valor do Serviço (R$)</Label>
                      <Input
                        id="fixed_value"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        {...form.register("fixed_value", { valueAsNumber: true })}
                      />
                    </div>
                  )}

                  {form.watch("payment_type") === "royalties" && (
                    <div className="space-y-2">
                      <Label htmlFor="royalties_percentage">Royalties (%)</Label>
                      <Input
                        id="royalties_percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0,00"
                        {...form.register("royalties_percentage", { valueAsNumber: true })}
                      />
                    </div>
                  )}
                </>
              )}

            {/* Artista + Produção Audiovisual/Marketing: Valor Fixo do Serviço */}
            {form.watch("client_type") === "artista" &&
              ["producao_audiovisual", "marketing"].includes(form.watch("service_type") || "") && (
                <div className="space-y-2">
                  <Label htmlFor="fixed_value">Valor Fixo do Serviço (R$)</Label>
                  <Input
                    id="fixed_value"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    {...form.register("fixed_value", { valueAsNumber: true })}
                  />
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos Anexos</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload
            folder="contratos/documentos"
            accept="application/pdf,image/*"
            maxSize={20}
            multiple
            value={documentos}
            onChange={setDocumentos}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações e Termos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              {...form.register("observations")}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms">Termos</Label>
            <Textarea id="terms" {...form.register("terms")} placeholder="Termos do contrato..." rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
        )}
        <Button type="button" disabled={isLoading} onClick={handleManualSubmit} className="w-full sm:w-auto">
          {isLoading ? "Salvando..." : "Salvar Contrato"}
        </Button>
      </div>
    </form>
  );
};

// Modal wrapper component for backwards compatibility
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContratoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato?: any;
  mode?: "create" | "edit";
}

export const ContratoFormModal: React.FC<ContratoFormModalProps> = ({
  open,
  onOpenChange,
  contrato,
  mode = "create",
}) => {
  const handleSubmit = (data: any) => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{mode === "create" ? "Novo Contrato" : "Editar Contrato"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
          <ContractForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            initialData={contrato}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
