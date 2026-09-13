/**
 * Elegibilidade de share para submissão de registro (ABRAMUS/ECAD/etc.).
 *
 * Regra TRANSITÓRIA (Fase 5 / C6): `share_type` só é gravado pelo fluxo
 * financeiro/pendente (SharePendenteFormModal → shares.service.ts::toColumns()).
 * O fluxo de registro (campos holder_name/party_role/percentage/
 * holder_document, alimentados via os aliases holderName/role/holderDoc)
 * nunca seta
 * `share_type` — não existe hoje uma via de criação própria para shares de
 * registro. Por isso NULL é o único sinal disponível para "não veio do
 * formulário financeiro".
 *
 * Isto NÃO é uma extração de FK/entidade nem uma consolidação de conceitos —
 * `share_type` continua sendo escrito apenas pelo fluxo financeiro. Este
 * predicado só documenta e centraliza a regra de LEITURA usada pelos
 * consumidores de registro (society-payload-builder, entity-validators,
 * external-data-exchange), para eles nunca divergirem entre si.
 *
 * TODO (normalização futura, fora do escopo do C6): introduzir um valor
 * explícito (ex.: `share_type = 'registry'`) quando o fluxo de registro
 * ganhar uma via de criação própria, eliminando a dependência de NULL.
 *
 * Chamado sobre entidades já lidas do banco — `share_type` nunca é
 * `undefined` nesse caso (coluna ausente do SELECT não ocorre nas queries
 * atuais); o predicado não trata `undefined` como elegível.
 */
export function isRegistryEligibleShare(share: { share_type: string | null }): boolean {
  return share.share_type === null;
}

/** Fragmento SQL equivalente ao predicado acima, para uso em query builders. */
export const REGISTRY_ELIGIBLE_SHARE_SQL = 'share_type IS NULL';
