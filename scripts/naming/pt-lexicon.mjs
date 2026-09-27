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
evento eventos agenda documento documentos nota notas fiscais valor valores data datas nome nomes tipo tipos
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
banco agencia conta pix boleto cartao chave chaves
rh folha ponto beneficio beneficios salario salarios admissao demissao cargo cargos departamento
treinamento avaliacao desempenho
monitoramento deteccao deteccoes direitos direito licenca licencas takedown?
servico servicos tipo_servico prestador tomador
emprestimo investimento viagem motivo
patrimonio equipamento equipamentos
aprovacao solicitacao solicitacoes
mensagem mensagens conversa conversas atendimento atendimentos
fila envio aviso agendamento resposta pedido
nascimento completo bruto liquido artistico artistica desconto descontos imposto impostos taxa taxas capa cena cenas
roteiro ensaio reuniao contratante ingresso ingressos publico capacidade entregavel entregaveis sociedade sociedades
empresario segmento prioridade probabilidade fechamento estimado territorio territorios midia destino origem previsto
realizado fornecedor fornecedores preco devolucao manutencao emprestado unidade unidades condicao dias meses anos
todos todas geral resumo exportar importar baixar subir somente apenas pagar vencido vencida mensal anual semanal
entrada saida inicial previsao contratado contratados ouvinte seguidor faturamento receber pagos pendentes
interacao interacoes horario horarios compromisso compromissos proximo proximos proxima proximas agora oculto ocultos
normalizar destaque destaques vencendo vencidos venceu realizados hoje ontem amanha detentor detentores versao versoes
perfil perfis gerais participante participantes calculo calculos arrecadacao arrecadacoes certificado certificados
conciliacao licenciamento licenciamentos moeda moedas prioridades titulo titulos numeros enderecos telefones quantidades
enviado recebido semanas senha busca resultado resultados imagem imagens letras generos idioma comissao
participacao participacoes margem fonografico obrigatorio opcional antigo excluido ultimo ultima primeiro primeira
padrao personalizado personalizada
fase fases interno interna analitica criativa ideias planejamento tendencias metas divergencia divergencias correcoes
avancado automacoes especificacao estrutural mapeamento definitivo testabilidade observabilidade unificar signatarios
listagens relacional dinamicas centros financeiras fluxo caixa etapa etapas tecnica sistema enriquecer modelo modulo auditoria
`.split(/\s+/).map((t) => t.replace(/\?$/, "")).filter(Boolean)
  // ambiguous with English: drop
  .filter((t) => !["status","marketing","briefing","takedown","royalty","lead","cep","data","nota","ano","dia","modelo","ponto","banco","agencia","ordem","campo","idioma",
    // proper names with no English translation (Brazilian payment system "Pix")
    "pix"].includes(t)));

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

const PT_PROSE = /\b(e|o|os|ao|aos|da|em|mesma|mesmas|mesmos|exatamente|acima|abaixo|ausente|usa|nenhum|nenhuma|efetivamente|n[aã]o|para|com|sem|quando|porque|pois|deve|devem|est[aá]|s[aã]o|tamb[eé]m|ent[aã]o|j[aá]|ainda|aqui|isso|este|esta|esse|essa|pelo|pela|pelos|pelas|uma|um|dos|das|nos|nas|mas|ou|se|que|como|onde|quem|mesmo|apenas|sempre|nunca|antes|depois|agora|cada|todo|toda|todos|todas|seu|sua|seus|suas|foi|ser|ter|tem|fazer|feito|pode|podem|precisa|caso|sobre|entre|at[eé]|voc[eê])\b/gi;
/**
 * Unambiguous Portuguese words (never English, never code identifiers in prose) typical of
 * short test titles and comments that carry no function word: "rejeita senha vazia".
 * Each one alone is definitive evidence of Portuguese prose.
 */
const PT_STRONG = /\b(rejeita|rejeitam|aceita|aceitam|recria|recriam|retorna|retornam|persiste|persistem|lan[cç]a|exige|exigem|reusa|filtra|filtram|identifica|reduz|oculta|mostra|mostram|exibe|renderiza|delega|preserva|aborta|reflete|respeitam|bloqueia|derruba|desabilita|habilita|extrai|vazio|vazia|negativo|negativa|conflitantes|conflito|legado|somente|ambos|erros|senha|contagem|tabela|nulos|faz|gravando|garante|impede|permite|n[aã]o)\b/gi;
const EN_PROSE = /\b(the|and|or|not|with|without|when|because|must|should|is|are|this|that|these|those|for|from|into|only|always|never|before|after|each|every|its|was|be|have|has|do|does|can|if|then|which|who|where)\b/gi;

/**
 * Removes spans that are not the author's own prose before scoring:
 * quoted literals ('…', "…", `…`) are UX text or values under test, and
 * dotted hosts/paths (customer.api.soundcharts.com, evil.com/artist) would
 * otherwise read ".com" as the Portuguese preposition "com".
 */
function ownProse(text) {
  return text
    .replace(/(?<!\w)'[^'\n]*'(?!\w)|"[^"\n]*"|`[^`\n]*`/g, " ") // apostrophes (don't) are not quotes
    .replace(/\b[\w-]+(?:\.[\w-]+)+(?:\/[\w./:-]*)?/g, " ")
    .replace(/[@\w]+(?:[-/][\w]+)+/g, " "); // hyphen/slash compounds: @music-os-360/types, fail-fast
}

/** true when a free-text chunk (comment/test title) reads as Portuguese. */
export function isPtProse(text) {
  const t = ownProse(text.normalize("NFC"));
  const prose = (t.match(PT_PROSE) || []).length;
  // Portuguese domain nouns (projeto, filtro, obra…) only reinforce text that already has a
  // Portuguese function word: English text that merely lists legacy column names
  // (nome -> tipo, data_inicio) must not read as Portuguese.
  const lexicon = prose > 0 ? ptWords(t).length : 0;
  const strong = (t.match(PT_STRONG) || []).length * 2;
  const pt = prose + (/[ãõçáéíóúâêô]/i.test(t) ? 2 : 0) + lexicon + strong;
  const en = (t.match(EN_PROSE) || []).length;
  return pt >= 2 && pt > en;
}
