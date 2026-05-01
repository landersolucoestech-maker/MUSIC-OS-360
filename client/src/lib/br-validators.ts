// Validadores brasileiros: CPF, CNPJ, CEP, e-mail.
// Implementa o algoritmo de dígito verificador oficial.

export function onlyDigits(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

export function isValidCPF(input: string | null | undefined): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  let dig1 = (sum * 10) % 11;
  if (dig1 === 10) dig1 = 0;
  if (dig1 !== parseInt(cpf.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  let dig2 = (sum * 10) % 11;
  if (dig2 === 10) dig2 = 0;
  return dig2 === parseInt(cpf.charAt(10), 10);
}

export function isValidCNPJ(input: string | null | undefined): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, n, i) => acc + parseInt(n, 10) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.substring(0, 12), w1);
  if (d1 !== parseInt(cnpj.charAt(12), 10)) return false;
  const d2 = calc(cnpj.substring(0, 13), w2);
  return d2 === parseInt(cnpj.charAt(13), 10);
}

export function isValidCpfCnpj(input: string | null | undefined): boolean {
  const d = onlyDigits(input);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

export function isValidCEP(input: string | null | undefined): boolean {
  return onlyDigits(input).length === 8;
}

export function isValidEmail(input: string | null | undefined): boolean {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

export function formatCpfCnpj(input: string | null | undefined): string {
  const d = onlyDigits(input);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(input || "");
}

export function formatCEP(input: string | null | undefined): string {
  const d = onlyDigits(input);
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, "$1-$2");
  return String(input || "");
}
