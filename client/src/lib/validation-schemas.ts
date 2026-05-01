import { z } from "zod";

// ==================== ARTISTA SCHEMA ====================
export const artistaSchema = z.object({
  nome_artistico: z.string()
    .min(1, "Nome artístico é obrigatório")
    .max(100, "Nome artístico deve ter no máximo 100 caracteres")
    .trim()
    .default(""),
  nome_civil: z.string()
    .max(150, "Nome civil deve ter no máximo 150 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  tipo: z.enum(["artista_solo", "banda", "projeto_artistico", "coletivo", "produtor"], {
    errorMap: () => ({ message: "Selecione um tipo válido" })
  }),
  status: z.enum(["contratado", "parceiro", "independente", "pendente"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  cpf_cnpj: z.string()
    .max(18, "CPF/CNPJ deve ter no máximo 18 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  genero_musical: z.string()
    .max(50, "Gênero musical deve ter no máximo 50 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  telefone: z.string()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .regex(/^[\d\s\-\(\)]*$/, "Telefone deve conter apenas números e caracteres válidos")
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  foto_url: z.string()
    .url("URL da foto inválida")
    .max(500, "URL muito longa")
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ArtistaFormData = z.infer<typeof artistaSchema>;

// ==================== CLIENTE/CRM SCHEMA ====================
export const clienteSchema = z.object({
  tipo_pessoa: z.enum(["pessoa_fisica", "pessoa_juridica"], {
    errorMap: () => ({ message: "Selecione o tipo de pessoa" })
  }),
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  cpf_cnpj: z.string()
    .max(20, "CPF/CNPJ deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  responsavel: z.string()
    .max(100, "Responsável deve ter no máximo 100 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  telefone: z.string()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  endereco: z.string()
    .max(200, "Endereço deve ter no máximo 200 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  cidade: z.string()
    .max(100, "Cidade deve ter no máximo 100 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  estado: z.string()
    .max(2, "Estado deve ter 2 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["lead", "cliente_ativo", "inativo"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
});

export type ClienteFormData = z.infer<typeof clienteSchema>;

// ==================== VENDA SCHEMA ====================
export const vendaSchema = z.object({
  tipo: z.enum(["servico", "produto"], {
    errorMap: () => ({ message: "Selecione o tipo de venda" })
  }),
  item_catalogo_id: z.string()
    .min(1, "Selecione um item do catálogo"),
  cliente_id: z.string()
    .min(1, "Selecione um contratante"),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  horario: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  local: z.string()
    .max(200, "Local deve ter no máximo 200 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  periodo_inicio: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  periodo_fim: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  quantidade: z.number()
    .min(1, "Quantidade deve ser pelo menos 1")
    .optional()
    .nullable(),
  valor_referencia: z.number()
    .min(0, "Valor de referência não pode ser negativo"),
  valor_negociado: z.number()
    .min(0, "Valor negociado não pode ser negativo"),
  status: z.enum(["pendente", "confirmada", "executada", "cancelada"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type VendaFormData = z.infer<typeof vendaSchema>;

// ==================== TRANSAÇÃO SCHEMA ====================
export const transacaoSchema = z.object({
  tipo: z.enum(["receita", "despesa"], {
    errorMap: () => ({ message: "Selecione o tipo" })
  }),
  descricao: z.string()
    .min(1, "Descrição é obrigatória")
    .max(200, "Descrição deve ter no máximo 200 caracteres")
    .trim(),
  categoria: z.string()
    .min(1, "Categoria é obrigatória"),
  valor: z.number()
    .min(0.01, "Valor deve ser maior que zero"),
  data: z.string()
    .min(1, "Data é obrigatória"),
  status: z.enum(["pendente", "pago"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  cliente_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type TransacaoFormData = z.infer<typeof transacaoSchema>;

// ==================== CONTRATO SCHEMA ====================
export const contratoSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(150, "Título deve ter no máximo 150 caracteres")
    .trim(),
  tipo: z.string()
    .min(1, "Tipo é obrigatório"),
  data_inicio: z.string()
    .min(1, "Data de início é obrigatória"),
  data_fim: z.string()
    .min(1, "Data de fim é obrigatória"),
  valor: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  cliente_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["ativo", "vencendo", "vencido", "cancelado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ContratoFormData = z.infer<typeof contratoSchema>;

// ==================== EVENTO SCHEMA ====================
export const eventoSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(150, "Título deve ter no máximo 150 caracteres")
    .trim(),
  tipo_evento: z.string()
    .min(1, "Tipo de evento é obrigatório"),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["agendado", "confirmado", "pendente", "concluido", "cancelado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  data_inicio: z.string()
    .min(1, "Data de início é obrigatória"),
  horario_inicio: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  local: z.string()
    .max(200, "Local deve ter no máximo 200 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type EventoFormData = z.infer<typeof eventoSchema>;

// ==================== PROJETO SCHEMA ====================
export const projetoSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(150, "Título deve ter no máximo 150 caracteres")
    .trim(),
  tipo: z.enum(["single", "ep", "album"], {
    errorMap: () => ({ message: "Selecione um tipo válido" })
  }),
  artista_id: z.string()
    .min(1, "Artista é obrigatório"),
  status: z.enum(["rascunho", "em_producao", "concluido", "cancelado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  data_inicio: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_fim: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  orcamento: z.number()
    .min(0, "Orçamento não pode ser negativo")
    .optional()
    .nullable(),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ProjetoFormData = z.infer<typeof projetoSchema>;

// ==================== OBRA SCHEMA ====================
export const obraSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  genero: z.string()
    .max(50, "Gênero deve ter no máximo 50 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  duracao: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  iswc: z.string()
    .max(20, "ISWC deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  isrc: z.string()
    .max(20, "ISRC deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["em_analise", "pendente", "registrado", "rejeitado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(2000, "Observações deve ter no máximo 2000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ObraFormData = z.infer<typeof obraSchema>;

// ==================== FONOGRAMA SCHEMA ====================
export const fonogramaSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  obra_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  isrc: z.string()
    .max(20, "ISRC deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  duracao: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  gravadora: z.string()
    .max(100, "Gravadora deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  data_registro: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["em_analise", "pendente", "registrado", "rejeitado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type FonogramaFormData = z.infer<typeof fonogramaSchema>;

// ==================== LANCAMENTO SCHEMA ====================
export const lancamentoSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  tipo: z.enum(["single", "ep", "album"], {
    errorMap: () => ({ message: "Selecione um tipo válido" })
  }),
  data_lancamento: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  distribuidora: z.string()
    .max(100, "Distribuidora deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["analise", "aprovado", "ativo", "programado", "cancelado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type LancamentoFormData = z.infer<typeof lancamentoSchema>;

// ==================== BRIEFING SCHEMA ====================
export const briefingSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(150, "Título deve ter no máximo 150 caracteres")
    .trim(),
  tipo: z.string()
    .min(1, "Tipo é obrigatório"),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  prioridade: z.enum(["baixa", "media", "alta"], {
    errorMap: () => ({ message: "Selecione uma prioridade válida" })
  }),
  status: z.enum(["pendente", "em_revisao", "aprovado", "rejeitado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  prazo: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  orcamento: z.number()
    .min(0, "Orçamento não pode ser negativo")
    .optional()
    .nullable(),
  objetivos: z.string()
    .max(1000, "Objetivos deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  publico_alvo: z.string()
    .max(500, "Público-alvo deve ter no máximo 500 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  descricao: z.string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type BriefingFormData = z.infer<typeof briefingSchema>;

// ==================== CAMPANHA SCHEMA ====================
export const campanhaSchema = z.object({
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  plataforma: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["rascunho", "ativa", "pausada", "concluida", "cancelada"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  data_inicio: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_fim: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  orcamento: z.number()
    .min(0, "Orçamento não pode ser negativo")
    .optional()
    .nullable(),
  gasto: z.number()
    .min(0, "Gasto não pode ser negativo")
    .optional()
    .nullable(),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type CampanhaFormData = z.infer<typeof campanhaSchema>;

// ==================== TAREFA MARKETING SCHEMA ====================
export const tarefaMarketingSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(150, "Título deve ter no máximo 150 caracteres")
    .trim(),
  campanha_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  categoria: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  responsavel: z.string()
    .max(100, "Responsável deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  prioridade: z.enum(["baixa", "media", "alta"], {
    errorMap: () => ({ message: "Selecione uma prioridade válida" })
  }),
  status: z.enum(["pendente", "em_andamento", "concluida", "atrasada"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  data_prazo: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  descricao: z.string()
    .max(1000, "Descrição deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type TarefaMarketingFormData = z.infer<typeof tarefaMarketingSchema>;

// ==================== INVENTÁRIO SCHEMA ====================
export const inventarioSchema = z.object({
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  categoria: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  quantidade: z.number()
    .min(1, "Quantidade mínima é 1")
    .optional()
    .nullable(),
  localizacao: z.string()
    .max(200, "Localização deve ter no máximo 200 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["disponivel", "em_uso", "emprestado", "manutencao", "danificado", "descartado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  valor_unitario: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type InventarioFormData = z.infer<typeof inventarioSchema>;

// ==================== CONTATO SCHEMA ====================
export const contatoSchema = z.object({
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  tipo: z.string()
    .min(1, "Tipo é obrigatório"),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  telefone: z.string()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  cargo: z.string()
    .max(100, "Cargo deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  empresa: z.string()
    .max(150, "Empresa deve ter no máximo 150 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ContatoFormData = z.infer<typeof contatoSchema>;

// ==================== LICENÇA SCHEMA ====================
export const licencaSchema = z.object({
  tipo_uso: z.string()
    .min(1, "Tipo de uso é obrigatório"),
  cliente_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  obra_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  fonograma_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  territorio: z.string()
    .max(100, "Território deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  data_inicio: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_fim: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  valor: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  status: z.enum(["ativa", "vencida", "cancelada", "pendente"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type LicencaFormData = z.infer<typeof licencaSchema>;

// ==================== TAKEDOWN SCHEMA ====================
export const takedownSchema = z.object({
  plataforma: z.string()
    .min(1, "Plataforma é obrigatória"),
  obra_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  fonograma_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  url_infracao: z.string()
    .url("URL inválida")
    .max(500, "URL deve ter no máximo 500 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  data_solicitacao: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_resolucao: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["pendente", "em_analise", "resolvido", "rejeitado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type TakedownFormData = z.infer<typeof takedownSchema>;

// ==================== NOTA FISCAL SCHEMA ====================
export const notaFiscalSchema = z.object({
  numero: z.string()
    .min(1, "Número é obrigatório")
    .max(50, "Número deve ter no máximo 50 caracteres"),
  serie: z.string()
    .max(10, "Série deve ter no máximo 10 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  cliente_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  venda_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  valor: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  data_emissao: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["emitida", "cancelada", "pendente"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type NotaFiscalFormData = z.infer<typeof notaFiscalSchema>;

// ==================== SHARE SCHEMA ====================
export const shareSchema = z.object({
  titular: z.string()
    .min(1, "Titular é obrigatório")
    .max(150, "Titular deve ter no máximo 150 caracteres")
    .trim(),
  obra_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  tipo_direito: z.string()
    .min(1, "Tipo de direito é obrigatório"),
  percentual: z.number()
    .min(0, "Percentual não pode ser negativo")
    .max(100, "Percentual não pode ser maior que 100"),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ShareFormData = z.infer<typeof shareSchema>;

// ==================== REGRA SCHEMA ====================
export const regraSchema = z.object({
  nome: z.string()
    .min(1, "Nome da regra é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .trim(),
  tipo: z.string()
    .min(1, "Tipo é obrigatório"),
  descricao: z.string()
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  condicoes: z.any()
    .optional()
    .nullable(),
  acoes: z.any()
    .optional()
    .nullable(),
  ativo: z.boolean()
    .optional()
    .nullable(),
});

export type RegraFormData = z.infer<typeof regraSchema>;

// ==================== USUARIO SCHEMA ====================
export const usuarioSchema = z.object({
  nome: z.string()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  email: z.string()
    .min(1, "Email é obrigatório")
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres"),
  telefone: z.string()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["ativo", "inativo", "suspenso"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  setor: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  nivel_acesso: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type UsuarioFormData = z.infer<typeof usuarioSchema>;

// ==================== TEMPLATE CONTRATO SCHEMA ====================
export const templateContratoSchema = z.object({
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  tipo: z.string()
    .min(1, "Tipo é obrigatório"),
  conteudo: z.string()
    .max(50000, "Conteúdo muito extenso")
    .optional()
    .nullable()
    .or(z.literal("")),
  variaveis: z.array(z.string())
    .optional()
    .nullable(),
  ativo: z.boolean()
    .optional()
    .nullable(),
  header_image_url: z.string()
    .url("URL inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
  footer_image_url: z.string()
    .url("URL inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type TemplateContratoFormData = z.infer<typeof templateContratoSchema>;

// ==================== META ARTISTA SCHEMA ====================
export const metaArtistaSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(150, "Título deve ter no máximo 150 caracteres")
    .trim(),
  artista_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  tipo: z.string()
    .min(1, "Tipo é obrigatório"),
  categoria: z.string()
    .min(1, "Categoria é obrigatória"),
  valor_meta: z.number()
    .min(0, "Valor da meta não pode ser negativo"),
  valor_atual: z.number()
    .min(0, "Valor atual não pode ser negativo")
    .optional()
    .default(0),
  unidade: z.string()
    .max(50, "Unidade deve ter no máximo 50 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  data_inicio: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_fim: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["ativa", "concluida", "pausada", "cancelada"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  descricao: z.string()
    .max(1000, "Descrição deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type MetaArtistaFormData = z.infer<typeof metaArtistaSchema>;

// ==================== LEAD SCHEMA ====================
export const leadSchema = z.object({
  nome_contratante: z.string()
    .min(1, "Nome do contato é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  telefone: z.string()
    .min(1, "Telefone é obrigatório")
    .max(20, "Telefone deve ter no máximo 20 caracteres"),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  nome_empresa: z.string()
    .max(150, "Nome da empresa deve ter no máximo 150 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  documento: z.string()
    .max(20, "Documento deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  cargo: z.string()
    .max(100, "Cargo deve ter no máximo 100 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  sobrenome: z.string()
    .max(100, "Sobrenome deve ter no máximo 100 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  instagram: z.string()
    .max(100, "Instagram deve ter no máximo 100 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  website: z.string()
    .max(200, "Website deve ter no máximo 200 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  tipo_lead: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  servicos_interesse: z.array(z.string())
    .optional()
    .nullable(),
  descricao_demanda: z.string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  nome_artista_banda: z.string()
    .max(150, "Nome do artista deve ter no máximo 150 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  genero_musical: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  cidade_artista: z.string()
    .max(100, "Cidade deve ter no máximo 100 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  estado_artista: z.string()
    .max(2, "Estado deve ter 2 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  artista_interesse: z.string()
    .max(150, "Artista deve ter no máximo 150 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  tipo_evento: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_evento: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  cidade_evento: z.string()
    .max(100, "Cidade deve ter no máximo 100 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  estado_evento: z.string()
    .max(2, "Estado deve ter 2 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  nome_local_evento: z.string()
    .max(200, "Nome do local deve ter no máximo 200 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  endereco_evento: z.string()
    .max(300, "Endereço deve ter no máximo 300 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  capacidade_publico: z.number()
    .min(0, "Capacidade deve ser positiva")
    .optional()
    .nullable(),
  orcamento_estimado: z.number()
    .min(0, "Orçamento não pode ser negativo")
    .optional()
    .nullable(),
  origem_lead: z.string()
    .min(1, "Selecione a origem do lead"),
  status_lead: z.string()
    .min(1, "Selecione um status válido"),
  prioridade: z.enum(["alta", "media", "baixa"], {
    errorMap: () => ({ message: "Selecione uma prioridade válida" })
  }),
  probabilidade_fechamento: z.number()
    .min(0, "Probabilidade deve ser entre 0 e 100")
    .max(100, "Probabilidade deve ser entre 0 e 100"),
  valor_estimado_cache: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  comissao_percentual: z.number()
    .min(0, "Comissão deve ser entre 0 e 100")
    .max(100, "Comissão deve ser entre 0 e 100")
    .optional()
    .nullable(),
  tipo_contrato: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  data_limite_retorno: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  responsavel_id: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  observacoes_internas: z.string()
    .max(2000, "Observações deve ter no máximo 2000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  tags: z.array(z.string())
    .optional()
    .nullable(),
  temperatura_lead: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  forma_pagamento: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  validade_proposta: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  campanha_marketing: z.string()
    .max(150, "Nome da campanha deve ter no máximo 150 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  metadata: z.record(z.unknown())
    .optional()
    .nullable(),
});

export type LeadFormData = z.infer<typeof leadSchema>;

// ==================== HELPER FUNCTIONS ====================
export function formatZodErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  errors.errors.forEach((error) => {
    const path = error.path.join(".");
    if (path && !formattedErrors[path]) {
      formattedErrors[path] = error.message;
    }
  });
  return formattedErrors;
}

// Função helper para validar dados com schema
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}