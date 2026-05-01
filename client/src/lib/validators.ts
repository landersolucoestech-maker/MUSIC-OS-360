// Validation utilities

// Validate CPF
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validate first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;
  
  // Validate second digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;
  
  return true;
}

// Validate CNPJ
export function validateCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  
  // Validate first digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCNPJ[12])) return false;
  
  // Validate second digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleanCNPJ[13])) return false;
  
  return true;
}

// Validate CPF or CNPJ based on length
export function validateCPFCNPJ(value: string): { valid: boolean; type: 'cpf' | 'cnpj' | null; message: string } {
  const clean = value.replace(/\D/g, '');
  
  if (clean.length === 0) {
    return { valid: true, type: null, message: '' };
  }
  
  if (clean.length <= 11) {
    if (clean.length < 11) {
      return { valid: false, type: 'cpf', message: 'CPF incompleto' };
    }
    const isValid = validateCPF(clean);
    return { 
      valid: isValid, 
      type: 'cpf', 
      message: isValid ? '' : 'CPF inválido' 
    };
  }
  
  if (clean.length < 14) {
    return { valid: false, type: 'cnpj', message: 'CNPJ incompleto' };
  }
  
  const isValid = validateCNPJ(clean);
  return { 
    valid: isValid, 
    type: 'cnpj', 
    message: isValid ? '' : 'CNPJ inválido' 
  };
}
