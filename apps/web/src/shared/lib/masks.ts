// Mask functions for formatting fields

export const maskCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const maskCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

export const maskCPFCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return maskCPF(value);
  }
  return maskCNPJ(value);
};

export const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const maskCEP = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
};

export const unmask = (value: string): string => {
  return value.replace(/\D/g, '');
};

// ViaCEP API
export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/** Address fields of the app form (canonical English names). */
export interface AddressFields {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  addressComplement: string;
}

/**
 * The only place that reads the ViaCEP wire fields (`logradouro`, `bairro`, `localidade`, `uf`, `complemento`:
 * an external provider contract the app does not control). Provider values fill a field only when it has content,
 * and a complement the user already typed is never overwritten.
 */
export const addressFromPostalLookup = (data: ViaCEPResponse, prev: AddressFields): AddressFields => ({
  street: data.logradouro || prev.street,
  neighborhood: data.bairro || prev.neighborhood,
  city: data.localidade || prev.city,
  state: data.uf || prev.state,
  addressComplement: prev.addressComplement || data.complemento || "",
});

export const fetchAddressByCEP = async (cep: string): Promise<ViaCEPResponse | null> => {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length !== 8) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
      signal: controller.signal,
    });
    const data: ViaCEPResponse = await response.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};
