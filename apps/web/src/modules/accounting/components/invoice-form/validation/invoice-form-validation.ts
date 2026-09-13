import { isValidCpfCnpj, isValidCEP, isValidEmail } from "@/shared/lib/br-validators";
import type { InvoiceFormData } from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";

export type InvoiceValidationErrors = Partial<Record<keyof InvoiceFormData, string>>;

export function validateInvoiceForm(f: InvoiceFormData): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};

  if (!f.numero?.trim()) {
    errors.numero = "Número obrigatório";
  }

  if (!f.tomador_razao_social?.trim()) {
    errors.tomador_razao_social = "Razão social obrigatória";
  }

  if (!f.tomador_cnpj?.trim()) {
    errors.tomador_cnpj = "CNPJ/CPF obrigatório";
  } else if (!isValidCpfCnpj(f.tomador_cnpj)) {
    errors.tomador_cnpj = "CNPJ/CPF inválido (dígito verificador não confere)";
  }

  if (f.tomador_cep && !isValidCEP(f.tomador_cep)) {
    errors.tomador_cep = "CEP inválido";
  }

  if (f.tomador_email && !isValidEmail(f.tomador_email)) {
    errors.tomador_email = "E-mail inválido";
  }

  if (!(parseFloat(String(f.valor_servicos)) > 0)) {
    errors.valor_servicos = "Informe o valor dos serviços";
  }

  return errors;
}
