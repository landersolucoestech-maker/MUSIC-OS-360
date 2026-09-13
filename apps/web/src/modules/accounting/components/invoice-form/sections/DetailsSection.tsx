import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { isValidCpfCnpj, formatCpfCnpj, formatCEP } from "@/shared/lib/br-validators";
import { format, parseISO } from "date-fns";
import type { InvoiceFormData, InvoiceFormRules } from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";
import type { InvoiceValidationErrors } from "@/modules/accounting/components/invoice-form/validation/invoice-form-validation";
import type { InvoiceClientLookup } from "@/modules/accounting/components/invoice-form/hooks/useInvoiceForm";

const statusOptions = [
  { value: "issued", label: "Emitida" },
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Paga" },
  { value: "cancelled", label: "Cancelada" },
];

const tipoNotaOptions = [
  { value: "nfse", label: "NFS-e (Serviço)" },
  { value: "nfe", label: "NF-e (Produto)" },
  { value: "nfce", label: "NFC-e (Consumidor)" },
];

const codigosServicoComuns = [
  { value: "12.07", label: "12.07 - Shows, festivais e congêneres" },
  { value: "12.13", label: "12.13 - Produção de eventos artísticos" },
  { value: "13.02", label: "13.02 - Fonografia ou gravação de sons" },
  { value: "10.05", label: "10.05 - Agenciamento, corretagem ou intermediação artística" },
  { value: "17.01", label: "17.01 - Assessoria, consultoria, gestão" },
  { value: "17.06", label: "17.06 - Propaganda e publicidade" },
];

const ufOptions = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface DetailsSectionProps {
  formData: InvoiceFormData;
  rules: InvoiceFormRules;
  validationErrors: InvoiceValidationErrors;
  disabled: boolean;
  companySettings: any;
  updateField: <K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => void;
  handleClientChange: (clientId: string, client?: InvoiceClientLookup) => void;
}

export function DetailsSection({
  formData,
  rules,
  validationErrors,
  disabled,
  companySettings,
  updateField,
  handleClientChange,
}: DetailsSectionProps) {
  return (
    <>
      {/* ── IDENTIFICAÇÃO ── */}
      <section className="space-y-4" data-testid="section-identificacao">
        <h3 className="text-base font-semibold border-b pb-1">Identificação</h3>

        {companySettings && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{rules.prestadorCardLabel}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Razão Social</p>
                <p className="font-medium">{companySettings.company_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CNPJ</p>
                <p className="font-medium">
                  {companySettings.cnpj ? formatCpfCnpj(companySettings.cnpj) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Insc. Estadual</p>
                <p className="font-medium">{companySettings.inscricao_estadual || "—"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="font-medium">
                  {[
                    companySettings.logradouro,
                    companySettings.numero,
                    companySettings.cidade,
                    companySettings.estado,
                    companySettings.cep && formatCEP(companySettings.cep),
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Banco</p>
                <p className="font-medium">
                  {companySettings.banco
                    ? `${companySettings.banco} • Ag ${companySettings.agencia || "—"} • CC ${companySettings.conta || "—"}`
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Número <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.numero}
              onChange={(e) => updateField("numero", e.target.value)}
              placeholder="000001234"
              disabled={disabled}
              data-testid="input-numero"
            />
          </div>
          <div className="space-y-2">
            <Label>Série</Label>
            <Input
              value={formData.serie}
              onChange={(e) => updateField("serie", e.target.value)}
              placeholder="001"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Nota</Label>
            <Select
              value={formData.tipo_nota}
              onValueChange={(v) => updateField("tipo_nota", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipoNotaOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data de Emissão</Label>
            <DatePickerField
              value={formData.data_emissao ? format(formData.data_emissao, "yyyy-MM-dd") : ""}
              onChange={(iso) => updateField("data_emissao", iso ? parseISO(iso) : undefined)}
              disabled={disabled}
              placeholder="Selecione a data"
              data-testid="datepicker-data-emissao"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => updateField("status", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Natureza da Operação</Label>
            <Input
              value={formData.natureza_operacao}
              onChange={(e) => updateField("natureza_operacao", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>CFOP</Label>
            <Input
              value={formData.cfop}
              onChange={(e) => updateField("cfop", e.target.value)}
              placeholder="5933"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Código Serviço Municipal</Label>
            <Select
              value={formData.codigo_servico_municipal}
              onValueChange={(v) => updateField("codigo_servico_municipal", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {codigosServicoComuns.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Código Município (IBGE)</Label>
            <Input
              value={formData.codigo_municipio}
              onChange={(e) => updateField("codigo_municipio", e.target.value)}
              placeholder="3550308"
              disabled={disabled}
            />
          </div>
        </div>
      </section>

      {/* ── TOMADOR / FORNECEDOR ── */}
      <section className="space-y-4" data-testid="section-tomador">
        <h3 className="text-base font-semibold border-b pb-1">{rules.tomadorSectionLabel}</h3>

        <div className="space-y-2">
          <Label>{rules.clienteSelectLabel}</Label>
          <AsyncEntityCombobox<InvoiceClientLookup>
            table="clientes"
            getLabel={(c) => c.nome}
            value={formData.client_id}
            onChange={handleClientChange}
            placeholder="Selecione um client"
            searchPlaceholder="Buscar client…"
            disabled={disabled}
            data-testid="combobox-client-nf"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              CNPJ / CPF <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.tomador_cnpj}
              onChange={(e) => updateField("tomador_cnpj", e.target.value)}
              onBlur={(e) => updateField("tomador_cnpj", formatCpfCnpj(e.target.value))}
              placeholder="00.000.000/0001-00"
              disabled={disabled}
              data-testid="input-tomador-cnpj"
              aria-invalid={!!validationErrors.tomador_cnpj}
              className={validationErrors.tomador_cnpj ? "border-destructive" : ""}
            />
            {validationErrors.tomador_cnpj && (
              <p className="text-xs text-destructive">{validationErrors.tomador_cnpj}</p>
            )}
            {formData.tomador_cnpj &&
              !validationErrors.tomador_cnpj &&
              isValidCpfCnpj(formData.tomador_cnpj) && (
                <p className="text-xs text-success">✓ Documento válido</p>
              )}
          </div>
          <div className="space-y-2">
            <Label>
              Razão Social / Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.tomador_razao_social}
              onChange={(e) => updateField("tomador_razao_social", e.target.value)}
              disabled={disabled}
              aria-invalid={!!validationErrors.tomador_razao_social}
              className={validationErrors.tomador_razao_social ? "border-destructive" : ""}
            />
            {validationErrors.tomador_razao_social && (
              <p className="text-xs text-destructive">{validationErrors.tomador_razao_social}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Inscrição Estadual</Label>
            <Input
              value={formData.tomador_inscricao_estadual}
              onChange={(e) => updateField("tomador_inscricao_estadual", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Municipal</Label>
            <Input
              value={formData.tomador_inscricao_municipal}
              onChange={(e) => updateField("tomador_inscricao_municipal", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input
            type="email"
            value={formData.tomador_email}
            onChange={(e) => updateField("tomador_email", e.target.value)}
            disabled={disabled}
            aria-invalid={!!validationErrors.tomador_email}
            className={validationErrors.tomador_email ? "border-destructive" : ""}
          />
          {validationErrors.tomador_email && (
            <p className="text-xs text-destructive">{validationErrors.tomador_email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Endereço</Label>
          <Input
            value={formData.tomador_endereco}
            onChange={(e) => updateField("tomador_endereco", e.target.value)}
            placeholder="Av. Paulista, 1000"
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={formData.tomador_cidade}
              onChange={(e) => updateField("tomador_cidade", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Select
              value={formData.tomador_uf}
              onValueChange={(v) => updateField("tomador_uf", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ufOptions.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={formData.tomador_cep}
              onChange={(e) => updateField("tomador_cep", e.target.value)}
              onBlur={(e) => updateField("tomador_cep", formatCEP(e.target.value))}
              placeholder="00000-000"
              disabled={disabled}
              aria-invalid={!!validationErrors.tomador_cep}
              className={validationErrors.tomador_cep ? "border-destructive" : ""}
            />
            {validationErrors.tomador_cep && (
              <p className="text-xs text-destructive">{validationErrors.tomador_cep}</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
