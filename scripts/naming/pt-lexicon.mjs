/**
 * scripts/naming/pt-lexicon.mjs — Portuguese signal used by the technical-naming census.
 *
 * Tokens come from pt-vocabulary.txt (accent-folded, lowercase; see its header for provenance):
 * a hit means "this name contains a Portuguese word" and is a candidate for semantic review,
 * never an automatic rename. Names are split on camelCase / snake_case / kebab-case boundaries
 * and each word is matched whole, with -oes/-aes plurals folded to their -ao singular.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const VOCABULARY = path.join(here, "pt-vocabulary.txt");

/**
 * English or technical words that look Portuguese to a frequency table (English plurals such as
 * "todos", acronyms such as "rtp"/"bom", proper names such as "portugal"). The vocabulary file
 * already excludes them; they are re-applied here so a hand edit of the file cannot bring one back.
 *
 * Also listed: `eua` (abbreviation such as `_eua` = expectedUpdatedAt; "EUA" = United States only
 * appears in end-user copy) and `nfe`/`nfse`/`nfce` (Brazilian fiscal document types NF-e, NFS-e and
 * NFC-e: external contract vocabulary that must be spelled exactly as the tax authorities name them).
 */
export const EN_OVERRIDES = new Set(`
meta audiovisual param params num resolver resolvers pos logo logos whatsapp util utils alias aliases dom infra era inclusive final
portal extras indices lateral del resp cid enc cnt evt inp zap usp obs pag segs dels ana mau mpb samba forro bossa portugal argentina
electronica latam cinema lucida palatino perpetua sistina alef eacute aacute agrave atilde iacute oacute uacute ecirc ocirc acirc
ccedil otilde emites fintx principal opa cheque municipal regime auto twitter blog ranking sms pdf org deezer integral grave label status
data total normal real dao tempo rtp todo soa avc bom modulo ver algo nas vao uff ora vim cores reviver devolve ecad musicos ipi series ibge
eua nfe nfse nfce
`.split(/\s+/).filter(Boolean));

function loadVocabulary(file = VOCABULARY) {
  const words = fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (words.length < 1000) throw new Error(`pt-lexicon: vocabulary ${file} has ${words.length} words — refusing to run with a truncated signal`);
  return new Set(words.filter((w) => !EN_OVERRIDES.has(w)));
}

export const PT_TOKENS = loadVocabulary();

export function splitWords(name) {
  return name
    // NFe / NFSe / NFCe are single words (the camelCase split would read them as "n fe", "nf se")
    .replace(/NF(?:S|C)?e(?![a-z])/g, (m) => m.toLowerCase())
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

/**
 * true when one lowercase word is Portuguese. The vocabulary lists plural forms itself; only the
 * unambiguous -oes/-aes plural folds to its -ao singular (a generic -s/-es fold read English words
 * as Portuguese verb forms: continuous -> continuou, fixes -> fixe).
 */
export function isPtWord(w) {
  if (EN_OVERRIDES.has(w)) return false;
  return PT_TOKENS.has(w) || (w.length > 5 && /(oes|aes)$/.test(w) && PT_TOKENS.has(`${w.slice(0, -3)}ao`));
}

/**
 * Portuguese function words that are also standard English/technical names on their own
 * (`em` = EntityManager, `qual` = pg_policies.qual): Portuguese only inside a longer name
 * (pago_em, com_empresario, criada_por_ia).
 */
const SOLO_AMBIGUOUS = new Set(["em", "qual", "com", "por", "sem", "para", "tem", "como", "entre"]);

/** Portuguese vocabulary words in a technical name. */
export function ptWords(name) {
  const words = splitWords(name);
  if (words.length === 1 && SOLO_AMBIGUOUS.has(words[0])) return [];
  const hits = words.filter(isPtWord);
  // `qual` is the pg_policies.qual column (the policy USING expression): a compound such as
  // qualSnippet / qualIncludes whose only Portuguese word is `qual` is that column, not Portuguese.
  // A genuine Portuguese name carries more vocabulary (qual_artista).
  if (words.length > 1 && hits.length === 1 && hits[0] === "qual") return [];
  return hits;
}

const PT_PROSE = /\b(e|o|os|ao|aos|da|de|na|em|mesma|mesmas|mesmos|exatamente|acima|abaixo|ausente|usa|nenhum|nenhuma|efetivamente|n[aã]o|para|com|sem|quando|porque|pois|deve|devem|est[aá]|s[aã]o|tamb[eé]m|ent[aã]o|j[aá]|ainda|aqui|isso|este|esta|esse|essa|pelo|pela|pelos|pelas|uma|um|dos|das|nos|nas|mas|ou|se|que|como|onde|quem|mesmo|apenas|sempre|nunca|antes|depois|agora|cada|todo|toda|todos|todas|seu|sua|seus|suas|foi|ser|ter|tem|fazer|feito|pode|podem|precisa|caso|sobre|entre|at[eé]|voc[eê])\b/gi;
/**
 * Unambiguous Portuguese words (never English, never code identifiers in prose) typical of
 * short test titles and comments that carry no function word: "rejeita senha vazia".
 * Each one alone is definitive evidence of Portuguese prose.
 */
const PT_STRONG = /\b(rejeita|rejeitam|aceita|aceitam|recria|recriam|retorna|retornam|persiste|persistem|lan[cç]a|exige|exigem|reusa|filtra|filtram|identifica|reduz|oculta|mostra|mostram|exibe|renderiza|delega|preserva|aborta|reflete|respeitam|bloqueia|derruba|desabilita|habilita|extrai|vazio|vazia|negativo|negativa|conflitantes|conflito|legado|somente|ambos|erros|senha|contagem|tabela|nulos|faz|gravando|garante|impede|permite|executa|grava|registra|atualiza|verifica|confirma|concede|popula|produz|n[aã]o)\b/gi;
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
  const strong = (t.match(PT_STRONG) || []).length * 2;
  const en = (t.match(EN_PROSE) || []).length;
  // Only the author's own lowercase prose words count as vocabulary evidence: identifiers quoted
  // bare in English text (nome -> tipo, data_inicio, TipoTransacao) are code, not prose.
  const words = (t.match(/(?<![\w.])[A-Za-zÀ-ÿ][a-zà-ÿ]+(?![\w(])/g) || []).map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  const lexicon = words.filter(isPtWord).length;
  // Portuguese domain nouns (projeto, filtro, obra…) reinforce text that already carries a
  // Portuguese function word or verb; English text that merely lists legacy column names
  // (nome -> tipo, data_inicio) must not read as Portuguese.
  const reinforced = prose > 0 || strong > 0 ? lexicon : 0;
  const pt = prose + (/[ãõçáéíóúâêô]/i.test(t) ? 2 : 0) + reinforced + strong;
  if (pt >= 2 && pt > en) return true;
  // Short titles made of Portuguese words only ("calcula repasse do artista") carry no function word.
  return en === 0 && lexicon >= 2 && lexicon / Math.max(words.length, 1) >= 0.5;
}
