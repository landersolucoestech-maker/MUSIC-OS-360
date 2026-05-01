export interface TemplateContrato {
  id: string;
  nome: string;
  tipoServico?: string;
  tipo_servico?: string;
  descricao?: string;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
  created_at?: string;
  updated_at?: string;
}
