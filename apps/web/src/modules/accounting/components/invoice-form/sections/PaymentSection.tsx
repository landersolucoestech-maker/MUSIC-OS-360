import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { FileUpload, type UploadedFile } from "@/shared/components/FileUpload";
import { format, parseISO } from "date-fns";
import type { InvoiceFormData } from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";

const formaPagamentoOptions = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cheque", label: "Cheque" },
];

interface PaymentSectionProps {
  formData: InvoiceFormData;
  disabled: boolean;
  updateField: <K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => void;
}

function currentPdf(url: string): UploadedFile[] {
  if (!url) return [];
  return [{
    name: "Nota fiscal.pdf",
    size: 0,
    type: "application/pdf",
    path: url,
    url,
  }];
}

export function PaymentSection({ formData, disabled, updateField }: PaymentSectionProps) {
  return (
    <section className="space-y-4" data-testid="section-pagamento">
      <h3 className="text-base font-semibold border-b pb-1">Pagamento</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Forma de Pagamento</Label>
          <Select
            value={formData.forma_pagamento}
            onValueChange={(value) => updateField("forma_pagamento", value)}
            disabled={disabled}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {formaPagamentoOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Condição</Label>
          <Input
            value={formData.condicao_pagamento}
            onChange={(event) => updateField("condicao_pagamento", event.target.value)}
            placeholder="30 dias / À vista / 30/60/90"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Vencimento</Label>
          <DatePickerField
            value={formData.vencimento ? format(formData.vencimento, "yyyy-MM-dd") : ""}
            onChange={(iso) => updateField("vencimento", iso ? parseISO(iso) : undefined)}
            disabled={disabled}
            placeholder="Selecione a data"
            data-testid="datepicker-vencimento"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Arquivo PDF da Nota</Label>
        <FileUpload
          accept=".pdf,application/pdf"
          maxSize={10}
          category="documents"
          entity="invoice"
          disabled={disabled}
          value={currentPdf(formData.url_pdf)}
          onChange={(files) => {
            const uploaded = files[0];
            updateField("url_pdf", uploaded?.url ?? uploaded?.path ?? "");
          }}
          onUploadComplete={(files) => {
            const uploaded = files[0];
            updateField("url_pdf", uploaded?.url ?? uploaded?.path ?? "");
          }}
        />
        <p className="text-xs text-muted-foreground">
          O PDF é enviado ao armazenamento R2 antes de salvar a nota. Se o R2 não estiver configurado, o formulário mostra o erro real e não simula sucesso.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={formData.observacoes}
          onChange={(event) => updateField("observacoes", event.target.value)}
          placeholder="Observações adicionais..."
          rows={3}
          disabled={disabled}
        />
      </div>
    </section>
  );
}
