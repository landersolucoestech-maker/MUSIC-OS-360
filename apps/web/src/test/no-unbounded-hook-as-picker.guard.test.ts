/**
 * no-unbounded-hook-as-picker.guard.test.ts  (Task J)
 *
 * Guarda permanente: os 8 hooks "me dê tudo" abaixo buscam só os primeiros
 * ~50 registros do tenant, sem busca server-side. Usá-los como fonte de
 * select/autocomplete/relacionamento/resolução de nome/autofill/
 * cross-reference/deep-link é o padrão que a Task J eliminou — este teste
 * impede reintrodução silenciosa.
 *
 * Em vez disso, use:
 *  - useEntityLookup (shared/hooks/useEntityLookup.ts) para busca server-side;
 *  - useEntityById (mesmo arquivo) para resolver um ID já conhecido;
 *  - AsyncEntityCombobox (shared/components/AsyncEntityCombobox.tsx) para
 *    pickers com dropdown.
 *
 * Qualquer arquivo que ainda chame um destes hooks precisa constar em
 * ALLOWED_CALL_SITES, com a justificativa exata do porquê é seguro (mutation-
 * only, isLoading-only, escopado por ID server-side, ou fallback só quando um
 * agregado do backend ainda não carregou). Um novo call site que apareça fora
 * dessa lista falha o teste — a correção é migrar para os hooks acima, não
 * adicionar uma entrada aqui sem revisão.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");

const UNBOUNDED_HOOKS = [
  "useArtistas",
  "useObras",
  "useProjects",
  "useContracts",
  "useClientes",
  "useFonogramas",
  "useLicencas",
  "useEmployees",
];

// Definições dos próprios hooks (e da infraestrutura de lookup, que os cita
// em JSDoc) — não são call sites reais.
const HOOK_DEFINITION_FILES = new Set([
  "modules/artist/hooks/useArtistas.ts",
  "modules/catalog/hooks/useObras.ts",
  "modules/catalog/hooks/useFonogramas.ts",
  "modules/projects/hooks/useProjects.ts",
  "modules/contracts/hooks/useContracts.ts",
  "modules/crm-relationships/hooks/useContacts.ts",
  "modules/crm-relationships/services/clients.service.ts",
  "modules/licensing/hooks/useLicencas.ts",
  "modules/rh/hooks/useEmployees.ts",
  "modules/artist/hooks/useArtistasPaginated.ts",
  "shared/hooks/useEntityLookup.ts",
  "shared/hooks/useEditQueryParam.ts",
  "shared/components/AsyncEntityCombobox.tsx",
]);

// Call sites confirmados LEGÍTIMOS na auditoria da Task J.
const ALLOWED_CALL_SITES: Record<string, string> = {
  "modules/dashboard/hooks/useMetrics.ts":
    "useArtistas()/useProjects() alimentam contagens com o agregado do backend (dashboard.artists_by_status/.artists) como fonte primária; o array capado só é usado como fallback quando o agregado ainda não carregou (mesmo padrão do HR stats).",
  "modules/artist/components/ArtistVision360Modal.tsx":
    "useObras/useFonogramas/useProjects/useContracts(open, artistId) recebem artistId explícito e filtram server-side — não é 'me dê tudo'.",
  "modules/contracts/pages/Contracts.tsx":
    "useContracts() só para mutations; a lista é passada a useEditQueryParam, que tem fallback findById para IDs fora da página carregada.",
  "modules/contracts/components/ContractWizard.tsx":
    "useContracts() só para mutations (addContract/updateContract).",
  "modules/contracts/components/ContractFormModal.tsx":
    "useContracts() só para mutations (addContract/updateContract); o picker de clientes usa AsyncEntityCombobox.",
  "modules/catalog/pages/RegistroMusicas.tsx":
    "useObras/useFonogramas só para mutations. useProjects() alimenta só o dropdown de projetos/gêneros (valores distintos) — risco documentado no próprio arquivo por falta de endpoint dedicado (equivalente a /works/stats/generos); busca, paginação e deep-links não dependem disso.",
  "modules/artist/components/ArtistFormModal.tsx":
    "useArtistas()/useClientes() só para mutations (addArtista/updateArtista/addCliente) — não há mais picker de contrato neste formulário (Task AA removeu a seção Classificação e Vínculos).",
  "modules/rh/pages/RH.tsx":
    "useEmployees() só para mutations + isLoading; nomes resolvidos via FuncionarioNomeCell (useEntityById) e o picker de documentos usa AsyncEntityCombobox.",
  "modules/rh/components/EmployeeFormModal.tsx":
    "useEmployees() só para mutations (addEmployee/updateEmployee).",
  "modules/rh/components/LeaveRequestFormModal.tsx":
    "useEmployees() só para isLoading; o picker de funcionário usa AsyncEntityCombobox.",
  "modules/catalog/components/ObraFormModal.tsx":
    "useObras() só para mutations (addObra/updateObra); pickers de artista/projeto usam useEntityLookup/useEntityById.",
  "modules/catalog/components/FonogramaFormModal.tsx":
    "useFonogramas() só para mutations (addFonograma/updateFonograma); resolução de artista/obra usa storage.findById/listPaged direto.",
  "modules/projects/components/ProjectFormModal.tsx":
    "useProjects() só para mutations (addProject/updateProject).",
  "modules/projects/pages/Projects.tsx":
    "useProjects() só para mutations + dropdown de gêneros (valores distintos) — risco documentado no próprio arquivo; deep-link (?projeto=) e nome do artista por linha usam busca direta por ID.",
  "modules/marketing/components/ia-criativa/PerfilTab.tsx":
    "useObras/useFonogramas(!!artist, artist?.id) — escopados server-side pelo artista selecionado no próprio formulário.",
  "modules/licensing/pages/Licenciamento.tsx":
    "useLicencas() só para mutations (delete); a lista paginada usa hook separado (Task H).",
  "modules/licensing/components/LicencaFormModal.tsx":
    "useLicencas() só para mutations (addLicenca/updateLicenca); o picker de obra usa AsyncEntityCombobox.",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "test") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Remove comentários (// de linha e /* de bloco, incluindo {/* JSX *\/}
 * multi-linha) para não confundir uma menção em prosa/JSDoc com uma chamada
 * real do hook. Mini-lexer stateful — precisa cruzar linhas porque comentário
 * de bloco/JSX pode ter texto solto em linhas de continuação sem `*` líder. */
function stripCommentLines(content: string): string {
  let out = "";
  let inBlockComment = false;
  for (let i = 0; i < content.length; i++) {
    if (inBlockComment) {
      if (content[i] === "*" && content[i + 1] === "/") {
        inBlockComment = false;
        i++;
      } else if (content[i] === "\n") {
        out += "\n";
      }
      continue;
    }
    if (content[i] === "/" && content[i + 1] === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (content[i] === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += content[i];
  }
  return out;
}

const hookCallPattern = new RegExp(`\\b(${UNBOUNDED_HOOKS.join("|")})\\(`);

describe("Guarda permanente (Task J): hooks 'me dê tudo' só onde revisado e justificado", () => {
  const files = walk(SRC_ROOT);
  const flagged: string[] = [];

  for (const full of files) {
    const rel = path.relative(SRC_ROOT, full).replace(/\\/g, "/");
    if (HOOK_DEFINITION_FILES.has(rel)) continue;

    const code = stripCommentLines(fs.readFileSync(full, "utf8"));
    if (hookCallPattern.test(code)) flagged.push(rel);
  }

  it("todo arquivo com chamada a um hook 'me dê tudo' está na allowlist revisada", () => {
    const unlisted = flagged.filter((rel) => !(rel in ALLOWED_CALL_SITES));
    expect(unlisted).toEqual([]);
  });

  it("a allowlist não acumula entradas obsoletas (arquivo removido/renomeado ou hook removido do arquivo)", () => {
    const stale = Object.keys(ALLOWED_CALL_SITES).filter((rel) => !flagged.includes(rel));
    expect(stale).toEqual([]);
  });
});
