import type { ContractVariable, EntityType, Participant, ParticipantRole, VariableCategory } from "@/modules/contracts/types/contracts.types";

import { canonicalEntityType, canonicalVariableCategory } from "@/modules/contracts/lib/contract-variable-vocabulary";

const ROLE_LABELS: Record<ParticipantRole, string> = {
  CONTRATANTE: "Contratante",
  CONTRATADO: "Contratado",
  ARTISTA: "Artista",
  PRODUTOR: "Produtor",
  EMPRESA: "Empresa",
  LABEL: "Label",
  EMPRESARIO: "Empresário",
  COMPOSITOR: "Compositor",
  TESTEMUNHA: "Testemunha",
  REPRESENTANTE_LEGAL: "Representante Legal",
};

const CATEGORY_ORDER: VariableCategory[] = [
  "participants",
  "financial",
  "musical_work",
  "term",
  "signature",
  "system",
  "custom",
];

const INDIVIDUAL_FIELDS: Array<{ suffix: string; label: string; description: string; example: string; type: ContractVariable["type"] }> = [
  { suffix: "NOME_COMPLETO", label: "Nome Completo", description: "Nome civil completo do participante", example: "João da Silva", type: "text" },
  { suffix: "NOME_ARTISTICO", label: "Nome Artístico", description: "Nome artístico ou pseudónimo", example: "JoãoArt", type: "text" },
  { suffix: "CPF", label: "CPF", description: "Cadastro de Pessoa Física (000.000.000-00)", example: "000.000.000-00", type: "text" },
  { suffix: "RG", label: "RG", description: "Registro Geral / Identidade", example: "12.345.678-9", type: "text" },
  { suffix: "DATA_NASCIMENTO", label: "Data de Nascimento", description: "Data de nascimento no formato DD/MM/AAAA", example: "01/01/1990", type: "date" },
  { suffix: "NACIONALIDADE", label: "Nacionalidade", description: "Nacionalidade do participante", example: "Brasileiro(a)", type: "text" },
  { suffix: "ESTADO_CIVIL", label: "Estado Civil", description: "Estado civil do participante", example: "Solteiro(a)", type: "text" },
  { suffix: "PROFISSAO", label: "Profissão", description: "Profissão declarada", example: "Músico(a)", type: "text" },
  { suffix: "EMAIL", label: "E-mail", description: "Endereço de e-mail para notificações", example: "joao@exemplo.com", type: "text" },
  { suffix: "TELEFONE", label: "Telefone", description: "Telefone de contato com DDD", example: "(11) 99999-0000", type: "text" },
  { suffix: "ENDERECO", label: "Endereço", description: "Logradouro e número", example: "Rua das Flores, 100", type: "text" },
  { suffix: "CIDADE", label: "Cidade", description: "Município de residência", example: "São Paulo", type: "text" },
  { suffix: "ESTADO", label: "Estado", description: "UF de residência (sigla)", example: "SP", type: "text" },
  { suffix: "CEP", label: "CEP", description: "Código de endereçamento postal", example: "01000-000", type: "text" },
  { suffix: "PAIS", label: "País", description: "País de residência", example: "Brasil", type: "text" },
  { suffix: "PIX", label: "Chave PIX", description: "Chave PIX para recebimento", example: "joao@exemplo.com", type: "text" },
  { suffix: "BANCO", label: "Banco", description: "Nome do banco/instituição financeira", example: "Banco do Brasil", type: "text" },
];

const COMPANY_FIELDS: Array<{ suffix: string; label: string; description: string; example: string; type: ContractVariable["type"] }> = [
  { suffix: "RAZAO_SOCIAL", label: "Razão Social", description: "Nome jurídico registrado na junta comercial", example: "Empresa Ltda", type: "text" },
  { suffix: "NOME_FANTASIA", label: "Nome Fantasia", description: "Nome comercial ou fantasia", example: "Empresa Music", type: "text" },
  { suffix: "CNPJ", label: "CNPJ", description: "Cadastro Nacional de Pessoa Jurídica", example: "00.000.000/0001-00", type: "text" },
  { suffix: "INSCRICAO_ESTADUAL", label: "Inscrição Estadual", description: "Número de inscrição estadual", example: "123.456.789.000", type: "text" },
  { suffix: "REPRESENTANTE_LEGAL", label: "Representante Legal", description: "Nome do representante legal / sócio-administrador", example: "Maria Souza", type: "text" },
  { suffix: "CPF_REPRESENTANTE", label: "CPF do Representante", description: "CPF do representante legal", example: "000.000.000-00", type: "text" },
  { suffix: "EMAIL", label: "E-mail", description: "E-mail corporativo de contato", example: "contato@empresa.com", type: "text" },
  { suffix: "TELEFONE", label: "Telefone", description: "Telefone corporativo com DDD", example: "(11) 3000-0000", type: "text" },
  { suffix: "ENDERECO", label: "Endereço", description: "Endereço da sede/estabelecimento", example: "Av. Paulista, 1000", type: "text" },
  { suffix: "CIDADE", label: "Cidade", description: "Município da sede", example: "São Paulo", type: "text" },
  { suffix: "ESTADO", label: "Estado", description: "UF da sede (sigla)", example: "SP", type: "text" },
  { suffix: "CEP", label: "CEP", description: "CEP da sede", example: "01310-100", type: "text" },
  { suffix: "PAIS", label: "País", description: "País da sede", example: "Brasil", type: "text" },
];

export function generateParticipantVariables(role: ParticipantRole, entityType: EntityType): ContractVariable[] {
  const fields = canonicalEntityType(entityType) === "individual" ? INDIVIDUAL_FIELDS : COMPANY_FIELDS;
  const p = role;
  return fields.map((f) => ({
    id: `${p}_${f.suffix}`,
    key: `${p}_${f.suffix}`,
    label: `${ROLE_LABELS[role]} — ${f.label}`,
    description: f.description,
    type: f.type,
    source: "participant" as const,
    category: "participants" as VariableCategory,
    required: false,
    example: f.example,
    participantReference: role,
  }));
}

export const SYSTEM_VARIABLES: ContractVariable[] = [
  {
    id: "START_DATE", key: "START_DATE", label: "Data de Início",
    description: "Data de início de vigência do contrato",
    type: "date", source: "system", category: "term",
    required: false, example: "01/01/2025",
  },
  {
    id: "END_DATE", key: "END_DATE", label: "Data de Término",
    description: "Data de término de vigência do contrato",
    type: "date", source: "system", category: "term",
    required: false, example: "31/12/2025",
  },
  {
    id: "DURATION_MONTHS", key: "DURATION_MONTHS", label: "Duração (meses)",
    description: "Duração total do contrato em meses",
    type: "number", source: "system", category: "term",
    required: false, example: "12",
  },
  {
    id: "FIXED_VALUE", key: "FIXED_VALUE", label: "Valor Fixo",
    description: "Valor fixo contratado em moeda corrente",
    type: "currency", source: "financial", category: "financial",
    required: false, example: "R$ 5.000,00",
  },
  {
    id: "EXTERNAL_RIGHTS_PERCENTAGE", key: "EXTERNAL_RIGHTS_PERCENTAGE", label: "Termos externos de direitos (%)",
    description: "Percentual de recebimentos externos de direitos acordado entre as partes",
    type: "percentage", source: "financial", category: "financial",
    required: false, example: "15%",
  },
  {
    id: "ADVANCE_AMOUNT", key: "ADVANCE_AMOUNT", label: "Adiantamento",
    description: "Valor de adiantamento pago na assinatura",
    type: "currency", source: "financial", category: "financial",
    required: false, example: "R$ 2.000,00",
  },
  {
    id: "FINANCIAL_SUPPORT", key: "FINANCIAL_SUPPORT", label: "Suporte Financeiro Mensal",
    description: "Suporte financeiro mensal garantido pelo contratante",
    type: "currency", source: "financial", category: "financial",
    required: false, example: "R$ 1.500,00",
  },
  {
    id: "PAYMENT_FREQUENCY", key: "PAYMENT_FREQUENCY", label: "Frequência de Pagamento",
    description: "Periodicidade dos pagamentos (único, mensal, etc.)",
    type: "text", source: "financial", category: "financial",
    required: false, example: "Mensal",
  },
  {
    id: "WORK_TITLE", key: "WORK_TITLE", label: "Título da Obra",
    description: "Nome/título da obra musical objeto do contrato",
    type: "text", source: "work", category: "musical_work",
    required: false, example: "Minha Música",
  },
  {
    id: "WORK_ISRC", key: "WORK_ISRC", label: "ISRC da Obra",
    description: "Código ISRC (International Standard Recording Code)",
    type: "text", source: "work", category: "musical_work",
    required: false, example: "BRBMG2400001",
  },
  {
    id: "WORK_GENRE", key: "WORK_GENRE", label: "Gênero Musical",
    description: "Gênero/estilo musical da obra",
    type: "text", source: "work", category: "musical_work",
    required: false, example: "Sertanejo",
  },
  {
    id: "CONTRACT_DATE", key: "CONTRACT_DATE", label: "Data do Contrato",
    description: "Data de celebração/assinatura do contrato",
    type: "date", source: "system", category: "system",
    required: false, example: new Date().toLocaleDateString("pt-BR"),
  },
  {
    id: "CONTRACT_CITY", key: "CONTRACT_CITY", label: "Cidade do Contrato",
    description: "Município de celebração do contrato (foro de eleição)",
    type: "text", source: "system", category: "system",
    required: false, example: "São Paulo",
  },
  {
    id: "CONTRACT_STATE", key: "CONTRACT_STATE", label: "Estado do Contrato",
    description: "Estado/UF de celebração do contrato",
    type: "text", source: "system", category: "system",
    required: false, example: "SP",
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  participants: "Participantes",
  financial: "Financeiro",
  musical_work: "Obra Musical",
  term: "Vigência",
  signature: "Assinatura",
  system: "Sistema",
  custom: "Personalizadas",
};

/**
 * Resolve all variables for the given participants plus system variables.
 * Returns a deduplicated list ordered by the canonical CATEGORY_ORDER.
 */
export function resolveAllVariables(participants: Participant[]): ContractVariable[] {
  const participantVars = participants.flatMap((p) =>
    generateParticipantVariables(p.role, p.entityType),
  );
  const all = [...participantVars, ...SYSTEM_VARIABLES];

  const seen = new Set<string>();
  const deduped = all.filter((v) => {
    if (seen.has(v.key)) return false;
    seen.add(v.key);
    return true;
  });

  return deduped.sort((a, b) => {
    const oa = CATEGORY_ORDER.indexOf(canonicalVariableCategory(a.category));
    const ob = CATEGORY_ORDER.indexOf(canonicalVariableCategory(b.category));
    const catDiff = (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
    if (catDiff !== 0) return catDiff;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

export const PARTICIPANT_ROLE_OPTIONS: Array<{ value: ParticipantRole; label: string }> = [
  { value: "CONTRATANTE", label: "Contratante" },
  { value: "CONTRATADO", label: "Contratado" },
  { value: "ARTISTA", label: "Artista" },
  { value: "PRODUTOR", label: "Produtor" },
  { value: "EMPRESA", label: "Empresa" },
  { value: "LABEL", label: "Label" },
  { value: "EMPRESARIO", label: "Empresário" },
  { value: "COMPOSITOR", label: "Compositor" },
  { value: "TESTEMUNHA", label: "Testemunha" },
  { value: "REPRESENTANTE_LEGAL", label: "Representante Legal" },
];

/**
 * PT-BR label for a role key shown to the user (party card title, signer badge).
 * Roles come from template placeholders and the signer list, so they may be any
 * machine key (e.g. "OUTRO"): known keys use the label map, unknown ones are
 * humanized. The persisted value is never changed.
 */
const EXTRA_ROLE_LABELS: Record<string, string> = { OUTRO: "Outro", OUTRA: "Outra", REPRESENTANTE: "Representante", CONJUGE: "Cônjuge" };

export function contractRoleLabel(role: string): string {
  const known = (ROLE_LABELS as Record<string, string>)[role] ?? EXTRA_ROLE_LABELS[role];
  if (known) return known;
  const humanized = role.replace(/_/g, " ").trim().toLowerCase();
  return humanized ? humanized.charAt(0).toUpperCase() + humanized.slice(1) : role;
}

export { ROLE_LABELS };

