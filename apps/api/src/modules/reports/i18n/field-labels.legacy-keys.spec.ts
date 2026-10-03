import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FIELD_LABELS_PT_BR,
  fieldKeyForLabelPtBr,
  getFieldLabelPtBr,
  normalizeFieldKey,
  tryGetFieldLabelPtBr,
} from './field-labels.pt-br';

/**
 * Frozen set (169 keys) of the legacy Portuguese-named dictionary keys that keep a reader alive
 * (the canonical naming ledger rows covered by field-labels.readers.spec.ts for
 * field-labels.pt-br.ts). field-labels.readers.spec.ts only validates tags of keys that
 * still exist, so deleting a tagged alias would pass it silently. This spec fails when any
 * of these keys disappears, loses its reader tag or stops resolving to its label through
 * the real lookup functions. Removing a key is a deliberate act: remove it here (and from
 * the ledger) in the same change as the deprecated reader that justified it.
 */
const LEGACY_READER_KEYS: ReadonlyArray<readonly [key: string, label: string]> = [
  ['cep', 'CEP'],
  ['agencia', 'Agência'],
  ['agenciaBooking', 'Agência de booking'],
  ['appleMusicAlbunsUrl', 'Álbuns no Apple Music'],
  ['banco', 'Banco'],
  ['chavePix', 'Chave Pix'],
  ['conta', 'Conta'],
  ['contatosEquipe', 'Contatos da equipe'],
  ['contatosVinculados', 'Contatos vinculados'],
  ['contratoId', 'Contrato'],
  ['dataNascimento', 'Data de nascimento'],
  ['deezerFas', 'Fãs no Deezer'],
  ['distribuidorasEmails', 'E-mails das distribuidoras'],
  ['distribuidorasEmpresaEmails', 'E-mails das distribuidoras (empresa)'],
  ['distribuidorasEmpresaSelecionadas', 'Distribuidoras da empresa'],
  ['distribuidorasGerais', 'Distribuidoras gerais'],
  ['distribuidorasSelecionadas', 'Distribuidoras selecionadas'],
  ['documentosPessoaisUrl', 'Documentos pessoais'],
  ['empresarioEmail', 'E-mail do empresário'],
  ['empresarioId', 'Empresário (ID)'],
  ['empresarioNome', 'Empresário'],
  ['empresarioTelefone', 'Telefone do empresário'],
  ['endereco', 'Endereço'],
  ['especialidades', 'Especialidades'],
  ['faseCarreira', 'Fase da carreira'],
  ['fotoUrl', 'Foto'],
  ['galeriaUrls', 'Galeria'],
  ['genero', 'Gênero'],
  ['gravadoraEmail', 'E-mail da gravadora'],
  ['gravadoraId', 'Gravadora (ID)'],
  ['gravadoraNome', 'Gravadora'],
  ['gravadoraResponsavelEmail', 'E-mail do responsável na gravadora'],
  ['gravadoraResponsavelId', 'Responsável na gravadora (ID)'],
  ['gravadoraResponsavelNome', 'Responsável na gravadora'],
  ['gravadoraResponsavelTelefone', 'Telefone do responsável na gravadora'],
  ['gravadoraTelefone', 'Telefone da gravadora'],
  ['instagramSeguidores', 'Seguidores no Instagram'],
  ['labelParceira', 'Selo parceiro'],
  ['managerContato', 'Contato do empresário'],
  ['managerNome', 'Nome do empresário'],
  ['nomeArtistico', 'Nome artístico'],
  ['nomeCivil', 'Nome civil'],
  ['notasInternas', 'Notas internas'],
  ['produtorExecutivo', 'Produtor executivo'],
  ['relacionamentos', 'Relacionamentos'],
  ['slugArtistico', 'Identificador público'],
  ['soundcloudSeguidoresUrl', 'Seguidores no SoundCloud'],
  ['spotifyOuvintes', 'Ouvintes no Spotify'],
  ['statusCadastro', 'Situação do cadastro'],
  ['tagsMusicais', 'Etiquetas musicais'],
  ['tiktokSeguidores', 'Seguidores no TikTok'],
  ['tipoPerfil', 'Tipo de perfil'],
  ['titularConta', 'Titular da conta'],
  ['youtubeInscritos', 'Inscritos no YouTube'],
  ['videomaker', 'Videomaker'],
  ['bairro', 'Bairro'],
  ['complemento', 'Complemento'],
  ['enderecoCompleto', 'Endereço completo'],
  ['foto', 'Foto'],
  ['funcao', 'Função'],
  ['logradouro', 'Logradouro'],
  ['perfil', 'Perfil'],
  ['prioridadeContato', 'Prioridade do contato'],
  ['razaoSocial', 'Razão social'],
  ['responsavelCargo', 'Cargo do responsável'],
  ['responsavelEmail', 'E-mail do responsável'],
  ['responsavelNome', 'Nome do responsável'],
  ['responsavelTelefone', 'Telefone do responsável'],
  ['tipoPessoa', 'Tipo de pessoa'],
  ['conteudo', 'Conteúdo'],
  ['dataFim', 'Data de fim'],
  ['dataInicio', 'Data de início'],
  ['exclusivo', 'Exclusivo'],
  ['versoes', 'Versões'],
  ['baseCalculo', 'Base de cálculo'],
  ['codigoMunicipio', 'Código do município'],
  ['codigoServicoMunicipal', 'Código de serviço municipal'],
  ['issRetido', 'ISS retido'],
  ['naturezaOperacao', 'Natureza da operação'],
  ['numeroNotaFiscal', 'Número da nota fiscal'],
  ['tipoNota', 'Tipo de nota'],
  ['tomadorCep', 'CEP do tomador'],
  ['tomadorInscricaoEstadual', 'Inscrição estadual do tomador'],
  ['tomadorInscricaoMunicipal', 'Inscrição municipal do tomador'],
  ['tomadorUf', 'UF do tomador'],
  ['contatoLocal', 'Contato do local'],
  ['publicoEsperado', 'Público esperado'],
  ['arquivoUrl', 'Arquivo'],
  ['cargo', 'Cargo'],
  ['dataAdmissao', 'Data de admissão'],
  ['dataDemissao', 'Data de demissão'],
  ['departamento', 'Departamento'],
  ['motivo', 'Motivo'],
  ['salario', 'Salário'],
  ['telefone', 'Telefone'],
  ['tipoContrato', 'Tipo de contrato'],
  ['periodo', 'Período'],
  ['dataEntrada', 'Data de entrada'],
  ['responsavel', 'Responsável'],
  ['codigoServico', 'Código do serviço'],
  ['condicaoPagamento', 'Condição de pagamento'],
  ['dataEmissao', 'Data de emissão'],
  ['formaPagamento', 'Forma de pagamento'],
  ['numero', 'Número'],
  ['quantidade', 'Quantidade'],
  ['tomadorRazaoSocial', 'Razão social do tomador'],
  ['vencimento', 'Vencimento'],
  ['cidade', 'Cidade'],
  ['empresa', 'Empresa'],
  ['estado', 'Estado'],
  ['cliente', 'Cliente'],
  ['midiaDestino', 'Mídia de destino'],
  ['moeda', 'Moeda'],
  ['obraMusical', 'Obra musical'],
  ['territorio', 'Território'],
  ['tipoUso', 'Tipo de uso'],
  ['valor', 'Valor'],
  ['agregadora', 'Agregadora'],
  ['arquivoAudio', 'Arquivo de áudio'],
  ['classificacao', 'Classificação'],
  ['codEntidade', 'Código de Cadastro da Sociedade'],
  ['criadaPorIa', 'Criada por IA'],
  ['dataLancamento', 'Data de lançamento'],
  ['duracaoMin', 'Duração (minutos)'],
  ['duracaoSeg', 'Duração (segundos)'],
  ['emissao', 'Emissão'],
  ['gravacaoOriginal', 'Gravação original'],
  ['gravadora', 'Gravadora'],
  ['isrcAno', 'ISRC — Ano'],
  ['isrcDesignacao', 'ISRC — Designação'],
  ['isrcPais', 'ISRC — País'],
  ['isrcRegistrante', 'ISRC — Registrante'],
  ['midia', 'Mídia'],
  ['nacional', 'Nacional'],
  ['paisOrigem', 'País de origem'],
  ['paisPublicacao', 'País de publicação'],
  ['participacao', 'Participação'],
  ['percentual', 'Percentual'],
  ['pubSimultanea', 'Publicação simultânea'],
  ['descricao', 'Descrição'],
  ['interpretes', 'Intérpretes'],
  ['orcamento', 'Orçamento'],
  ['produtores', 'Produtores'],
  ['idioma', 'Idioma'],
  ['artista', 'Artista'],
  ['compositores', 'Compositores'],
  ['letra', 'Letra'],
  ['nome', 'Nome'],
  ['dataIdentificacao', 'Data de identificação'],
  ['evidencias', 'Evidências'],
  ['obraAfetada', 'Obra afetada'],
  ['plataforma', 'Plataforma'],
  ['prioridade', 'Prioridade'],
  ['urlInfracao', 'Link da infração'],
  ['categoria', 'Categoria'],
  ['observacao', 'Observação'],
  ['projeto', 'Projeto'],
  ['compositor', 'Compositor'],
  ['editora', 'Editora'],
  ['iaHarmonia', 'IA — Harmonia'],
  ['iaLetra', 'IA — Letra'],
  ['iaMelodia', 'IA — Melodia'],
  ['letraCompleta', 'Letra completa'],
  ['letristas', 'Letristas'],
  ['outrosTitulos', 'Outros títulos'],
  ['participantes', 'Participantes'],
  ['referenciasConexas', 'Referências conexas'],
  ['tipoIa', 'Tipo de IA'],
  ['tipoObra', 'Tipo de obra'],
];

const toSnakeCase = (key: string): string => key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

describe('field-labels.pt-br — frozen legacy reader keys', () => {
  // A key is reader-tagged when its dictionary line ends with `// reader: <kinds>`.
  const taggedKeys = new Set(
    readFileSync(join(__dirname, 'field-labels.pt-br.ts'), 'utf8')
      .split('\n')
      .map((line) => /^ {2}([A-Za-z0-9_]+): .*, \/\/ reader: [a-z -]+$/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key)),
  );

  it('the frozen list has no duplicates', () => {
    expect(new Set(LEGACY_READER_KEYS.map(([key]) => key)).size).toBe(LEGACY_READER_KEYS.length);
    expect(LEGACY_READER_KEYS).toHaveLength(169);
  });

  it.each(LEGACY_READER_KEYS)('%s exists, is reader-tagged and resolves to its label through the real lookups', (key, label) => {
    expect(Object.prototype.hasOwnProperty.call(FIELD_LABELS_PT_BR, key)).toBe(true);
    expect(taggedKeys.has(key)).toBe(true);
    expect(normalizeFieldKey(key)).toBe(key);
    expect(tryGetFieldLabelPtBr(key)).toBe(label);
    expect(getFieldLabelPtBr(key)).toBe(label);
    // readers also reach the key through its snake_case / PascalCase request spelling
    expect(tryGetFieldLabelPtBr(toSnakeCase(key))).toBe(label);
    expect(tryGetFieldLabelPtBr(key.charAt(0).toUpperCase() + key.slice(1))).toBe(label);
    // import round-trip: the label reverses to a key (the first key wins on a shared label)
    expect(fieldKeyForLabelPtBr(label)).not.toBeNull();
  });

  it('every reader-tagged dictionary key that the ledger tracks is still tagged (no key lost its reader)', () => {
    const frozen = new Set(LEGACY_READER_KEYS.map(([key]) => key));
    const missing = [...frozen].filter((key) => !taggedKeys.has(key));
    expect(missing).toEqual([]);
  });

  it('negative: a missing key does not resolve (the lookup the readers use fails fast)', () => {
    expect(tryGetFieldLabelPtBr('legacyKeyThatWasRemoved')).toBeNull();
    expect(() => getFieldLabelPtBr('legacyKeyThatWasRemoved')).toThrow(/Missing pt-BR label/);
  });
});
