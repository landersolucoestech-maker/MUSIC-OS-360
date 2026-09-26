/**
 * scripts/naming/pt-lexicon.mjs — Portuguese token lexicon used by the
 * technical-naming census. Tokens are lowercase, accent-stripped words matched
 * whole-word against camelCase / snake_case / kebab-case splits. Words that
 * are also common English technical words (status, data, lead, marketing,
 * briefing, ...) are excluded to avoid false positives.
 */
export const PT_TOKENS = new Set(`
artista artistas lancamento lancamentos projeto projetos contrato contratos obra obras fonograma fonogramas
cliente clientes contato contatos campanha campanhas receita receitas despesa despesas pagamento pagamentos
financeiro financeira financeiros financas usuario usuarios empresa empresas equipe equipes tarefa tarefas
evento eventos agenda documento documentos nota notas fiscal fiscais valor valores data datas nome nomes tipo tipos
descricao observacao observacoes responsavel responsaveis setor setores funcionario funcionarios folha ferias
colaborador colaboradores faixa faixas musica musicas gravacao gravacoes distribuicao distribuidora distribuidoras
parceria parcerias parceiro parceiros relatorio relatorios configuracao configuracoes integracao integracoes
conta contas saldo lucro custo custos orcamento orcamentos gestao cadastro cadastros registro registros
lista listagem formulario visao detalhe detalhes novo nova editar excluir salvar buscar filtro filtros pesquisa
vencimento parcela parcelas cobranca faturas fatura recibo comprovante anexo anexos arquivo arquivos
lead? inventario localizacao quantidade compra venda vendas marca selo gravadora editora autor autores compositor
compositores interprete interpretes produtor produtores titular titulares percentual repasse repasses royalty?
rateio acordo acordos parte partes assinatura assinaturas assinado assinados vigencia inicio fim termino
cidade estado pais endereco telefone celular bairro numero complemento cep? genero idioma letra duracao
ano mes dia hora semana status? ativo ativos inativo pendente pago aprovado rejeitado cancelado concluido
rascunho agendado publicado distribuido criado atualizado removido
modelo modelos categoria categorias ordem posicao pagina paginas tabela tabelas coluna colunas campo campos
pessoa pessoal pessoais fisica juridica documento dados dado informacoes informacao historico
visualizar criar atualizar remover deletar carregar enviar receber gerar calcular validar verificar obter
selecionar abrir fechar mostrar exibir ocultar adicionar
evolucao metrica metricas plataforma plataformas seguidores ouvintes
marketing? conteudo conteudos tarefa briefing? calendario postagem postagens
banco agencia conta pix boleto cartao
rh folha ponto beneficio beneficios salario salarios admissao demissao cargo cargos departamento
treinamento avaliacao desempenho
monitoramento deteccao deteccoes direitos direito licenca licencas takedown?
servico servicos tipo_servico prestador tomador
emprestimo investimento viagem motivo
patrimonio equipamento equipamentos
aprovacao solicitacao solicitacoes
mensagem mensagens conversa conversas atendimento atendimentos
fila envio aviso agendamento resposta pedido
`.split(/\s+/).map((t) => t.replace(/\?$/, "")).filter(Boolean)
  // ambiguous with English: drop
  .filter((t) => !["status","marketing","briefing","takedown","royalty","lead","cep","data","nota","ano","dia","modelo","ponto","banco","agencia","ordem","campo","idioma"].includes(t)));

export function splitWords(name) {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

/** Portuguese lexicon words in a name; plural forms (-s, -es, -oes/-aes -> -ao) match their singular. */
export function ptWords(name) {
  const hit = (w) => PT_TOKENS.has(w)
    || (w.length > 4 && w.endsWith("s") && PT_TOKENS.has(w.slice(0, -1)))
    || (w.length > 5 && w.endsWith("es") && PT_TOKENS.has(w.slice(0, -2)))
    || (w.length > 5 && /(oes|aes)$/.test(w) && PT_TOKENS.has(`${w.slice(0, -3)}ao`));
  return splitWords(name).filter(hit);
}

const PT_PROSE = /\b(n[aã]o|para|com|sem|quando|porque|pois|deve|devem|est[aá]|s[aã]o|tamb[eé]m|ent[aã]o|j[aá]|ainda|aqui|isso|este|esta|esse|essa|pelo|pela|pelos|pelas|uma|um|dos|das|nos|nas|mas|ou|se|que|como|onde|quem|mesmo|apenas|sempre|nunca|antes|depois|agora|cada|todo|toda|todos|todas|seu|sua|seus|suas|foi|ser|ter|tem|fazer|feito|pode|podem|precisa|caso|sobre|entre|via|at[eé]|voc[eê])\b/gi;
const EN_PROSE = /\b(the|and|or|not|with|without|when|because|must|should|is|are|this|that|these|those|for|from|into|only|always|never|before|after|each|every|its|was|be|have|has|do|does|can|if|then|which|who|where)\b/gi;

/** true when a free-text chunk (comment/test title) reads as Portuguese. */
export function isPtProse(text) {
  const t = text.normalize("NFC");
  const pt = (t.match(PT_PROSE) || []).length + (/[ãõçáéíóúâêô]/i.test(t) ? 2 : 0);
  const en = (t.match(EN_PROSE) || []).length;
  return pt >= 2 && pt > en;
}
